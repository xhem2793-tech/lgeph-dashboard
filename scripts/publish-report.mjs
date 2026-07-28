#!/usr/bin/env node
/**
 * 리포트 발행 자동화 — 대시보드 반영 + 이메일 전송을 한 번에.
 *
 *   node scripts/publish-report.mjs <spec.json> [--no-email] [--deploy]
 *
 * 하는 일(순서대로):
 *   1) PDF·썸네일을 public/ 로 복사               → 정적 자산 배치
 *   2) public/reports/index.json 에 upsert(최신순) → 뉴스·리포트 페이지에 자동 노출
 *   3) Resend 로 법인 수신자에게 이메일 발송        → 본문 인라인 썸네일 + PDF 첨부
 *   4) --deploy 시 git add/commit/push             → Cloudflare Pages 자동 배포
 *
 * 스펙(JSON) 예시는 scripts/report.example.json 참고.
 * Resend 키는 환경변수 RESEND_API_KEY 또는 scripts/.resendkey(gitignore)에서 읽는다.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs"
import { resolve, dirname, basename } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const PUB = resolve(ROOT, "public")
const REPORTS_DIR = resolve(PUB, "reports")
const MANIFEST = resolve(REPORTS_DIR, "index.json")

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith("--")))
const specPath = args.find((a) => !a.startsWith("--"))
if (!specPath) {
  console.error("사용법: node scripts/publish-report.mjs <spec.json> [--no-email] [--deploy]")
  process.exit(1)
}

const spec = JSON.parse(readFileSync(resolve(process.cwd(), specPath), "utf8"))
const specDir = dirname(resolve(process.cwd(), specPath))
const need = ["id", "title", "summary", "so", "topic", "date", "pdf"]
for (const k of need) if (!spec[k]) { console.error(`스펙 누락: ${k}`); process.exit(1) }

if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true })

// ── 1) 자산 복사 ─────────────────────────────────────────────
const srcPdf = resolve(specDir, spec.pdf)
if (!existsSync(srcPdf)) { console.error(`PDF 없음: ${srcPdf}`); process.exit(1) }
const pdfName = spec.pdfName || basename(srcPdf)
copyFileSync(srcPdf, resolve(PUB, pdfName))
const pdfUrl = "/" + pdfName

let thumbUrl = null
let srcThumb = null
if (spec.thumb) {
  srcThumb = resolve(specDir, spec.thumb)
  if (existsSync(srcThumb)) {
    const thumbName = spec.id + ".jpg"
    copyFileSync(srcThumb, resolve(REPORTS_DIR, thumbName))
    thumbUrl = "/reports/" + thumbName
  }
}
console.log(`[1/4] 자산 복사 완료 — ${pdfUrl}${thumbUrl ? " · " + thumbUrl : ""}`)

// ── 2) 매니페스트 upsert ─────────────────────────────────────
const email = spec.email || {}
const willSend = email.send !== false && !flags.has("--no-email") && Array.isArray(email.to) && email.to.length > 0
const entry = {
  id: spec.id,
  title: spec.title,
  summary: spec.summary,
  so: spec.so,
  topic: spec.topic,
  kind: spec.kind || "리포트",
  source: spec.source || "경영기획",
  date: spec.date,
  pdf: pdfUrl,
  thumb: thumbUrl,
  sentAt: willSend ? spec.date : null,
  recipients: willSend ? email.to.length : null,
}
let manifest = { reports: [] }
if (existsSync(MANIFEST)) manifest = JSON.parse(readFileSync(MANIFEST, "utf8"))
manifest.reports = [entry, ...(manifest.reports || []).filter((r) => r.id !== spec.id)]
manifest.reports.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n")
console.log(`[2/4] 매니페스트 반영 — 총 ${manifest.reports.length}건 (id: ${spec.id})`)

// ── 3) 이메일 발송(Resend) ───────────────────────────────────
if (!willSend) {
  console.log("[3/4] 이메일 발송 생략(--no-email 또는 수신자 미지정)")
} else {
  const key = (process.env.RESEND_API_KEY || (existsSync(resolve(HERE, ".resendkey")) ? readFileSync(resolve(HERE, ".resendkey"), "utf8").trim() : "")).trim()
  if (!key) { console.error("RESEND_API_KEY 없음(환경변수 또는 scripts/.resendkey)"); process.exit(1) }
  const pdfB64 = readFileSync(resolve(PUB, pdfName)).toString("base64")
  const thumbB64 = srcThumb && existsSync(srcThumb) ? readFileSync(srcThumb).toString("base64") : null
  const greeting = email.greeting || `안녕하세요. ${spec.title} 요약본 송부드립니다.`
  const html =
    "<div style='font-family:Pretendard,-apple-system,sans-serif;font-size:14px;line-height:1.7;color:#1f2430;max-width:680px'>" +
    "<p style='font-size:11px;letter-spacing:.12em;color:#3730a3;font-weight:700;text-transform:uppercase;margin:0 0 4px'>" + (spec.kind || "리포트") + "</p>" +
    "<h2 style='margin:0 0 8px;font-size:19px'>" + spec.title + "</h2>" +
    "<p style='margin:0 0 12px'>" + greeting + "</p>" +
    (thumbB64 ? "<img src='cid:brief' alt='" + spec.title + "' style='width:100%;max-width:680px;border:1px solid #e3e6ea;border-radius:6px;display:block;margin:0 0 12px'/>" : "") +
    "<p style='margin:0 0 4px'><b>핵심</b></p><p style='margin:0 0 12px'>" + spec.so + "</p>" +
    "<p style='color:#8a94a3;font-size:12px;border-top:1px solid #eee;padding-top:10px;margin-top:6px'>axlgeph.report · Market Intelligence · 내부 검토용</p></div>"
  const body = {
    from: email.from || "필리핀 주간동향 <weekly@axlgeph.report>",
    to: email.to,
    reply_to: email.replyTo || "xhem2793@gmail.com",
    subject: email.subject || ("[필리핀 주간동향] " + spec.title),
    html,
    attachments: [
      ...(thumbB64 ? [{ filename: spec.id + ".jpg", content: thumbB64, content_id: "brief" }] : []),
      { filename: pdfName, content: pdfB64 },
    ],
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const txt = await r.text()
  console.log(`[3/4] 이메일 발송 — HTTP ${r.status} · 수신 ${email.to.length}명`)
  if (!r.ok) { console.error(txt); process.exit(1) }
}

// ── 4) 배포(선택) ────────────────────────────────────────────
if (flags.has("--deploy")) {
  try {
    execSync(`git add public/reports public/${pdfName}`, { cwd: ROOT, stdio: "inherit" })
    execSync(`git commit -m "리포트 발행: ${spec.title} (${spec.id})"`, { cwd: ROOT, stdio: "inherit" })
    execSync("git push", { cwd: ROOT, stdio: "inherit" })
    console.log("[4/4] 배포 푸시 완료 — Cloudflare Pages 빌드 트리거")
  } catch (e) {
    console.error("[4/4] 배포 실패:", e.message)
    process.exit(1)
  }
} else {
  console.log("[4/4] 배포 생략(--deploy 미지정) — 변경사항 커밋/푸시 시 대시보드 반영")
}
console.log("\n✓ 발행 완료.")
