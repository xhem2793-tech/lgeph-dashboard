#!/usr/bin/env node
/**
 * BSP 주택가격지수(RPPI, 구 RREPI) 수집 — 부동산 (#20).
 *
 *   node scripts/ingest-bsp-rppi.mjs [--dry]
 *
 * BSP 공개 RPPI.xlsx(2019=100, 분기, 전국 All types/Condominium/Houses)를 내려받아 파싱 →
 * macro_indicators 에 **신규** rppi_index / rppi_yoy / rppi_index_condo / rppi_index_house 적재.
 *   · 기존 residential_property_price_index 는 기준연도(base)가 달라(≈265 vs 2019=100≈146) 덮어쓰지 않음.
 *   · BSP 는 API 가 아니라 Excel 공개 — .xlsx(ZIP+XML)를 unzip 으로 파싱(외부 라이브러리 없이).
 *
 * 환경변수 SB_PAT(Supabase Management API PAT) 또는 scripts/.sbpat 필요.
 */
import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes("--dry")
const XLSX_URL = "https://www.bsp.gov.ph/Statistics/Prices/RPPI.xlsx"
const TMP = resolve(HERE, ".bsp_rppi.xlsx")

const SB_REF = process.env.SB_REF || "ozvbyigntwhwzzagwojr"
const patFile = resolve(HERE, ".sbpat")
const SB_PAT = process.env.SB_PAT || (existsSync(patFile) ? readFileSync(patFile, "utf8").trim() : "")
async function q(sql) {
  if (!SB_PAT) throw new Error("SB_PAT 필요(env 또는 scripts/.sbpat)")
  const r = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
    method: "POST", headers: { Authorization: "Bearer " + SB_PAT, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }),
  })
  if (!r.ok) throw new Error("SB " + r.status + " " + (await r.text()).slice(0, 300))
  const t = await r.text(); return t.trim() ? JSON.parse(t) : []
}

function sheetGrid(xlsxPath, sheetFile) {
  const ss = execSync(`unzip -p "${xlsxPath}" xl/sharedStrings.xml`, { maxBuffer: 1e8 }).toString()
  const strings = [...ss.matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((x) => x[1]).join("").replace(/&amp;/g, "&").replace(/&#160;/g, " "))
  const xml = execSync(`unzip -p "${xlsxPath}" ${sheetFile}`, { maxBuffer: 1e8 }).toString()
  const grid = {}
  for (const row of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs))
    for (const c of row[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?/g))
      if (c[4] != null) grid[c[1] + c[2]] = /t="s"/.test(c[3]) ? strings[Number(c[4])] : Number(c[4])
  return grid
}
const colIdx = (col) => col.split("").reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0)
const idxCol = (n) => { let s = ""; while (n > 0) { s = String.fromCharCode(64 + ((n - 1) % 26) + 1) + s; n = Math.floor((n - 1) / 26) } return s }
const qMonth = { Q1: "01", Q2: "04", Q3: "07", Q4: "10" }

async function main() {
  execSync(`curl -s "${XLSX_URL}" --max-time 40 -o "${TMP}"`)
  const g = sheetGrid(TMP, "xl/worksheets/sheet2.xml")
  // 컬럼 → period: row6(연도, 병합→왼쪽 값 carry) + row7(분기). 분기 셀이 있는 컬럼만 채택(연간/기타 열 제외).
  const colPeriod = {}
  let year = null
  for (let ci = colIdx("B"); ci <= colIdx("B") + 60; ci++) {
    const c = idxCol(ci)
    const y6 = g[c + "6"], q7 = g[c + "7"]
    if (typeof y6 === "number" && y6 >= 2000 && y6 <= 2100) year = y6
    if (typeof q7 === "string" && qMonth[q7] && year) colPeriod[c] = `${year}-${qMonth[q7]}-01`
  }
  // 대상 행: 12=All types Index, 13=Condominium Index, 14=Houses Index, 16=All types YoY
  const ROWS = { rppi_index: 12, rppi_index_condo: 13, rppi_index_house: 14, rppi_yoy: 16 }
  const out = []
  for (const [ind, row] of Object.entries(ROWS))
    for (const [c, pd] of Object.entries(colPeriod)) {
      const v = g[c + row]
      if (typeof v === "number" && Number.isFinite(v)) out.push({ ind, pd, v: Number(v.toFixed(3)) })
    }
  const latest = out.reduce((m, x) => (x.pd > m ? x.pd : m), "")
  const byInd = {}; out.forEach((o) => (byInd[o.ind] = (byInd[o.ind] || 0) + 1))
  console.log(`파싱: ${out.length}개 · 최신 ${latest} · ${JSON.stringify(byInd)}`)
  if (DRY) { console.log("샘플(rppi_index 최근):", JSON.stringify(out.filter((o) => o.ind === "rppi_index").slice(-5))); return }
  const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'"
  for (let i = 0; i < out.length; i += 200) {
    const rows = out.slice(i, i + 200).map((o) => `(${esc(o.ind)}, ${esc(o.pd)}::date, ${o.v}, 'PHILIPPINES', 'national', 'BSP RPPI', now())`)
    await q(`insert into macro_indicators (indicator, period_date, value, geo, geo_level, source, created_at) values ${rows.join(",")}
      on conflict (indicator, geo, period_date) do update set value=excluded.value, source=excluded.source`)
  }
  console.log(`✓ 적재 완료 · rppi_index/_condo/_house/_yoy (최신 ${latest})`)
}
main().catch((e) => { console.error("실패:", e.message); process.exit(1) })
