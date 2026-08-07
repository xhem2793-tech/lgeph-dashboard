import { pickL } from "@/lib/i18n"

const SB_URL = "https://ozvbyigntwhwzzagwojr.supabase.co"
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dmJ5aWdudHdod3p6YWd3b2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODkxNDEsImV4cCI6MjA5ODQ2NTE0MX0.LrkBzEK9QzX1PCNm9KzTUZE29VcHuJOqikFOnbEpv6U"

// 세션 인메모리 캐시 — 정적 export(서버 없음)라 클라이언트에서 직접 캐시.
//  · 같은 쿼리(path)를 페이지 이동/재방문 시 재조회하지 않음(데이터는 일 단위 갱신 → 3분 TTL 충분).
//  · Promise를 캐시해 동시 요청(여러 컴포넌트가 같은 쿼리)도 1회 네트워크로 디듀프.
//  · 실패는 캐시하지 않음(다음 호출에서 재시도). 대용량(경쟁사 13.8k행 등) 재조회 제거가 핵심.
const _sbCache = new Map<string, { t: number; p: Promise<any[]> }>()
const _SB_TTL = 180_000 // 3분

async function sb(path: string): Promise<any[]> {
  const now = Date.now()
  const hit = _sbCache.get(path)
  if (hit && now - hit.t < _SB_TTL) return hit.p
  const p = (async () => {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      cache: "no-store",
    })
    if (!r.ok) throw new Error(`supabase ${r.status}`)
    return r.json()
  })()
  _sbCache.set(path, { t: now, p })
  p.catch(() => { const c = _sbCache.get(path); if (c && c.p === p) _sbCache.delete(path) })
  return p
}

/** 페이지네이션 병렬 로딩 — 필요한 페이지 전부를 한 웨이브로 동시 요청(HTTP/2 멀티플렉싱).
 *  실측: 13k행(14p)을 순차 대비 ~1.2s로 단축. 첫 짧은 페이지까지만 누적(그 뒤는 빈 응답).
 *  build(off)=오프셋별 경로. Supabase는 요청당 1000행 상한이라 page=1000 고정. */
async function sbPaged(build: (off: number) => string, max: number, page = 1000): Promise<any[]> {
  const nPages = Math.ceil(max / page)
  const chunks = await Promise.all(
    Array.from({ length: nPages }, (_, i) => sb(build(i * page)).catch(() => [] as any[])),
  )
  const rows: any[] = []
  for (const c of chunks) { rows.push(...(c ?? [])); if (!c || c.length < page) break }
  return rows
}

const num = (v: any) => (v == null ? null : Number(v))

export async function latestMacro(indicators: string[]) {
  const list = indicators.join(",")
  // national 데이터는 geo='PHILIPPINES' 또는 'PH' 양쪽에 존재 → 둘 다 조회 후 최신 날짜 우선
  const rows = await sb(
    `macro_indicators?geo=in.(PHILIPPINES,PH)&indicator=in.(${list})&select=indicator,value,period_date&order=period_date.desc`,
  )
  const map: Record<string, { value: number; date: string }> = {}
  for (const r of rows) if (!map[r.indicator]) map[r.indicator] = { value: num(r.value)!, date: r.period_date }
  return map
}

export async function macroSeries(indicator: string, limit = 12): Promise<number[]> {
  const rows = await sb(
    `macro_indicators?geo=eq.PHILIPPINES&indicator=eq.${indicator}&select=value,period_date&order=period_date.desc&limit=${limit}`,
  )
  return rows.reverse().map((r) => num(r.value)!)
}

export async function exchangeRates(days = 14) {
  const rows = await sb(`exchange_rates?select=usd_php,date&order=date.desc&limit=${days}`)
  return rows.reverse().map((r) => ({ date: r.date, value: num(r.usd_php)! }))
}

export async function oilSeries(weeks = 8): Promise<number[]> {
  const rows = await sb(`oil_prices?select=diesel,date&order=date.desc&limit=${weeks}`)
  return rows.reverse().map((r) => num(r.diesel)!)
}

export async function macroDual(indicator: string) {
  const rows = await sb(`macro_indicators?geo=in.(PHILIPPINES,PH)&indicator=eq.${indicator}&select=value,period_date&order=period_date`)
  return rows.map((r) => ({ value: num(r.value)!, date: r.period_date as string }))
}

export async function oilDaily(n = 30) {
  const rows = await sb(`oil_prices?select=date,diesel,ron95&order=date.desc&limit=${n}`)
  return rows.reverse().map((r) => ({ date: r.date as string, diesel: num(r.diesel), ron95: num(r.ron95) }))
}

