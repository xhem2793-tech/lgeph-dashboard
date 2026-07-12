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
