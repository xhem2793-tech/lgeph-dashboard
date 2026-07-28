#!/usr/bin/env node
/**
 * 주간 시장 인사이트 리포트 자동 생성 — SONA 브리핑 포맷 참고.
 *
 *   node scripts/weekly-insight.mjs            # 데이터→PDF/JPG→매니페스트(이메일 미발송)
 *   node scripts/weekly-insight.mjs --send     # 위 + 법인 이메일 발송(명시적일 때만)
 *   node scripts/weekly-insight.mjs --deploy    # + git commit/push(자동 배포)
 *
 * 흐름: Supabase 최신 데이터 수집 → 단일 16:9 슬라이드 HTML 조립(데이터 기반, 추정 금지) →
 *       헤드리스 Chrome 로 PDF+JPG 렌더 → publish-report.mjs 로 발행(매니페스트 등록 + 선택 발송).
 *
 * ※ 기본값은 이메일 미발송(--send 없으면 --no-email 로 파이프라인 호출). SONA 처럼 사람이 검토 후 발송.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const WORK = resolve(HERE, ".weekly")
if (!existsSync(WORK)) mkdirSync(WORK, { recursive: true })
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")))

// ── Supabase (프론트와 동일한 공개 anon 키) ──
const SB_URL = "https://ozvbyigntwhwzzagwojr.supabase.co"
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dmJ5aWdudHdod3p6YWd3b2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODkxNDEsImV4cCI6MjA5ODQ2NTE0MX0.LrkBzEK9QzX1PCNm9KzTUZE29VcHuJOqikFOnbEpv6U"
async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } })
  if (!r.ok) throw new Error("supabase " + r.status)
  return r.json()
}

// ── 날짜/주차 ──
const p2 = (n) => String(n).padStart(2, "0")
const now = new Date()
const isoDate = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate())
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day); const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return t.getUTCFullYear() + "-W" + p2(Math.ceil(((t - ys) / 86400000 + 1) / 7))
}
const WEEK = isoWeek(now)
const TODAY = isoDate(now)

// ── 최신 지표 2점(현재·직전) → 값·변화 ──
async function latest2(ind) {
  try {
    const rows = await sb(`macro_indicators?indicator=eq.${encodeURIComponent(ind)}&order=period_date.desc&limit=2&select=value,period_date`)
    if (!rows || !rows.length) return null
    const cur = Number(rows[0].value), prev = rows[1] != null ? Number(rows[1].value) : null
    return { cur, prev, asOf: rows[0].period_date }
  } catch { return null }
}
const arrow = (d) => (d == null ? "" : d > 0 ? "▲" : d < 0 ? "▼" : "→")
const chgHtml = (m, dp = 1, cls) => {
  if (!m || m.prev == null) return ""
  const d = m.cur - m.prev
  if (Math.abs(d) < Math.pow(10, -dp) / 2) return ""
  const c = cls || (d > 0 ? "em-r" : "em-e")
  return ` <span class="${c}">${arrow(d)}${Math.abs(d).toFixed(dp)}</span>`
}

async function gather() {
  const inds = ["gdp_growth_yoy", "cpi_inflation_yoy", "unemployment_rate", "BSP_policy_rate", "consumer_confidence_index", "php_usd_rate", "oil_diesel", "meralco_residential_rate", "psei_index", "ofw_cash_remittance"]
  const m = {}
  for (const k of inds) m[k] = await latest2(k)
  let news = []
  try { news = await sb(`v_news_feed?ai_analysis=not.is.null&order=date.desc&limit=6&select=title,ai_analysis,topic,date,source_name`) } catch {}
  let cal = []
  try { cal = await sb(`v_calendar_upcoming?select=date,event,category&order=date.asc&limit=6`) } catch {}
  let promo = []
  try { promo = await sb(`v_promo_intensity?select=*&limit=6`) } catch {}
  return { m, news, cal, promo }
}

// ── 슬라이드 조립 ──
const C = { ind: "#3730a3", rose: "#be123c", emer: "#047857", amber: "#b45309", blue: "#1d4ed8", teal: "#0f766e", ink: "#0f1420", mut: "#4b5563", faint: "#8a94a3" }
const fmt = (m, unit = "", dp = 1) => (m && Number.isFinite(m.cur) ? m.cur.toFixed(dp) + unit : "—")
const card = (color, tag, seg, items, impl) => `<div class="cd">
  <div class="cd-h"><span class="cd-bar" style="background:${color}"></span><span class="cd-t" style="color:${color}">${tag}</span><span class="seg">${seg}</span></div>
  <ul>${items.filter(Boolean).map((x) => `<li>${x}</li>`).join("")}</ul>
  <div class="impl" style="border-color:${color}">${impl}</div>
</div>`

function buildHtml(d) {
  const { m } = d
  const catKo = { 경제: "거시", 금융: "금융", 정치: "정책", 규제: "규제", 에너지: "에너지", 유통: "유통", 공휴일: "공휴일" }
  const calItems = (d.cal || []).slice(0, 5).map((e) => {
    const dd = Math.round((new Date(e.date + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime()) / 86400000)
    return `<b>${e.date.slice(5).replace("-", "/")}</b> ${e.event.replace(/\s*—.*$/, "").slice(0, 30)} <span class="seg2">${dd <= 0 ? "D-0" : "D-" + dd}</span>`
  })
  const newsItems = (d.news || []).slice(0, 5).map((n) => `<b>[${catKo[n.topic] || n.topic || "뉴스"}]</b> ${String(n.title).slice(0, 40)}`)

  const macroBul = [
    `성장 <b>${fmt(m.gdp_growth_yoy, "%")}</b>${chgHtml(m.gdp_growth_yoy, 1)} · 물가 <b>${fmt(m.cpi_inflation_yoy, "%")}</b>${chgHtml(m.cpi_inflation_yoy, 1)}`,
    `실업률 <b>${fmt(m.unemployment_rate, "%")}</b>${chgHtml(m.unemployment_rate, 1)} · 정책금리 <b>${fmt(m.BSP_policy_rate, "%", 2)}</b>${chgHtml(m.BSP_policy_rate, 2)}`,
    `소비자심리 <b>${fmt(m.consumer_confidence_index, "", 1)}</b>${chgHtml(m.consumer_confidence_index, 1)} · PSEi <b>${m.psei_index ? Math.round(m.psei_index.cur).toLocaleString() : "—"}</b>`,
    m.ofw_cash_remittance ? `OFW 송금 <b>$${m.ofw_cash_remittance.cur.toFixed(2)}B</b>${chgHtml(m.ofw_cash_remittance, 2)}` : null,
  ]
  const fxBul = [
    `페소 <b>₱${fmt(m.php_usd_rate, "/USD", 2)}</b>${chgHtml(m.php_usd_rate, 2, "em-r")} — 조달원가·수입가전 COGS 직결`,
    `디젤 <b>₱${fmt(m.oil_diesel, "/L", 2)}</b>${chgHtml(m.oil_diesel, 2, "em-r")} — 물류비·실질구매력`,
    `Meralco 가정용 <b>₱${fmt(m.meralco_residential_rate, "/kWh", 2)}</b>${chgHtml(m.meralco_residential_rate, 2, "em-r")} — 냉방·냉장 상시가동 부담`,
  ]

  // 데이터 기반 요약(추정 표현 없이 값·방향만)
  const infTone = m.cpi_inflation_yoy && m.cpi_inflation_yoy.prev != null ? (m.cpi_inflation_yoy.cur < m.cpi_inflation_yoy.prev ? "둔화" : "상승") : "유지"
  const fxTone = m.php_usd_rate && m.php_usd_rate.prev != null ? (m.php_usd_rate.cur > m.php_usd_rate.prev ? "약세" : "강세") : "보합"

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>주간 인사이트 ${WEEK}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:338mm 190mm;margin:0}*{box-sizing:border-box}
  :root{--ink:${C.ink};--mut:${C.mut};--faint:${C.faint};--ind:${C.ind};--rose:${C.rose};--emer:${C.emer};--blue:${C.blue}}
  html,body{margin:0;padding:0}
  body{font-family:"Pretendard Variable",Pretendard,Inter,system-ui,"Malgun Gothic",sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact;letter-spacing:-.004em}
  .slide{width:338mm;height:190mm;padding:10mm 12mm 8mm;display:flex;flex-direction:column;background:#fff}
  b{font-weight:700}
  .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid var(--ind);padding-bottom:7px}
  .top .eye{font-size:9.5pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ind)}
  .top h1{margin:4px 0 0;font-size:23pt;font-weight:800;line-height:1.1}
  .top .sub{margin-top:3px;font-size:10pt;color:var(--mut);font-weight:600}
  .top .r{text-align:right;font-size:9pt;color:var(--mut);line-height:1.5}.top .r b{color:var(--ink);font-size:10pt}
  .sum{margin-top:8px;background:#f4f5fb;border:1px solid #e2e5f4;border-radius:6px;padding:8px 13px;font-size:10.2pt;line-height:1.5}
  .sum b.h{color:var(--ind);font-weight:800}
  .em-r{color:var(--rose);font-weight:700}.em-e{color:var(--emer);font-weight:700}.em-b{color:var(--blue);font-weight:700}
  .grid{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:9px;margin-top:8px;min-height:0}
  .cd{border:1px solid #e5e7ec;border-radius:9px;padding:8px 12px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
  .cd-h{display:flex;align-items:center;gap:8px;margin-bottom:5px}
  .cd-bar{width:5px;height:16px;border-radius:3px}.cd-t{font-size:12pt;font-weight:800}
  .seg{margin-left:auto;font-size:7.4pt;font-weight:800;color:var(--faint);letter-spacing:.04em;border:1px solid #e0e3e9;border-radius:4px;padding:2px 6px}
  .seg2{font-size:7pt;font-weight:800;color:var(--faint);border:1px solid #e0e3e9;border-radius:3px;padding:1px 4px;margin-left:3px}
  .cd ul{margin:0;padding-left:15px;display:flex;flex-direction:column;gap:3px}
  .cd li{font-size:9.2pt;line-height:1.38}.cd li b{font-weight:700}
  .impl{margin-top:auto;padding-top:5px;border-top:1px dashed #e2e4ea;font-size:8.6pt;line-height:1.4;color:var(--mut)}
  .impl b{color:var(--ink);font-weight:700}.impl .t{font-weight:800;font-size:7.8pt;letter-spacing:.03em}
  .ins{margin-top:8px;border-radius:9px;background:linear-gradient(90deg,#1e1b4b,#312e81);color:#eef;padding:9px 15px}
  .ins h4{margin:0 0 3px;font-size:10pt;font-weight:800;color:#fff}.ins p{margin:0;font-size:9.3pt;line-height:1.55;color:#dfe2fb}.ins p b{color:#fff}
  .foot{margin-top:6px;font-size:7.4pt;color:var(--faint);line-height:1.4}
</style></head><body>
<div class="slide">
  <div class="top">
    <div><div class="eye">필리핀 주간동향 · ${WEEK}</div><h1>주간 시장 인사이트</h1><div class="sub">${TODAY} 기준 · 거시·환율·정책·경쟁 종합</div></div>
    <div class="r"><div><b>LGEPH 경영기획</b></div><div>주간 인사이트 · 자동 생성</div></div>
  </div>
  <div class="sum"><b class="h">Summary.</b> 물가 <b>${fmt(m.cpi_inflation_yoy, "%")}</b>(${infTone})·성장 <b>${fmt(m.gdp_growth_yoy, "%")}</b>·정책금리 <b>${fmt(m.BSP_policy_rate, "%", 2)}</b> 속 페소 <b>₱${fmt(m.php_usd_rate, "", 2)}</b> ${fxTone}. 전기요금(Meralco ₱${fmt(m.meralco_residential_rate, "", 2)}/kWh)·디젤 ₱${fmt(m.oil_diesel, "", 2)}/L 로 원가·구매력 압박 지속 — <b>냉방·냉장 상시가동 가전 수요와 수입 조달원가 동시 주시</b>.</div>
  <div class="grid">
    ${card(C.emer, "거시·물가·소비", "CE", macroBul, `<span class="t" style="color:${C.emer}">▶ 사업 함의</span> <b>[CE]</b> 물가 ${infTone}·소비심리 흐름 → 볼륨존 내구재 구매력 회복 여부 주시.`)}
    ${card(C.rose, "환율·에너지·조달", "CE·조달", fxBul, `<span class="t" style="color:${C.rose}">▶ 사업 함의</span> <b>[CE·조달]</b> 페소 ${fxTone}·연료비 → 수입가전 COGS·소비자 전가·프로모 여력 주시.`)}
    ${card(C.blue, "정책·규제 일정", "전사", calItems.length ? calItems : ["예정 일정 데이터 없음"], `<span class="t" style="color:${C.blue}">▶ 사업 함의</span> <b>[전사]</b> 지표 발표·정책 시행 일정 선반영 — 대응 타이밍 사전 점검.`)}
    ${card(C.teal, "경쟁·유통 신호", "CE", newsItems.length ? newsItems : ["주요 뉴스 데이터 없음"], `<span class="t" style="color:${C.teal}">▶ 사업 함의</span> <b>[CE]</b> 경쟁사 프로모·유통 동향 → 가격·번들 대응 강도 점검.`)}
  </div>
  <div class="ins">
    <h4>◈ 인사이트 — 가전 사업 관점</h4>
    <p>이번 주 거시는 물가 <b>${fmt(m.cpi_inflation_yoy, "%")}</b>(${infTone})·정책금리 <b>${fmt(m.BSP_policy_rate, "%", 2)}</b>로, 할부금융 비용과 실질구매력이 볼륨존 내구재 수요를 좌우. 페소 <b>${fxTone}</b>와 전기·연료비 상방은 수입 조달원가·소비자 전가 압력으로, <b>고효율(TCO 절감) 소구와 조달통화 헤지가 방어 축</b>. 정책 일정과 경쟁 프로모 동향은 대응 타이밍·가격 전략에 반영 — 진행 상황 주시.</p>
  </div>
  <div class="foot">출처 PSA·BSP·DOE·Meralco·World Bank 공개 통계(자체 수집) 및 뉴스 큐레이션. 값은 최신 확보분 기준이며 '인사이트'는 가전시장 함의 분석으로 공식 입장이 아님. 자동 생성 · ${WEEK}.</div>
</div>
</body></html>`
}

// ── Chrome 렌더 ──
function findChrome() {
  const cands = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.CHROME_PATH,
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

const data = await gather()
const html = buildHtml(data)
const htmlPath = resolve(WORK, "weekly.html")
writeFileSync(htmlPath, html)
console.log("[1/4] 슬라이드 HTML 조립 완료 · " + WEEK)

const chrome = findChrome()
if (!chrome) { console.error("Chrome 실행파일을 찾지 못함(CHROME_PATH 지정 필요)"); process.exit(1) }
const pdfPath = resolve(WORK, "weekly.pdf")
const jpgPath = resolve(WORK, "weekly.jpg")
const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/")
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=12000", "--print-to-pdf=" + pdfPath, fileUrl], { stdio: "ignore" })
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--screenshot=" + jpgPath, "--window-size=1278,718", "--force-device-scale-factor=2", "--virtual-time-budget=12000", fileUrl], { stdio: "ignore" })
console.log("[2/4] PDF·JPG 렌더 완료")

// ── 발행 스펙 ──
const id = "weekly-" + WEEK.toLowerCase()
const infTone = data.m.cpi_inflation_yoy && data.m.cpi_inflation_yoy.prev != null ? (data.m.cpi_inflation_yoy.cur < data.m.cpi_inflation_yoy.prev ? "둔화" : "상승") : "유지"
const spec = {
  id,
  title: "필리핀 주간동향 " + WEEK + " · 주간 시장 인사이트",
  summary: `${WEEK} 거시·환율·정책·경쟁 종합 — 물가·정책금리·페소·전기/연료비 등 주간 핵심 지표와 가전 사업 함의를 1장으로 요약.`,
  so: `물가 ${infTone}·페소 흐름·에너지비가 볼륨존 내구재 구매력과 수입 조달원가를 동시 압박 — 고효율 TCO 소구와 조달통화 헤지가 방어 축.`,
  topic: "인사이트",
  kind: "주간 인사이트",
  source: "경영기획",
  date: TODAY,
  pdf: resolve(WORK, "weekly.pdf"),
  pdfName: "Weekly_" + WEEK.replace("-", "_") + ".pdf",
  thumb: resolve(WORK, "weekly.jpg"),
  email: {
    send: flags.has("--send"),
    from: "필리핀 주간동향 <weekly@axlgeph.report>",
    replyTo: "xhem2793@gmail.com",
    subject: "[필리핀 주간동향] " + WEEK + " 주간 시장 인사이트",
    greeting: "안녕하세요. " + WEEK + " 필리핀 주간 시장 인사이트 리포트 송부드립니다.",
    to: ["xhem2793@gmail.com"],
  },
}
const specPath = resolve(WORK, "weekly-spec.json")
writeFileSync(specPath, JSON.stringify(spec, null, 2))
console.log("[3/4] 발행 스펙 작성 · id=" + id)

// ── 발행(기본 미발송) ──
const pubArgs = [resolve(HERE, "publish-report.mjs"), specPath]
if (!flags.has("--send")) pubArgs.push("--no-email")
if (flags.has("--deploy")) pubArgs.push("--deploy")
execFileSync(process.execPath, pubArgs, { stdio: "inherit" })
console.log("[4/4] 발행 완료" + (flags.has("--send") ? "(이메일 발송)" : "(이메일 미발송 — 검토 후 --send)"))
