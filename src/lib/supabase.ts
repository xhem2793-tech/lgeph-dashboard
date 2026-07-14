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
  const bad = /^(KG|CU|FT|INCH|HP|TON|LED|OLED|QNED|SMART|TV|BUNDLE|MODEL|NEW|SALE|LG|SAMSUNG|SHARP|HISENSE|TCL|PANASONIC|MIDEA|CARRIER|SONY|WHIRLPOOL|CONDURA|FUJIDENZO)$/i
  const c = (text || "")
    .split(/[\s(),/_]+/)
    .map((x) => x.replace(/[^A-Za-z0-9.-]/g, ""))
    .filter((u) => {
      if (u.length < 4 || u.length > 22) return false
      if (!/[A-Za-z]/.test(u) || !/\d/.test(u)) return false
      if (/^\d/.test(u)) return false
      if (bad.test(u)) return false
      if (/^\d+(KG|L|W|CUFT|INCH|HP)$/i.test(u)) return false
      return (u.match(/\d/g) || []).length >= 2
    })
  return c.length ? c[c.length - 1].toUpperCase() : ""
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

export async function competitorTable(max = 6000): Promise<PriceRow[]> {
  const page = 1000
  const rows: any[] = []
  for (let off = 0; off < max; off += page) {
    const chunk = await sb(
      "v_competitor_3d?select=*&order=brand.asc,category.asc,model.asc&offset=" + off + "&limit=" + page,
    )
    rows.push(...(chunk ?? []))
    if (!chunk || chunk.length < page) break
  }
  return rows.map((r: any) => {
    const p0 = num(r.p0)
    const p1 = num(r.p1)
    const p2 = num(r.p2)
    return {
      retailer: r.retailer,
      brand: r.brand,
      category: r.category,
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
    }
  })
}
