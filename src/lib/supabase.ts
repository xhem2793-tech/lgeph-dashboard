const SB_URL = "https://ozvbyigntwhwzzagwojr.supabase.co"
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dmJ5aWdudHdod3p6YWd3b2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODkxNDEsImV4cCI6MjA5ODQ2NTE0MX0.LrkBzEK9QzX1PCNm9KzTUZE29VcHuJOqikFOnbEpv6U"

async function sb(path: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    cache: "no-store",
  })
  if (!r.ok) throw new Error(`supabase ${r.status}`)
  return r.json()
}

const num = (v: any) => (v == null ? null : Number(v))

export async function latestMacro(indicators: string[]) {
  const list = indicators.join(",")
  const rows = await sb(
    `macro_indicators?geo=eq.PHILIPPINES&indicator=in.(${list})&select=indicator,value,period_date&order=period_date.desc`,
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
    `news_articles?sheet=eq.${sheet}&select=title,summary,ai_analysis,source_name,date,source_url,category,image_url&order=date.desc&limit=${limit}`,
  )
  return rows.map((r) => ({ title: r.title, summary: r.summary, ai: r.ai_analysis, source: r.source_name, date: r.date, url: r.source_url, category: r.category, image: r.image_url }))
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
    `v_home_band?select=seq,key,label,prefix,value,delta,delta_label,dir,as_of,freq&order=seq.asc`,
  )
  return rows.map((r) => ({
    key: r.key as string,
    label: r.label as string,
    prefix: (r.prefix ?? "") as string,
    value: r.value as string,
    delta: num(r.delta),
    deltaLabel: r.delta_label as string,
    dir: r.dir as "bad" | "good" | "neutral",
    asOf: (r.as_of ?? null) as string | null,
    freq: r.freq as string,
  }))
}

/** 오늘의 변화 — 모든 축(가격·재고·기상·뉴스)에서 실제로 바뀐 것만.
 *  행이 없으면 화면은 "특이사항 없음"을 표시한다(억지로 채우지 않음). */
export async function dailyChanges(limit = 8) {
  const rows = await sb(
    `v_daily_changes?select=as_of,seq,kind,tone,subject,detail,source&limit=${limit}`,
  )
  return rows.map((r) => ({
    asOf: r.as_of as string,
    kind: r.kind as "price" | "stock" | "weather" | "news",
    tone: r.tone as "bad" | "good" | "warn" | "neutral",
    subject: r.subject as string,
    detail: r.detail as string,
    source: r.source as string,
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
    `daily_brief?select=as_of,lines,weekly_call,weekly_owner,weekly_due,status,approved_by,approved_at&order=as_of.desc&limit=1`,
  )
  if (!rows.length) return null
  const r = rows[0]
  return {
    asOf: r.as_of as string,
    lines: (r.lines ?? []) as { text: string; evidence?: string }[],
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
