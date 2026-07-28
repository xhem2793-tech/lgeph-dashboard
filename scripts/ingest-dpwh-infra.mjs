#!/usr/bin/env node
/**
 * DPWH 지역별 인프라 투자 수집 — #17 (지역별 정부 인프라 투자).
 *
 *   node scripts/ingest-dpwh-infra.mjs [--dry] [--max=20000]
 *
 * DPWH Transparency API(공개, 키 없음, ~300req/10min)를 페이지네이션으로 훑어
 * 지역×연도×카테고리 단위로 예산·건수를 집계 → infra_projects_regional 테이블 적재.
 *   · region(17개)·infraYear·category(Roads/Bridges/Buildings/Flood Control 등)별 total_budget·project_count·완료율
 *   · B2B 공조/빌트인 발주 환경(지역별 인프라 강도)의 대리 지표.
 *
 * ⚠️ 이 API 는 Cloudflare 로 보호되어 헤드리스/데이터센터 IP 에서 403 이 날 수 있음.
 *    일반 브라우저망(사내망 등)에서 실행하세요. 실패 시 HF 미러(bettergovph/dpwh-transparency-data) 고려.
 *
 * 환경변수 SB_PAT(Supabase Management API) 또는 scripts/.sbpat 필요.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes("--dry")
const MAX = Number((process.argv.find((a) => a.startsWith("--max=")) || "--max=20000").split("=")[1])
const API = "https://api.transparency.dpwh.gov.ph/projects"

const SB_REF = process.env.SB_REF || "ozvbyigntwhwzzagwojr"
const patFile = resolve(HERE, ".sbpat")
const SB_PAT = process.env.SB_PAT || (existsSync(patFile) ? readFileSync(patFile, "utf8").trim() : "")
async function q(sql) {
  if (!SB_PAT) throw new Error("SB_PAT 필요")
  const r = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
    method: "POST", headers: { Authorization: "Bearer " + SB_PAT, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }),
  })
  if (!r.ok) throw new Error("SB " + r.status + " " + (await r.text()).slice(0, 300))
  const t = await r.text(); return t.trim() ? JSON.parse(t) : []
}

// (region, infraYear, category) → {budget, paid, count, done}
const agg = new Map()
function add(p) {
  const region = p?.location?.region || p?.region
  if (!region) return
  const year = String(p.infraYear || "").trim() || "기타"
  const cat = p.category || p.componentCategories || "기타"
  const key = region + "|" + year + "|" + cat
  const a = agg.get(key) || { region, year, cat, budget: 0, paid: 0, count: 0, done: 0 }
  a.budget += Number(p.budget) || 0
  a.paid += Number(p.amountPaid) || 0
  a.count += 1
  if ((p.status || "").toLowerCase() === "completed" || Number(p.progress) >= 100) a.done += 1
  agg.set(key, a)
}

async function fetchPage(offset, limit) {
  // DPWH API 파라미터는 배포본에 따라 다를 수 있음(offset/limit 또는 page). 실패 시 여기 조정.
  const r = await fetch(`${API}?limit=${limit}&offset=${offset}`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } })
  if (!r.ok) throw new Error("DPWH " + r.status + " (Cloudflare 차단 가능 — 브라우저망에서 실행)")
  const j = await r.json()
  return Array.isArray(j) ? j : (j.data || j.projects || j.items || [])
}

async function main() {
  let offset = 0, total = 0
  const LIMIT = 500
  while (offset < MAX) {
    const page = await fetchPage(offset, LIMIT)
    if (!page.length) break
    page.forEach(add)
    total += page.length
    offset += LIMIT
    if (total % 5000 === 0) console.log(`  …${total}건 수집`)
    if (page.length < LIMIT) break
  }
  const rows = [...agg.values()]
  console.log(`수집 ${total}건 → 집계 ${rows.length} (지역×연도×카테고리)`)
  if (DRY || !rows.length) { console.log("샘플:", JSON.stringify(rows.slice(0, 5))); if (DRY) return }

  await q(`create table if not exists public.infra_projects_regional (
    region text not null, infra_year text not null, category text not null,
    total_budget numeric, total_paid numeric, project_count integer, completed_count integer,
    source text default 'DPWH', updated_at timestamptz default now(),
    primary key (region, infra_year, category)
  )`)
  const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'"
  for (let i = 0; i < rows.length; i += 200) {
    const vals = rows.slice(i, i + 200).map((a) => `(${esc(a.region)},${esc(a.year)},${esc(a.cat)},${a.budget},${a.paid},${a.count},${a.done},now())`)
    await q(`insert into infra_projects_regional (region,infra_year,category,total_budget,total_paid,project_count,completed_count,updated_at)
      values ${vals.join(",")} on conflict (region,infra_year,category) do update set total_budget=excluded.total_budget, total_paid=excluded.total_paid, project_count=excluded.project_count, completed_count=excluded.completed_count, updated_at=now()`)
  }
  console.log(`✓ 적재 완료 · infra_projects_regional (${rows.length}행)`)
}
main().catch((e) => { console.error("실패:", e.message); process.exit(1) })
