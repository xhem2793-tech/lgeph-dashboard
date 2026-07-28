#!/usr/bin/env node
/**
 * 페이지 인사이트 배너 갱신 — 주간/월간 자동화.
 *
 *   node scripts/update-banners.mjs --refresh-periods [--deploy]
 *       └ 주간 배너는 현재 ISO 주(2026-Wxx), 월간 배너는 현재 월(2026-07)로 기간 라벨 + updatedAt 갱신
 *
 *   node scripts/update-banners.mjs <spec.json> [--deploy]
 *       └ 스펙의 key 배너 워딩(title·summary·body·insight…)을 교체하고 기간/일자 갱신
 *         spec 예: { "key": "news", "title": "...", "summary": "...", "body": "...", "insight": "...", "insightLabel": "LG 관점" }
 *
 * banners.json 은 public/ 에 있고 각 페이지가 런타임에 읽는다. --deploy 시 커밋/푸시로 자동 배포.
 * 주간 크론 예: 매주 월요일 아침 `--refresh-periods --deploy`, 콘텐츠 교체는 스펙으로.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const MANIFEST = resolve(ROOT, "public", "banners.json")

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith("--")))
const specPath = args.find((a) => !a.startsWith("--"))

const p2 = (n) => String(n).padStart(2, "0")
const isoDate = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate())
function isoWeek(d) {
  // ISO-8601 주차 — 목요일 기준
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
  return t.getUTCFullYear() + "-W" + p2(week)
}
const monthLabel = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1)

if (!existsSync(MANIFEST)) { console.error("banners.json 없음: " + MANIFEST); process.exit(1) }
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"))
const now = new Date()
const today = isoDate(now)

if (specPath) {
  // ── 워딩 교체 모드 ──
  const spec = JSON.parse(readFileSync(resolve(process.cwd(), specPath), "utf8"))
  if (!spec.key || !manifest[spec.key]) { console.error("스펙 key 없음/미등록: " + spec.key); process.exit(1) }
  const b = manifest[spec.key]
  for (const f of ["title", "summary", "body", "insight", "insightLabel", "period", "cadence"]) {
    if (spec[f] != null) b[f] = spec[f]
  }
  if (spec.period == null) b.period = b.cadence === "monthly" ? monthLabel(now) : isoWeek(now)
  b.updatedAt = today
  console.log(`워딩 교체 — ${spec.key} · 기간 ${b.period}`)
} else if (flags.has("--refresh-periods")) {
  // ── 기간 라벨 갱신 모드 ──
  for (const [key, b] of Object.entries(manifest)) {
    const before = b.period
    b.period = b.cadence === "monthly" ? monthLabel(now) : isoWeek(now)
    b.updatedAt = today
    console.log(`${key.padEnd(16)} ${b.cadence || "weekly"} · ${before} → ${b.period}`)
  }
} else {
  console.error("사용법: --refresh-periods | <spec.json>  (+ 선택 --deploy)")
  process.exit(1)
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n")
console.log("✓ banners.json 갱신 완료")

if (flags.has("--deploy")) {
  try {
    execSync("git add public/banners.json", { cwd: ROOT, stdio: "inherit" })
    execSync(`git commit -m "배너 갱신 (${today})"`, { cwd: ROOT, stdio: "inherit" })
    execSync("git push", { cwd: ROOT, stdio: "inherit" })
    console.log("배포 푸시 완료 — Cloudflare Pages 빌드 트리거")
  } catch (e) {
    console.error("배포 실패:", e.message)
    process.exit(1)
  }
}