export type EnergyRow = { category: string; brand: string; model: string; eff: number | null; metric: string; star: number | null; kwh: number | null; spec: number | null; stype: string; refrigerant: string; gwp: number | null; asOf: string | null }
// product_name에서 모델코드 토큰 추출(TV처럼 model_code가 비고 제품명에 코드가 박힌 경우 대응). 영문+숫자 혼합·5자↑ 마지막 토큰.
function pnCode(pn: string): string {
  const toks = String(pn || "").split(/[\s(),"“”/]+/).map((t) => t.replace(/[^A-Za-z0-9-]/g, "")).filter((t) => /[A-Za-z]/.test(t) && /\d/.test(t) && t.replace(/-/g, "").length >= 5)
  return toks.length ? toks[toks.length - 1] : ""
}
export async function energyLabels(): Promise<EnergyRow[]> {
  // PostgREST 행 상한(1000) 대응 — 오프셋 페이지를 **병렬**로 가져와 로딩 지연 최소화(기존 순차 → 병렬).
  const sel = "energy_labels?select=category,brand,model_code,product_name,efficiency_val,efficiency_metric,star_rating,monthly_kwh,extra,as_of_date&order=id&limit=1000"
  const pages = await Promise.all(Array.from({ length: 8 }, (_, i) => sb(`${sel}&offset=${i * 1000}`).catch(() => [])))
  const all: any[] = pages.flat()
  return all.map((r) => {
    const ex = (r.extra && typeof r.extra === "object") ? r.extra : {}
    // 스펙(세그먼트 기준): 에어컨=냉방kW, 냉장고=용량L, TV=화면inch
    const spec = num(ex.cooling_kw) ?? num(ex.volume_l) ?? num(ex.screen_in)
    const stype = (ex.installation || ex.ref_type || ex.tv_type || "") as string
    const refrigerant = (ex.refrigerant || "") as string
    return { category: r.category, brand: r.brand, model: r.model_code || pnCode(r.product_name) || "", eff: num(r.efficiency_val), metric: r.efficiency_metric, star: num(r.star_rating), kwh: num(r.monthly_kwh), spec, stype, refrigerant, gwp: num(ex.gwp), asOf: r.as_of_date ?? null }
  })
}

export type PriceRange = { brand: string; n: number; p10: number; p25: number; med: number; p75: number; p90: number }
// 브랜드별 가격대 — competitor_prices 최신주 스냅샷 분위수(v_brand_price_ranges 뷰). catKo=에어컨/냉장고/TV/세탁기
export async function brandPriceRanges(catKo: string): Promise<PriceRange[]> {
  const rows = await sb(`v_brand_price_ranges?category=eq.${encodeURIComponent(catKo)}&select=brand,n,p10,p25,med,p75,p90&order=med.desc`)
  return rows.map((r) => ({ brand: r.brand as string, n: Number(r.n), p10: num(r.p10)!, p25: num(r.p25)!, med: num(r.med)!, p75: num(r.p75)!, p90: num(r.p90)! }))
}

export async function annualGroup(groupLabel: string) {
  const rows = await sb(`annual_indicators?group_label=eq.${encodeURIComponent(groupLabel)}&select=indicator,year,value&order=year`)
  return rows.map((r) => ({ indicator: r.indicator as string, year: Number(r.year), value: num(r.value)! }))
}

export async function latestOne(table: string, col: string) {
  const rows = await sb(`${table}?select=${col},date&order=date.desc&limit=1`)
  return rows[0] ? num(rows[0][col]) : null
}

export async function competitorTv(limit = 6) {
  const rows = await sb(
    `competitor_prices?category=eq.${encodeURIComponent("TV")}&brand=in.(LG,Samsung,Hisense,TCL)&select=brand,retailer,price_php,discount_pct,scraped_date&order=price_php.desc&limit=${limit}`,
  )
  return rows.map((r) => ({
    brand: r.brand,
    retailer: r.retailer,
    price: num(r.price_php)!,
    discount: num(r.discount_pct),
  }))
}

export async function latestNews(limit = 5) {
  const rows = await sb(`news_raw?select=title,source_domain,bucket,published_date&order=fetched_at.desc&limit=${limit}`)
  return rows.map((r) => ({ title: r.title, domain: r.source_domain, bucket: r.bucket, date: r.published_date }))
}

export async function newsBySheet(sheet: string, limit = 5) {
  const rows = await sb(
    `news_articles?sheet=eq.${sheet}&select=title,summary,ai_analysis,title_en,summary_en,ai_analysis_en,source_name,date,source_url,category,image_url&order=date.desc&limit=${limit}`,
  )
  return rows.map((r) => ({ title: r.title, summary: r.summary, ai: r.ai_analysis, titleEn: r.title_en, summaryEn: r.summary_en, aiEn: r.ai_analysis_en, source: r.source_name, date: r.date, url: r.source_url, category: r.category, image: r.image_url }))
}

export async function calendarRecent(pastN = 3, futureN = 6) {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const [past, fut] = await Promise.all([
    sb(`economic_calendar?date=lt.${today}&select=date,category,importance,event,release_time&order=date.desc&limit=${pastN}`),
    sb(`economic_calendar?date=gte.${today}&select=date,category,importance,event,release_time&order=date&limit=${futureN}`),
  ])
  const mk = (r: any, isPast: boolean) => ({ date: r.date as string, category: r.category, importance: r.importance, event: r.event, time: r.release_time, past: isPast })
  return [...past.reverse().map((r: any) => mk(r, true)), ...fut.map((r: any) => mk(r, false))]
}

export async function calendarUpcoming(limit = 7) {
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  const rows = await sb(
    `economic_calendar?date=gte.${today}&select=date,category,importance,event,release_time&order=date&limit=${limit}`,
  )
  return rows.map((r) => ({ date: r.date as string, category: r.category, importance: r.importance, event: r.event, time: r.release_time }))
}

export async function monthlyView(view: string) {
  const rows = await sb(`${view}?select=yr,mon,v&order=yr,mon`)
  return rows.map((r) => ({ yr: Number(r.yr), mon: Number(r.mon), v: num(r.v)! }))
}

export async function macroAll(indicator: string) {
  const rows = await sb(
    `macro_indicators?geo=eq.PHILIPPINES&indicator=eq.${indicator}&select=value,period_date&order=period_date`,
  )
  return rows.map((r) => ({ value: num(r.value)!, date: r.period_date as string }))
}

export async function rangeRows(table: string, col: string, start: string, end: string) {
  const rows = await sb(
    `${table}?select=${col},date&date=gte.${start}&date=lte.${end}&order=date`,
  )
  return rows.map((r) => ({ date: r.date as string, value: num(r[col])! }))
}

export async function competitorMovers(limit = 10) {
  const rows = await sb(
    `v_competitor_movers?select=retailer,brand,category,model,capacity,srp_php,promo_price,y_price,discount_pct,delta,chg_pct,abs_chg,reason,as_of,prev_date&order=abs_chg.desc&limit=${limit}`,
  )
  return rows.map((r) => ({
    retailer: r.retailer as string,
    brand: r.brand as string,
    category: r.category as string,
    model: r.model as string,
    capacity: (r.capacity ?? null) as string | null,
    srp: num(r.srp_php),
    promo: num(r.promo_price)!,
    yPromo: num(r.y_price)!,
    discount: num(r.discount_pct),
    delta: num(r.delta)!,
    pct: num(r.chg_pct)!,
    absChg: num(r.abs_chg)!,
    reason: r.reason as string,
    asOf: r.as_of as string,
    prevAsOf: r.prev_date as string,
  }))
}

export async function fxStrip() {
  const rows = await sb(`fx_daily?select=pair,label,rate,yoy_pct,biz_impact,as_of&order=as_of.desc`)
  if (!rows.length) return { asOf: null as string | null, pairs: {} as Record<string, any>, peers: [] as any[] }
  const asOf = rows[0].as_of
  const cur = rows.filter((r) => r.as_of === asOf)
  const pairs: Record<string, any> = {}
  const peers: any[] = []
  for (const r of cur) {
    const o = { label: r.label, rate: num(r.rate), yoy: num(r.yoy_pct), biz: r.biz_impact }
    if (String(r.pair).startsWith("PEER_")) peers.push(o)
    else pairs[r.pair] = o
  }
  return { asOf, pairs, peers }
}

/** 상황판 매트릭스 — 카테고리 × KPI.
 *  ⚠️ 시장 품절률은 LG의 유통 믹스로 보정된 값(v_category_kpi) — 합산 평균 비교 금지 룰. */
export async function categoryKpi() {
  const rows = await sb(
    `v_category_kpi?select=category,as_of,total_sku,lg_sku,shelf_share_pct,lg_oos_pct,mkt_oos_pct_adj,oos_gap_pp,lg_disc_pct,cn_disc_pct,disc_gap_pp,lg_asp,mkt_asp,premium_pct`,
  )
  return rows.map((r) => ({
    category: r.category as string,
    asOf: r.as_of as string,
    totalSku: num(r.total_sku)!,
    lgSku: num(r.lg_sku)!,
    shelfShare: num(r.shelf_share_pct)!,
    lgOos: num(r.lg_oos_pct),
    mktOos: num(r.mkt_oos_pct_adj),
    oosGap: num(r.oos_gap_pp),
    lgDisc: num(r.lg_disc_pct),
    cnDisc: num(r.cn_disc_pct),
    discGap: num(r.disc_gap_pp),
    lgAsp: num(r.lg_asp),
    mktAsp: num(r.mkt_asp),
    premium: num(r.premium_pct),
  }))
}

/** 홈 상단 밴드 8카드 — 시장 환경(원가·물가·수요·리스크)을 한눈에.
 *  dir: 'bad'  = 값↑이면 사업에 불리(원가·물가)
 *       'good' = 값↑이면 유리(수요·구매력)
 *       'neutral' = 방향 없음(태풍 등) */
export async function homeBand() {
  const rows = await sb(
    `v_home_band?select=seq,key,label,label_en,prefix,value,suffix,delta,delta_label,delta_mom,delta_yoy,delta_unit,dir,as_of,freq&order=seq.asc`,
  )
  return rows.map((r) => ({
    key: r.key as string,
    label: r.label as string,
    labelEn: (r.label_en ?? null) as string | null,
    prefix: (r.prefix ?? "") as string,
    value: r.value as string,
    suffix: (r.suffix ?? "") as string,
    delta: num(r.delta),
    deltaMom: num(r.delta_mom),
    deltaYoy: num(r.delta_yoy),
    deltaUnit: (r.delta_unit ?? "") as string,
    deltaLabel: r.delta_label as string,
    dir: r.dir as "bad" | "good" | "neutral",
    asOf: (r.as_of ?? null) as string | null,
    freq: r.freq as string,
  }))
}

/** 금주 핵심 — 하루 창은 가격만 움직여 가격 피드가 됨(seq=1이 상위를 다 차지).
 *  창을 7일로 넓히고 종류별 쿼터(재고2·가격1·거시2·태풍1·뉴스1)를 둬
 *  재고·거시·태풍·뉴스가 가격에 밀려 사라지지 않게 함. LG 재고는 항상 우선. */
export async function weekHighlights(limit = 5) {
  const rows = await sb(
    `v_week_highlights?select=as_of,kind,tone,subject,detail,source&limit=${limit}`,
  )
  return rows.map((r) => ({
    asOf: r.as_of as string,
    kind: r.kind as "price" | "stock" | "weather" | "news" | "macro",
    tone: r.tone as "bad" | "good" | "warn" | "neutral",
    subject: r.subject as string,
    detail: r.detail as string,
    source: r.source as string,
  }))
}

/** 경제 캘린더 — 이번 달 고정.
 *  기존 calendarRecent(과거3·미래6)는 창이 매일 밀려 같은 달인데도 이벤트가 바뀌었다.
 *  달 단위로 고정하면 "이번 달에 무엇이 있는가"가 매일 같은 답을 준다(일관성=브랜드). */
export async function calendarMonth() {
  const rows = await sb(
    `v_calendar_month?select=date,category,importance,event,event_en,release_time,past,today`,
  )
  return rows.map((r) => ({
    date: r.date as string,
    category: r.category as string,
    importance: r.importance as string,
    event: r.event as string,
    eventEn: (r.event_en ?? null) as string | null,
    time: r.release_time as string | null,
    past: Boolean(r.past),
    today: Boolean(r.today),
  }))
}

/** 지표별 미니차트 데이터 — 최근 12개 관측치(오래된 → 최신). 축 없는 추세용. */
export async function econSpark(): Promise<Record<string, number[]>> {
  const rows = await sb(`v_econ_spark?select=key,points`)
  const out: Record<string, number[]> = {}
  for (const r of rows) out[r.key as string] = (r.points ?? []).map((v: any) => Number(v))
  return out
}

/** 지표 시계열 — 최근 12개 관측치 + 전년 동기 값(있는 경우).
 *  레일에서 접힌 줄은 추세 미리보기, 펼치면 경제지표 페이지와 같은 차트를 그린다. */
export type EconSeries = { dates: string[]; points: number[]; prev: (number | null)[] }
export async function econSeries(): Promise<Record<string, EconSeries>> {
  const rows = await sb(`v_econ_series?select=key,dates,points,prev`)
  const out: Record<string, EconSeries> = {}
  for (const r of rows) {
    out[r.key as string] = {
      dates: (r.dates ?? []) as string[],
      points: ((r.points ?? []) as any[]).map((v) => Number(v)),
      prev: ((r.prev ?? []) as any[]).map((v) => (v == null ? null : Number(v))),
    }
  }
  return out
}

/** 이번 주 분석 — 자체 칼럼 + 외부 큐레이션.
 *  외부 글은 원문을 저장하지 않는다(전재 금지) — 요약·해석·링크만. */
export async function analysisPosts(limit = 4) {
  const rows = await sb(
    `analysis_posts?select=id,published_at,kind,title,dek,summary,body_md,why_matters,title_en,dek_en,summary_en,body_en,why_matters_en,source_name,source_url,image_url,tags,confidence,author&order=published_at.desc&limit=${limit}`,
  )
  return rows.map((r) => ({
    id: Number(r.id),
    publishedAt: r.published_at as string,
    kind: r.kind as "own" | "external",
    title: r.title as string,
    titleEn: (r.title_en ?? null) as string | null,
    dek: (r.dek ?? null) as string | null,
    dekEn: (r.dek_en ?? null) as string | null,
    summaryEn: (r.summary_en ?? null) as string | null,
    bodyEn: (r.body_en ?? null) as string | null,
    whyMattersEn: (r.why_matters_en ?? null) as string | null,
    summary: (r.summary ?? null) as string | null,
    body: (r.body_md ?? null) as string | null,
    whyMatters: (r.why_matters ?? "") as string,
    source: (r.source_name ?? "") as string,
    url: (r.source_url ?? null) as string | null,
    image: (r.image_url ?? null) as string | null,
    tags: (r.tags ?? []) as string[],
    confidence: (r.confidence ?? "") as string,
    author: (r.author ?? null) as string | null,
  }))
}

/** 지난 7일 브리핑 아카이브 — 승인 이력이 곧 판단의 로그 */
export async function briefArchive() {
  const rows = await sb(
    `v_brief_archive?select=as_of,status,approved_by,head,n_lines,weekly_call,weekly_owner`,
  )
  return rows.map((r) => ({
    asOf: r.as_of as string,
    status: r.status as "draft" | "approved",
    approvedBy: (r.approved_by ?? null) as string | null,
    head: (r.head ?? "") as string,
    nLines: Number(r.n_lines ?? 0),
    weeklyCall: (r.weekly_call ?? null) as string | null,
    weeklyOwner: (r.weekly_owner ?? null) as string | null,
  }))
}

/** 우리 위치 = 워치리스트 (유통 × 카테고리).
 *  ⚠️ 순위표 아님 — 액션 목록. shelf는 SKU 개수 기준이며 매출 점유율이 아님. */
export async function watchlist(limit = 4) {
  const rows = await sb(
    `v_watchlist?select=as_of,retailer,category,lg_n,total_n,shelf_pct,lg_oos,mkt_oos,oos_gap,lg_disc,cn_disc,disc_gap,verdict&limit=${limit}`,
  )
  return rows.map((r) => ({
    asOf: r.as_of as string,
    retailer: r.retailer as string,
    category: r.category as string,
    lgN: num(r.lg_n)!,
    totalN: num(r.total_n)!,
    shelf: num(r.shelf_pct)!,
    lgOos: num(r.lg_oos),
    mktOos: num(r.mkt_oos),
    oosGap: num(r.oos_gap),
    lgDisc: num(r.lg_disc),
    cnDisc: num(r.cn_disc),
    discGap: num(r.disc_gap),
    verdict: r.verdict as "risk" | "chance" | "watch",
  }))
}

/** 데이터 신뢰 패널 — 각 소스가 언제 마지막으로 성공했는가.
 *  expected_lag(정상 발표 지연)를 반영 — BSP 송금은 원래 2~3개월 늦다. */
export async function ingestHealth() {
  const rows = await sb(
    `v_ingest_health?select=seq,src,freq,expected_lag,last_at,days_old,vol,status&order=seq.asc`,
  )
  return rows.map((r) => ({
    src: r.src as string,
    freq: r.freq as string,
    lastAt: r.last_at as string,
    daysOld: num(r.days_old),
    vol: num(r.vol),
    status: r.status as "ok" | "warn" | "stale" | "dead",
  }))
}

/** 오늘의 핵심 — AI 초안 3줄 + 근거 + 이번 주 판단.
 *  status: 'draft'(AI INTERPRETED) → 사람 승인 → 'approved'(CONFIRMED) */
export async function todayBrief() {
  const rows = await sb(
    `daily_brief?select=as_of,lines,lines_en,weekly_call,weekly_owner,weekly_due,status,approved_by,approved_at&order=as_of.desc&limit=1`,
  )
  if (!rows.length) return null
  const r = rows[0]
  return {
    asOf: r.as_of as string,
    lines: (r.lines ?? []) as { text: string; evidence?: string }[],
    linesEn: (r.lines_en ?? null) as { text: string; evidence?: string }[] | null,
    weeklyCall: (r.weekly_call ?? null) as string | null,
    weeklyOwner: (r.weekly_owner ?? null) as string | null,
    weeklyDue: (r.weekly_due ?? null) as string | null,
    status: r.status as "draft" | "approved",
    approvedBy: (r.approved_by ?? null) as string | null,
  }
}

/** 승인 — 철학 3원칙(사람이 최종 판단자)의 실제 작동부.
 *  배지만 달고 버튼이 없으면 원칙은 장식이 된다. */
export async function approveBrief(asOf: string, by: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(`${url}/rest/v1/daily_brief?as_of=eq.${asOf}`, {
    method: "PATCH",
    headers: {
      apikey: key as string,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "approved",
      approved_by: by,
      approved_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`approve failed ${res.status}`)
}

/** 각 데이터 소스의 최종 적재 시각(created_at). 카드 헤더 "최종 갱신 MM/DD HH:MM" 표기용 */
export async function freshness(): Promise<Record<string, string>> {
  const rows = await sb("v_freshness?select=src,last_at")
  const out: Record<string, string> = {}
  for (const r of rows) if (r?.src && r?.last_at) out[r.src] = r.last_at
  return out
}

/** ISO timestamp → "07/13 18:43" (Asia/Manila) */
export function fmtStamp(iso?: string | null, en = false) {
  if (!iso) return "—"
  const d = new Date(iso)
  const p = new Intl.DateTimeFormat(en ? "en-US" : "ko-KR", {
    timeZone: "Asia/Manila",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00"
  return `${g("month")}/${g("day")} ${g("hour")}:${g("minute")}`
}

/** 경쟁사 가격 — 최근 3일 피벗(v_competitor_3d). 표·CSV·KPI 모두 이 한 벌을 쓴다. */
export type PriceRow = {
  retailer: string
  brand: string
  category: string
  model: string
  code: string
  capacity: string | null
  srp: number | null
  p0: number | null
  p1: number | null
  p2: number | null
  d0: string
  d1: string | null
  d2: string | null
  deltaPhp: number | null
  deltaPct: number | null
  delta3Pct: number | null
  discountPct: number | null
  url: string | null
  availability: string | null
  image: string | null
  prices7: number[] | null
  p7: number | null
  p3: number | null
  d3: string | null
}

/** HTML 엔티티 정리 — 스크래핑 원문에 &#8211; &amp; 등이 섞여 들어온다 */
function clean(s: string) {
  return (s || "")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim()
}

/** 모델 suffix(모델코드) — 항상 값을 만든다.
 *  ① 제목에서 영문+숫자 코드 토큰 → ② URL slug에서 같은 규칙 → ③ 그래도 없으면 제목을 압축한 약식코드.
 *  "—"는 만들지 않는다. 표에서 행을 특정할 수 없으면 데이터가 쓸모없기 때문.
 */
function pickCode(text: string) {
  /** 모델코드는 숫자로 시작할 수 있다(24MR400-B, 100QNED86BS) — 숫자 시작을 막으면 안 된다.
   *  대신 용량·인치·해상도 같은 "스펙 토큰"만 걸러낸다. */
  const bad = /^(KG|CU|FT|INCH|HP|TON|LED|OLED|QNED|NANO|SMART|TV|BUNDLE|MODEL|NEW|SALE|LG|SAMSUNG|SHARP|HISENSE|TCL|PANASONIC|MIDEA|CARRIER|SONY|WHIRLPOOL|CONDURA|FUJIDENZO|UHD|FHD|HD|4K|8K)$/i
  const unit = /^\d+(\.\d+)?(KG|L|W|K|CM|CUFT|CU|FT|HP|TON|INCH|IN|MM|HZ)$/i
  const cands = (text || "")
    .split(/[\s(),/_+]+/)
    .map((x) => x.replace(/[^A-Za-z0-9.-]+$/g, "").replace(/^[^A-Za-z0-9]+/g, ""))
    .filter((u) => {
      if (u.length < 4 || u.length > 24) return false
      if (!/[A-Za-z]/.test(u) || !/\d/.test(u)) return false
      if (bad.test(u) || unit.test(u)) return false
      if (/^(19|20)\d\d$/.test(u)) return false
      return (u.match(/\d/g) || []).length >= 2
    })
  return cands.length ? cands[cands.length - 1].toUpperCase() : ""
}

function modelCode(model: string, url?: string | null) {
  const title = clean(model)
  const fromTitle = pickCode(title)
  if (fromTitle) return fromTitle

  if (url) {
    const slug = decodeURIComponent(String(url).split("?")[0].split("#")[0].split("/").filter(Boolean).pop() ?? "")
      .replace(/\.(html?|php|aspx?)$/i, "")
      .replace(/-/g, " ")
    const fromUrl = pickCode(slug)
    if (fromUrl) return fromUrl
  }

  /** 코드가 아예 없는 리스팅(주로 TV) — 제목을 약식코드로 압축해 행을 특정 가능하게 만든다 */
  const words = title
    .replace(/\b(20\d\d|Model|Smart|Inch|inches|New|Sale|with|and|the)\b/gi, " ")
    .split(/[\s(),/]+/)
    .filter(Boolean)
  const short = words
    .slice(0, 4)
    .map((w) => (/^\d/.test(w) ? w : w.slice(0, 4)))
    .join("-")
    .toUpperCase()
  return short ? "≈" + short : "N/A"
}

/** 카테고리 재분류 — 스크래퍼는 매장 메뉴(4개 버킷)를 그대로 쓰지만,
 *  실제 리스팅에는 제습기·모니터·사이니지·오디오·냉동고·건조기가 섞여 있다.
 *  제품 성격이 다르면 가격 비교의 의미도 다르므로 제목 기준으로 다시 나눈다. */
const CAT_RULES: { t: string; re: RegExp }[] = [
  { t: "제습기", re: /dehumidif/i },
  { t: "공기청정기", re: /air ?purifier|purifier|puricare|air ?cleaner|aero ?booster/i },
  { t: "정수기", re: /water (purifier|dispenser)/i },
  { t: "청소기", re: /vacuum|cordzero|stick clean/i },
  { t: "오디오", re: /soundbar|sound bar|speaker|xboom|home theater|audio system/i },
  { t: "모니터", re: /monitor|ultragear|ultrawide|gaming display/i },
  { t: "사이니지", re: /signage|video wall|commercial display|interactive touch/i },
  { t: "프로젝터", re: /projector|cinebeam/i },
  { t: "전자레인지·오븐", re: /microwave|oven|air fryer/i },
  { t: "냉동고", re: /chest freezer|upright freezer|\bfreezer\b/i },
  // 건조기는 세탁기 카테고리에 포함(대시보드에서 유형으로 구분). 워시타워·콤보·단독 건조기 모두 세탁기.
  { t: "세탁기", re: /wash ?tower|washtower|워시타워|washing machine|washer|twin ?wash|laundry|\bdryer\b|heat pump dry/i },
  { t: "냉장고", re: /refrigerator|fridge|side by side|inverter ref\b/i },
  // 에어컨을 RAC/SAC로 분리. SAC(스탠드·천장·카세트·멀티스플릿·VRF·덕트)를 먼저, 나머지 aircon은 RAC(창문·벽걸이).
  { t: "SAC", re: /cassette|ceiling|천장|floor ?(?:mount|standing)|스탠드|multi[- ]?split|multi[- ]?v\b|\bvrf\b|\bvrv\b|ducted|concealed|\bZTNQ|\bZPNQ|\bZVNQ|\bZ\dUQ|\bZUAB|AMNQ|\bAC0\d{2}[A-Z]|53C[LNF]V|53KFV/i },
  { t: "RAC", re: /aircon|air ?condition|split type|window type|hvac|\bacu\b|\bHS[NU]?\d{2}|WCAR[A-Z]|WCON[A-Z]|WRAC|\bLA\d{3}/i },
  { t: "TV", re: /\btv\b|oled|qned|nano ?cell|uhd|4k smart|led tv/i },
]

function classify(model: string, fallback: string) {
  const t = clean(model)
  for (const r of CAT_RULES) if (r.re.test(t)) return r.t
  // 스크래퍼 원본 카테고리가 '에어컨'인데 규칙 미매칭 시 RAC로(창문/벽걸이 기본)
  if (fallback === "에어컨") return "RAC"
  return fallback ?? "기타"
}

// 브랜드 추론 — 일부 스크랩(예: Western Appliances)은 brand가 비고 model 첫 토큰에 브랜드명이 박혀 있음
//  ("Prestiz WPREU4002" · "Skyworth 65GE6200"). 첫 토큰이 순수 알파벳(숫자 없음)이면 브랜드로 채택. brand 있으면 미적용.
function inferBrand(model: string | null): string | null {
  if (!model) return null
  const first = String(model).trim().split(/\s+/)[0] || ""
  return first.length >= 2 && /^[A-Za-z][A-Za-z.&'-]+$/.test(first) ? first : null
}
export async function competitorTable(max = 6000): Promise<PriceRow[]> {
  const rows = await sbPaged(
    (off) => "v_competitor_3d?select=*&order=brand.asc,category.asc,model.asc&offset=" + off + "&limit=1000",
    max,
  )
  return rows.map((r: any) => {
    const p0 = num(r.p0)
    const p1 = num(r.p1)
    const p2 = num(r.p2)
    return {
      retailer: r.retailer,
      brand: r.brand || inferBrand(r.model),
      category: classify(r.model, r.category),
      model: clean(r.model),
      code: modelCode(r.model, r.url),
      capacity: r.capacity ?? null,
      srp: num(r.srp),
      p0,
      p1,
      p2,
      d0: r.d0,
      d1: r.d1 ?? null,
      d2: r.d2 ?? null,
      deltaPhp: p0 != null && p1 != null ? p0 - p1 : null,
      deltaPct: p0 != null && p1 != null && p1 !== 0 ? ((p0 - p1) / p1) * 100 : null,
      delta3Pct: p0 != null && p2 != null && p2 !== 0 ? ((p0 - p2) / p2) * 100 : null,
      discountPct: num(r.discount_pct),
      url: r.url ?? null,
      availability: r.availability ?? null,
      image: r.image_url ?? null,
      prices7: Array.isArray(r.prices7) ? r.prices7.map((x: any) => num(x)).filter((x: any): x is number => x != null) : null,
      p7: num(r.p7),
      p3: num(r.p3),
      d3: r.d3 ?? null,
    }
  })
}

/** 품절 연속일수 — 특정 브랜드×거래선의 모델별 '재고없음 며칠째'(최근일부터 연속 OutOfStock). competitor_prices 일자별 이력. */
export async function oosStreaks(brand: string, retailer: string): Promise<Record<string, number>> {
  const rows = await sb(`competitor_prices?brand=eq.${encodeURIComponent(brand)}&retailer=eq.${encodeURIComponent(retailer)}&select=model,scraped_date,availability&order=scraped_date.desc&limit=4000`)
  const byModel: Record<string, { d: string; a: string }[]> = {}
  for (const r of rows) { const m = r.model as string; if (!m) continue; (byModel[m] = byModel[m] || []).push({ d: r.scraped_date, a: r.availability }) }
  const out: Record<string, number> = {}
  for (const m of Object.keys(byModel)) {
    const arr = byModel[m].sort((x, y) => (y.d || "").localeCompare(x.d || "")) // 최신 먼저
    let streak = 0
    for (const it of arr) { if (it.a === "OutOfStock") streak++; else break }
    out[m] = streak
  }
  return out
}

/** 경쟁사 일간 스냅샷 — LG 전용, v_competitor_daily. board 달력(과거 특정일 피벗)용. 하루×거래선×모델 최저가. */
export type DailyRow = {
  d: string
  retailer: string
  brand: string
  category: string
  model: string
  code: string
  capacity: string | null
  price: number | null
  srp: number | null
  url: string | null
}

const DAILY_SELECT = "select=d,retailer,brand,category,model,capacity,price,srp,url&order=d.desc"
const mapDaily = (r: any): DailyRow => ({
  d: r.d,
  retailer: r.retailer,
  brand: r.brand,
  category: classify(r.model, r.category),
  model: clean(r.model),
  code: modelCode(r.model, r.url),
  capacity: r.capacity ?? null,
  price: num(r.price),
  srp: num(r.srp),
  url: r.url ?? null,
})

export async function competitorDaily(max = 20000): Promise<DailyRow[]> {
  // 필요한 컬럼만 선택(payload↓) + 전 페이지 1웨이브 병렬(직렬 대비 대폭 단축). board 이력 네비게이터용.
  const rows = await sbPaged((off) => "v_competitor_daily?" + DAILY_SELECT + "&offset=" + off + "&limit=1000", max)
  return rows.map(mapDaily)
}

/** board 즉시 렌더용 — 최신일(+직전 일부) 약 6페이지만 한 웨이브로 병렬 로딩(실측 ~0.6s).
 *  전체 이력은 competitorDaily가 백그라운드로 이어받아 달력 네비게이터를 채운다. */
export async function competitorDailyLatest(pages = 6): Promise<DailyRow[]> {
  const chunks = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      sb("v_competitor_daily?" + DAILY_SELECT + "&offset=" + i * 1000 + "&limit=1000").catch(() => [] as any[])),
  )
  const rows: any[] = []
  for (const c of chunks) { rows.push(...(c ?? [])); if (!c || c.length < 1000) break }
  return rows.map(mapDaily)
}

/** 경쟁사 프로모 딜 — v_competitor_promo(최근 3일·프로모 있는 리스팅). 프로모 페이지용. */
export type DealRow = {
  d: string
  retailer: string
  brand: string
  category: string
  model: string
  capacity: string | null
  price: number | null
  srp: number | null
  discount: number | null
  promo: string
  url: string | null
}

export async function promoDeals(max = 6000): Promise<DealRow[]> {
  const rows = await sbPaged(
    (off) => "v_competitor_promo?select=*&order=discount_pct.desc.nullslast&offset=" + off + "&limit=1000",
    max,
  )
  return rows.map((r: any) => ({
    d: r.d,
    retailer: r.retailer,
    brand: r.brand,
    category: classify(r.model, r.category),
    model: clean(r.model),
    capacity: r.capacity ?? null,
    price: num(r.price_php),
    srp: num(r.srp_php),
    discount: num(r.discount_pct),
    promo: r.promo_text ?? "",
    url: r.url ?? null,
  }))
}

/** 정부 규제 동향 — 통관·물류·세무·관세·표준. Critical 우선, 최신순 */
export type RegAlert = {
  id: number
  date: string
  effectiveDate: string | null
  agency: string
  docNo: string | null
  category: string
  severity: "Critical" | "High" | "Medium"
  title: string
  titleEn: string | null
  summary: string
  summaryEn: string | null
  implication: string | null
  actions: string | null
  source: string
  url: string
}

export async function regAlerts(limit = 5): Promise<RegAlert[]> {
  const rows = await sb("v_reg_alerts?select=*&limit=" + limit)
  return (rows ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    effectiveDate: r.effective_date ?? null,
    agency: r.agency,
    docNo: r.doc_no ?? null,
    category: r.category,
    severity: r.severity,
    title: r.title,
    titleEn: r.title_en ?? null,
    summary: r.summary,
    summaryEn: r.summary_en ?? null,
    implication: r.implication ?? null,
    actions: r.actions ?? null,
    source: r.source,
    url: r.url,
  }))
}


/** ── 주요뉴스(/news) ─────────────────────────────────────────
 *  피드는 "기사 나열"이 아니다. 각 행은 제목·메타·지표칩·SO WHAT 4요소를 갖는다.
 *  SO WHAT(ai_analysis)이 없는 기사는 행으로 나가지 않는다. */
export type FeedItem = {
  id: number
  date: string
  topic: string
  product: string
  chipKeys: string[]
  title: string
  titleEn: string | null
  summary: string
  summaryEn: string | null
  ai: string
  aiEn: string | null
  source: string
  url: string
  image: string | null
  confidence: string
}

/** days = 0 이면 전체 기간(누적 425건). 창을 좁히면 기사가 사라지는 게 아니라 안 보이는 것뿐이다. */
export async function newsFeed(days = 30): Promise<FeedItem[]> {
  let path = "v_news_feed?select=*&order=date.desc,id.desc&limit=5000"
  if (days > 0) {
    const d = new Date(Date.now() - days * 86400000)
    path = "v_news_feed?select=*&date=gte." + d.toISOString().slice(0, 10) + "&order=date.desc,id.desc&limit=5000"
  }
  const rows = await sb(path)
  return (rows ?? []).map((r: any) => ({
    id: Number(r.id),
    date: r.date,
    topic: r.topic ?? "기타",
    product: r.product ?? "전 제품 영향",
    chipKeys: (r.chip_keys ?? []) as string[],
    title: r.title,
    titleEn: r.title_en ?? null,
    summary: r.summary ?? "",
    summaryEn: r.summary_en ?? null,
    ai: r.ai_analysis ?? "",
    aiEn: r.ai_analysis_en ?? null,
    source: r.source_name ?? "",
    url: r.source_url,
    image: r.image_url ?? null,
    confidence: r.confidence ?? "",
  }))
}

/** 뉴스가 움직인 지표 — 기사 chip_keys와 조인해 칩으로 렌더 */
export type Chip = {
  k: string
  label: string
  value: number | null
  unit: string
  deltaPct: number | null
  /** 물가·금리처럼 값 자체가 %인 지표는 상대변화율이 아니라 %p 절대차 */
  deltaUnit: string
  asOf: string | null
  freq: "daily" | "weekly" | "monthly"
}

export async function indicatorChips(): Promise<Record<string, Chip>> {
  const rows = await sb("v_indicator_chips?select=*")
  const out: Record<string, Chip> = {}
  for (const r of rows ?? []) {
    out[r.k] = {
      k: r.k,
      label: r.label,
      value: num(r.value),
      unit: r.unit ?? "",
      deltaPct: num(r.delta_pct),
      deltaUnit: r.delta_unit ?? "%",
      asOf: r.as_of ?? null,
      freq: (r.freq ?? "daily") as "daily" | "weekly" | "monthly",
    }
  }
  return out
}

/** 규제 액션보드 — Critical/High만 피드에 섞는다. d_day ≤ 7이면 최상단 */
export type RegBoardItem = {
  id: number
  date: string
  dDay: number | null
  agency: string
  category: string
  severity: "Critical" | "High" | "Medium"
  title: string
  titleEn: string | null
  summary: string
  summaryEn: string | null
  implication: string | null
  actions: string | null
  source: string
  url: string
}

export async function regBoard(limit = 30): Promise<RegBoardItem[]> {
  const rows = await sb("v_reg_board?select=*&limit=" + limit)
  return (rows ?? []).map((r: any) => ({
    id: Number(r.id),
    date: r.date,
    dDay: r.d_day == null ? null : Number(r.d_day),
    agency: r.agency,
    category: r.category,
    severity: r.severity,
    title: r.title,
    titleEn: r.title_en ?? null,
    summary: r.summary ?? "",
    summaryEn: r.summary_en ?? null,
    implication: r.implication ?? null,
    actions: r.actions ?? null,
    source: r.source ?? "",
    url: r.url,
  }))
}


/** 이번 주(월~일) 요약 — 지표 발표(캘린더)와 규제 시행일을 한 줄에 섞어 본다.
 *  "지나간 일"과 "남은 일정"을 나누면 주 단위로 무엇이 끝났고 무엇이 남았는지 한눈에 잡힌다. */
export type WeekItem = {
  src: "cal" | "reg"
  date: string
  category: string
  label: string
  labelEn: string | null
  past: boolean
  severity: string | null
  sourceLabel: string | null
  agency: string | null
}

export async function weekDigest(): Promise<WeekItem[]> {
  const rows = await sb("v_week_digest?select=*")
  return (rows ?? []).map((r: any) => ({
    src: r.src,
    date: r.date,
    category: r.category,
    label: (r.label ?? "").trim(),
    labelEn: r.label_en ? String(r.label_en).trim() : null,
    past: Boolean(r.past),
    severity: r.severity ?? null,
    sourceLabel: r.source_label ?? null,
    agency: r.agency ?? null,
  }))
}

/* ── 프로모 강도 (가격 데이터에서 도출) ───────────────────────────── */
export type PromoIntensity = {
  brand: string
  retailer: string
  asOf: string
  promoModels: number
  listedModels: number
  avgDiscount: number | null
  promoModelsWow: number
  avgDiscountWowPp: number | null
}

export async function promoIntensity(limit = 12) {
  const rows = await sb(`v_promo_intensity?select=*&limit=${limit}`)
  return rows.map((r) => ({
    brand: r.brand as string,
    retailer: r.retailer as string,
    asOf: r.as_of as string,
    promoModels: num(r.promo_models) ?? 0,
    listedModels: num(r.listed_models) ?? 0,
    avgDiscount: num(r.avg_discount_pct),
    promoModelsWow: num(r.promo_models_wow) ?? 0,
    avgDiscountWowPp: num(r.avg_discount_wow_pp),
  })) as PromoIntensity[]
}

/* ── 유통사 프로모 캠페인 ─────────────────────────────────────────── */
export type PromoCampaign = {
  retailer: string
  kind: string
  title: string
  url: string | null
  brands: string[]
  liveDiscounted: number | null
  avgDiscount: number | null
  maxDiscount: number | null
  onSaleCount: number | null
  collectedDate: string
}

export async function promoCampaigns() {
  const rows = await sb('v_promo_campaigns?select=*')
  return rows.map((r) => ({
    retailer: r.retailer as string,
    kind: r.kind as string,
    title: r.title as string,
    url: (r.url ?? null) as string | null,
    brands: (r.brands ?? []) as string[],
    liveDiscounted: num(r.live_discounted),
    avgDiscount: num(r.avg_discount_pct),
    maxDiscount: num(r.max_discount_pct),
    onSaleCount: num(r.on_sale_count),
    collectedDate: r.collected_date as string,
  })) as PromoCampaign[]
}

/* ── 경제캘린더 ─────────────────────────────────────────────────── */
export type CalEvent = {
  date: string
  category: string
  importance: number
  event: string
  event_en: string | null
  releaseTime: string | null
  indicatorKey: string | null
  kind: string
  actual: number | null
  previous: number | null
  forecast: string | null
  unit: string | null
  past: boolean
  today: boolean
  sourceLabel: string | null
  agency: string | null
  summary: string | null
  implication: string | null
  actions: string | null
  source: string | null
  url: string | null
}

export async function calendarEvents(from: string, to: string) {
  const rows = await sb(
    `v_calendar_month?select=*&date=gte.${from}&date=lte.${to}&order=date.asc`,
  )
  return rows.map((r) => ({
    date: r.date as string,
    category: (r.category ?? "기타") as string,
    importance: String(r.importance ?? "").length,
    event: r.event as string,
    event_en: (r.event_en ?? null) as string | null,
    releaseTime: (r.release_time ?? null) as string | null,
    indicatorKey: (r.indicator_key ?? null) as string | null,
    kind: (r.kind ?? "other") as string,
    actual: num(r.actual),
    previous: num(r.previous),
    forecast: (r.forecast ?? null) as string | null,
    unit: (r.unit ?? null) as string | null,
    past: Boolean(r.past),
    today: Boolean(r.today),
    sourceLabel: (r.source_label ?? null) as string | null,
    agency: (r.agency ?? null) as string | null,
    summary: (r.summary ?? null) as string | null,
    implication: (r.implication ?? null) as string | null,
    actions: (r.actions ?? null) as string | null,
    source: (r.source ?? null) as string | null,
    url: (r.url ?? null) as string | null,
  })) as CalEvent[]
}

// ── 예정 일정(2주) — 캘린더 페이지 우측 위젯과 경제지표 페이지 위젯이 공유하는 단일 소스.
//    로직: v_calendar_month(월초~+3개월) → kind!=other(공휴일 예외) 필터 → 오늘~+14일 창 +
//    트리거(급여일·이커머스 대형세일·전기요금 변동) 병합 → 날짜순 → 상위 10.
export type AgendaItem = { date: string; label: string; note: string; dot: string; category: string; ev?: CalEvent }
const CAT_DOT: Record<string, string> = { 경제: "bg-emerald-500", 금융: "bg-blue-500", 정치: "bg-purple-500", 규제: "bg-red-500", 에너지: "bg-amber-500", 유통: "bg-violet-500", 공휴일: "bg-teal-500", 사회: "bg-pink-500", 통상: "bg-cyan-500", 기타: "bg-gray-400" }
const KIND_LABEL: Record<string, string> = { release: "지표 발표", policy: "정책·규제", holiday: "공휴일" }
const KIND_LABEL_EN: Record<string, string> = { release: "Data Release", policy: "Policy·Regulation", holiday: "Holiday" }
// 카테고리 '표시'용 영문(enum 비교 키는 그대로) — ko 표시는 규제→정책으로 접어 보여줌
const AG_CAT_EN: Record<string, string> = { 경제: "Economy", 금융: "Finance", 정치: "Politics", 규제: "Policy", 에너지: "Energy", 유통: "Retail", 공휴일: "Holiday", 사회: "Society", 통상: "Trade", 정책: "Policy", 기타: "Other" }
const agHead = (s: string) => s.split(/[—–]/)[0].replace(/\s*\(.*?\)\s*$/, "").trim()
// 렌더/호출 시점 평가 — pickL이 최신 언어를 참조하도록 함수로 유지(모듈 상수에 굳히지 않음)
const kindLabel = (k: string) => pickL(KIND_LABEL[k] || "", KIND_LABEL_EN[k] || "")
const agCat = (c: string) => pickL(c === "규제" ? "정책" : c, AG_CAT_EN[c] ?? c)

export async function upcomingAgenda(): Promise<AgendaItem[]> {
  const t = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  const isoD = (d: Date) => d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
  const monthStart = new Date(t.getFullYear(), t.getMonth(), 1)
  const end = new Date(t.getFullYear(), t.getMonth() + 3, 0)
  const all = (await calendarEvents(isoD(monthStart), isoD(end))).filter((x) => x.kind !== "other" || x.category === "공휴일")
  const t0 = isoD(t)
  const t14 = isoD(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 14))
  const items: AgendaItem[] = []
  for (const r of all) {
    if (r.date >= t0 && r.date <= t14) items.push({ date: r.date, label: agHead(pickL(r.event, r.event_en)), note: agCat(r.category) + " · " + kindLabel(r.kind), dot: CAT_DOT[r.category] ?? CAT_DOT["기타"], category: r.category, ev: r })
  }
  // 트리거(캘린더 페이지와 동일)
  const y = t.getFullYear(), mo = t.getMonth(), dd = t.getDate()
  const eom = new Date(y, mo + 1, 0).getDate()
  const nextPay = dd < 15 ? new Date(y, mo, 15) : dd < eom ? new Date(y, mo + 1, 0) : new Date(y, mo + 1, 15)
  const trg: AgendaItem[] = [{ date: isoD(nextPay), label: pickL("급여일", "Payday"), note: pickL("오프라인 가전 구매 스파이크", "Offline appliance-purchase spike"), dot: "bg-emerald-500", category: "경제" }]
  const sales = ["2026-08-08", "2026-09-09", "2026-10-10", "2026-11-11", "2026-12-12"]
  const ns = sales.find((s) => s >= t0)
  if (ns) trg.push({ date: ns, label: pickL("이커머스 대형세일", "E-commerce mega sale"), note: ns.slice(5).replace("-", ".") + pickL(" 메가세일", " Mega Sale"), dot: "bg-violet-500", category: "유통" })
  const elec = all.filter((r) => r.category === "에너지" && (r.event.includes("전기요금") || r.event.includes("Meralco")) && r.date >= t0).sort((a, b) => a.date.localeCompare(b.date))[0]
  if (elec) trg.push({ date: elec.date, label: pickL("전기요금 변동", "Electricity tariff change"), note: pickL("냉방가전 사용부담 좌우", "Drives cooling-appliance running cost"), dot: "bg-amber-500", category: "에너지" })
  for (const x of trg) if (x.date >= t0 && x.date <= t14) items.push(x)
  items.sort((a, b) => a.date.localeCompare(b.date))
  return items.slice(0, 10)
}

export async function macroMonthly(inds: string[], n = 18) {
  const list = inds.map((s) => encodeURIComponent(s)).join(",")
  // PostgREST 행 상한(서버 하드캡 1000, limit로 상향 불가) 대응 — offset 페이지네이션으로 전량 수집.
  // 미대응 시 asc 정렬에서 최신 데이터가 잘려 차트가 과거에서 끊김(백필로 행이 늘면 재현).
  const rows: { indicator: string; period_date: string; value: number }[] = []
  for (let off = 0; off < 40000; off += 1000) {
    const page = (await sb(
      "macro_indicators?geo_level=eq.national&indicator=in.(" + list +
      ")&order=period_date.asc&select=indicator,period_date,value&limit=1000&offset=" + off,
    )) as { indicator: string; period_date: string; value: number }[]
    rows.push(...page)
    if (page.length < 1000) break
  }
  const out: Record<string, { dates: string[]; values: number[] }> = {}
  for (const r of rows) {
    const g = (out[r.indicator] = out[r.indicator] || { dates: [], values: [] })
    g.dates.push(r.period_date)
    g.values.push(Number(r.value))
  }
  for (const k in out) {
    if (out[k].dates.length > n) {
      out[k].dates = out[k].dates.slice(-n)
      out[k].values = out[k].values.slice(-n)
    }
  }
  return out
}

// 시장규모 다중기관 추정 백데이터 (market_estimates) — 범위·근거 제시용
export type MktEst = { metric: string; source: string; value: number; unit: string; year: number; cagr: number | null; scope: string | null; url: string | null; note: string | null }
export async function marketEstimates(metric: string): Promise<MktEst[]> {
  const rows = (await sb("market_estimates?metric=eq." + encodeURIComponent(metric) + "&select=*&order=value.desc")) as MktEst[]
  return rows
}

// 데이터 출처·검증 — 전 지표의 출처/원본코드/기간/신뢰도 (v_data_provenance 뷰)
export type Provenance = { indicator: string; label: string; source: string; source_ref: string | null; confidence: string | null; levels: string | null; mn: string; mx: string; n: number }
export async function dataProvenance(): Promise<Provenance[]> {
  const rows = (await sb("v_data_provenance?select=*&order=source.asc,indicator.asc&limit=1000")) as Provenance[]
  return rows
}

// 전 국가지표 최신값 — { [indicator]: {value, period, prev} } (전체 지표 리스트용)
// v_latest_indicator: indicator별 최신 관측 1행(+직전값). 1000행 캡 안전(≈194 지표)
export async function allIndicatorLatest(): Promise<Record<string, { value: number; period: string; prev: number | null }>> {
  const rows = (await sb(
    "v_latest_indicator?select=indicator,value,period_date,prev_value"
  )) as { indicator: string; value: number; period_date: string; prev_value: number | null }[]
  const out: Record<string, { value: number; period: string; prev: number | null }> = {}
  for (const r of rows) out[r.indicator] = { value: Number(r.value), period: r.period_date, prev: r.prev_value == null ? null : Number(r.prev_value) }
  return out
}

// 단일 지표 전체 시계열(국가지표) — 자세히보기·엑셀 다운로드용
export async function indicatorSeries(indicator: string): Promise<{ date: string; value: number }[]> {
  const rows = (await sb(
    "macro_indicators?geo=in.(PHILIPPINES,PH)&indicator=eq." + encodeURIComponent(indicator) + "&select=value,period_date&order=period_date.asc&limit=3000"
  )) as { value: number; period_date: string }[]
  return rows.map((r) => ({ date: r.period_date, value: Number(r.value) }))
}

// 지역별 지표(geo_level='region') 최신값 — { [indicator]: { [geo]: value } }
export async function regionMetric(indicators: string[]) {
  const list = indicators.map((s) => encodeURIComponent(s)).join(",")
  const path = "macro_indicators?geo_level=eq.region&indicator=in.(" + list + ")&order=period_date.asc&select=indicator,geo,value,period_date"
  const rows = (await sb(path)) as { indicator: string; geo: string; value: number; period_date: string }[]
  const out: Record<string, Record<string, number>> = {}
  for (const r of rows) { (out[r.indicator] = out[r.indicator] || {})[r.geo] = Number(r.value) } // period_date asc → 최신이 마지막(덮어씀)
  return out
}

// 동남아 국가 비교(geo_level='country_sea') — 특정 지표를 6개국 시계열로. { [geo]: {dates, values} }
export async function seaCompare(indicator: string) {
  const path =
    "macro_indicators?geo_level=eq.country_sea&indicator=eq." + encodeURIComponent(indicator) +
    "&order=period_date.asc&select=geo,period_date,value"
  const rows = (await sb(path)) as { geo: string; period_date: string; value: number }[]
  const out: Record<string, { dates: string[]; values: number[] }> = {}
  for (const r of rows) {
    const g = (out[r.geo] = out[r.geo] || { dates: [], values: [] })
    g.dates.push(r.period_date); g.values.push(Number(r.value))
  }
  return out
}

// ============================================================
// 날씨·재난 도메인 (weather · weather_alerts · earthquakes)
// ============================================================
export type WxDay = { date: string; maxT: number | null; avgT: number | null; minT: number | null; rain: number | null; heat: number | null; condition: string | null }
export async function weatherRecent(days = 120): Promise<WxDay[]> {
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const rows = await sb(`weather?select=date,max_temp,avg_temp,min_temp,rainfall,heat_index,condition&date=gte.${from}&order=date.asc&limit=1000`)
  return (rows ?? []).map((r: any) => ({ date: r.date, maxT: num(r.max_temp), avgT: num(r.avg_temp), minT: num(r.min_temp), rain: num(r.rainfall), heat: num(r.heat_index), condition: r.condition ?? null }))
}

export type Typhoon = { name: string; category: string; maxSignal: number; headline: string; asOf: string; inPar: boolean }
/** 태풍 — 이름별 최신 상태 1건씩(가장 최근 as_of), 최신순 */
export async function typhoonAlerts(limit = 8): Promise<Typhoon[]> {
  const rows = await sb(`weather_alerts?select=name,category,max_signal,headline,as_of,in_par&alert_type=eq.TC&order=as_of.desc&limit=60`)
  const seen = new Set<string>()
  const out: Typhoon[] = []
  for (const r of (rows ?? []) as any[]) {
    if (seen.has(r.name)) continue
    seen.add(r.name)
    out.push({ name: r.name, category: r.category ?? "", maxSignal: Number(r.max_signal ?? 0), headline: r.headline ?? "", asOf: r.as_of, inPar: Boolean(r.in_par) })
    if (out.length >= limit) break
  }
  return out
}

// 수입 단가 — import_prices(UN Comtrade). World(partner 0) 월별 단가 시계열 + 최신월 원산지 점유
export type ImpSeries = Record<string, { label: string; dates: string[]; values: number[] }>
export async function importPriceSeries(): Promise<ImpSeries> {
  const rows = await sb("import_prices?select=hs,hs_label,period_date,unit_price_kg&partner_code=eq.0&order=period_date.asc&limit=1000")
  const out: ImpSeries = {}
  for (const r of (rows ?? []) as any[]) {
    const g = (out[r.hs] = out[r.hs] || { label: r.hs_label, dates: [], values: [] })
    g.dates.push(r.period_date); g.values.push(Number(r.unit_price_kg))
  }
  return out
}
export type ImpOrigin = { partner: string; cif: number; unit: number; share: number }
/** 최신월 원산지 점유(가전 HS별) — partner_code!=0 */
export async function importOrigins(hs: string): Promise<{ date: string; origins: ImpOrigin[] } | null> {
  const last = await sb(`import_prices?select=period_date&hs=eq.${hs}&partner_code=eq.0&order=period_date.desc&limit=1`)
  const date = (last ?? [])[0]?.period_date
  if (!date) return null
  const rows = await sb(`import_prices?select=partner_name,cif_value,unit_price_kg&hs=eq.${hs}&period_date=eq.${date}&partner_code=neq.0&order=cif_value.desc`)
  const list = (rows ?? []) as any[]
  const tot = list.reduce((s, r) => s + Number(r.cif_value), 0) || 1
  return { date, origins: list.map((r) => ({ partner: r.partner_name, cif: Number(r.cif_value), unit: Number(r.unit_price_kg), share: (Number(r.cif_value) / tot) * 100 })) }
}

// 지역별 인프라 투자 — DPWH Transparency(infra_regional). 예산·건수·집행 상태.
export type InfraRegion = { region: string; projects: number; budgetB: number; completed: number; ongoing: number; forProc: number }
export async function infraRegional(): Promise<InfraRegion[]> {
  const rows = await sb("infra_regional?select=region,projects,budget_php_b,completed,ongoing,for_proc&order=budget_php_b.desc")
  return (rows ?? []).map((r: any) => ({ region: r.region, projects: Number(r.projects), budgetB: Number(r.budget_php_b), completed: Number(r.completed), ongoing: Number(r.ongoing), forProc: Number(r.for_proc) }))
}

export type Quake = { at: string; mag: number; place: string; lat: number; lon: number; depth: number | null }
export async function earthquakesRecent(days = 365, minMag = 4): Promise<Quake[]> {
  const from = new Date(Date.now() - days * 86400000).toISOString()
  const rows = await sb(`earthquakes?select=occurred_at,mag,place,lat,lon,depth_km&occurred_at=gte.${from}&mag=gte.${minMag}&order=occurred_at.desc&limit=1000`)
  return (rows ?? []).map((r: any) => ({ at: r.occurred_at, mag: Number(r.mag), place: r.place ?? "", lat: Number(r.lat), lon: Number(r.lon), depth: num(r.depth_km) }))
}

// ============================================================
// 발간 리포트 매니페스트 (public/reports/index.json)
//  · 정적 매니페스트 — 발행 스크립트(scripts/publish-report.mjs)가 갱신한다.
//  · 뉴스·리포트 페이지가 런타임에 읽어 카드로 노출 → "발행 = 자동 대시보드 반영".
// ============================================================
export type PubReport = {
  id: string
  title: string
  summary: string
  so: string
  topic: string        // 뉴스 분류(예: 규제·정책·인사이트)
  kind: string         // 리포트 종류 라벨(예: 정책 브리핑·주간 인사이트)
  source: string
  date: string         // 발행일 YYYY-MM-DD
  pdf: string          // 원문 PDF 경로
  thumb?: string | null // 미리보기 이미지(없으면 카테고리 아트)
  sentAt?: string | null // 이메일 발송일(발송 안 했으면 null)
  recipients?: number | null // 수신 인원
  pdfName?: string | null // 다운로드 파일명
  review?: boolean | null // 검토용(미발송, 대시보드 업로드만)
  // 영문 카드 메타(있으면 EN 모드에서 pick으로 표시 — PDF 본문은 한글 원본)
  title_en?: string | null
  summary_en?: string | null
  so_en?: string | null
  topic_en?: string | null
  kind_en?: string | null
  source_en?: string | null
}
export async function publishedReports(): Promise<PubReport[]> {
  try {
    const r = await fetch("/reports/index.json", { cache: "no-store" })
    if (!r.ok) return []
    const j = await r.json()
    const list = (j?.reports ?? []) as PubReport[]
    return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  } catch {
    return []
  }
}

// ============================================================
// 페이지 인사이트 배너 매니페스트 (public/banners.json)
//  · 주간/월간 자동 갱신 — scripts/update-banners.mjs 가 워딩·기간을 갱신.
//  · 각 페이지(뉴스·경쟁사 광고·환율)가 자기 키로 읽어 상단 배너에 노출.
// ============================================================
export type PageBanner = {
  title: string
  summary: string
  body: string
  insight: string
  insightLabel?: string
  period?: string | null
  cadence?: string | null
  updatedAt?: string | null
}
export async function pageBanner(key: string): Promise<PageBanner | null> {
  try {
    const r = await fetch("/banners.json", { cache: "no-store" })
    if (!r.ok) return null
    const j = await r.json()
    return (j?.[key] ?? null) as PageBanner | null
  } catch {
    return null
  }
}


// ============================================================
// 물가·생활비 도메인 데이터 (economy /prices)
// ============================================================

const CPI_KEYS = [
  "CPI_all_items",
  "CPI_food",
  "CPI_rice",
  "CPI_housing_utilities",
  "CPI_electricity",
  "CPI_lpg",
  "CPI_transport",
  "CPI_restaurants",
  "CPI_household_appliances",
  "CPI_aircon",
] as const

export type CpiSeries = Record<string, { dates: string[]; values: number[] }>

export type PricesDomain = {
  idx: CpiSeries
  forecast: { source: string; date: string; value: number }[]
  policyRate: number | null
  region: Record<string, number>[]
}

export async function pricesDomain(): Promise<PricesDomain> {
  const list = CPI_KEYS.map((s) => encodeURIComponent(s)).join(",")

  const idxRows = (await sb(
    "macro_indicators?geo_level=eq.national&indicator=in.(" +
      list +
      ")&order=period_date.asc&select=indicator,period_date,value"
  )) as { indicator: string; period_date: string; value: number }[]

  const idx: CpiSeries = {}
  for (const r of idxRows) {
    const g = (idx[r.indicator] = idx[r.indicator] || { dates: [], values: [] })
    g.dates.push(r.period_date)
    g.values.push(Number(r.value))
  }

  const fcRows = (await sb(
    "macro_indicators?indicator=in.(cpi_inflation_forecast,cpi_forecast_adb)&order=period_date.asc&select=indicator,period_date,value,source"
  )) as { indicator: string; period_date: string; value: number; source: string }[]
  const forecast = fcRows.map((r) => ({
    source: r.source || r.indicator,
    date: r.period_date,
    value: Number(r.value),
  }))

  const prRows = (await sb(
    "macro_indicators?indicator=eq.BSP_policy_rate&order=period_date.desc&limit=1&select=value"
  )) as { value: number }[]
  const policyRate = prRows.length ? Number(prRows[0].value) : null

  const regRows = (await sb(
    "v_cost_of_living_regional?order=period_date.desc&select=geo,period_date,inf_all_items,inf_food,inf_rice,inf_electricity,inf_lpg,inf_transport,inf_appliances,inf_aircon"
  )) as Record<string, number>[]
  const seen = new Set<string>()
  const region: Record<string, number>[] = []
  for (const r of regRows) {
    const k = String((r as any).geo)
    if (seen.has(k)) continue
    seen.add(k)
    region.push(r)
  }

  return { idx, forecast, policyRate, region }
}

// ── 경쟁사 동향(광고) — v_competitor_ads_board ──
export type CompAd = {
  brand: string
  page_name: string
  ad_type: string
  headline: string
  body: string | null
  offer: string | null
  status: string
  days_since_start: number | null
  days_to_end: number | null
  ends_on: string | null
  ad_started_on: string | null
  venue: string | null
  ad_url: string | null
  confidence: string | null
  image_url: string | null
  category: string | null
}

export async function competitorAds(): Promise<CompAd[]> {
  return (await sb(
    "v_competitor_ads_board?select=brand,page_name,ad_type,headline,body,offer,status,days_since_start,days_to_end,ends_on,ad_started_on,venue,ad_url,confidence,image_url,category"
  )) as CompAd[]
}
