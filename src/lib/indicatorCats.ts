/** 지표 → 경제지표 카테고리 분류(네비 id와 정합). 전체 지표 리스트·사이드바 카운트 공용. */
import { T } from "@/lib/i18n"

// 순서=우선순위(위에서부터 첫 매칭). 구체적 카테고리를 먼저 두고, 그리디한 growth는 마지막.
export const CATS: { key: string; ko: string; re: RegExp }[] = [
  { key: "weather", ko: "날씨·재난", re: /cdd|temperature|temp_monthly|typhoon|earthquake|quake|weather|enso_oni|기온|태풍|지진|냉방도일/i },
  { key: "housing", ko: "부동산·주택", re: /rppi|rrepi|vacancy|property|mortgage|permits_|floorarea|주택|부동산|공실|건축허가/i },
  { key: "appliance", ko: "가전 선행지표", re: /appliance|appl_own|imports_home|imports_consumer|imports_telecom|ppi|producer_price|durables|가전|내구재|보유율/i },
  { key: "energy", ko: "에너지 라벨", re: /energy_label|energy_star|doe_|효율|별점|star_rating/i },
  { key: "sentiment", ko: "기업·소비 심리", re: /confidence|sentiment|cci|bci|bes_|expectation|심리|기대|경기전망|신뢰/i },
  { key: "rates", ko: "통화·금리·신용", re: /policy_rate|broad_money|money_supply|m3|credit|loan|deposit|interbank|npl|금리|통화|대출|신용|카드/i },
  { key: "fx", ko: "환율·원가", re: /php_usd|usd_rate|neer|reer|peso|exchange|reserves_usd|환율|페소|실효환율|외환보유/i },
  { key: "prices", ko: "물가·생활비", re: /cpi|inflation|inf_|물가|가격|생활비|유가|fuel|diesel|gasoline|oil_|brent|meralco|전기요금|전기료/i },
  { key: "labor", ko: "고용·임금·소득", re: /unemploy|employ|wage|labor|labour|ofw|remittance|gini|고용|임금|실업|송금|소득|income|취업/i },
  { key: "online", ko: "온라인 시장", re: /ecommerce|internet_penetration|broadband|mobile_per100|digital_payment|secure_internet|온라인|이커머스|초고속인터넷/i },
  { key: "importprice", ko: "수입 단가", re: /comtrade|import_price|unit_price|cif단가/i },
  { key: "growth", ko: "국민계정·성장", re: /gdp|gva|_va_|va_growth|va_gdp|growth|investment|gfcf|capital_formation|consumption|construction|industrial|capacity|manufactur|fdi|debt|tax_revenue|saving|current_account|trade_balance|export|import|retail|소매|생산|성장|투자|건설|가동|무역|수출|수입|재정|부채/i },
]
export const NAV_IDS = new Set(CATS.map((c) => c.key)) // 클릭 시 이동 가능한 분류(경제지표 뷰 존재)

export function classify(ind: string, label: string): { key: string; ko: string } {
  const hay = ind + " " + label
  for (const c of CATS) if (c.re.test(hay)) return { key: c.key, ko: c.ko }
  return { key: "etc", ko: "기타" }
}
export const catKo = (k: string) => (k === "etc" ? "기타" : CATS.find((c) => c.key === k)?.ko || k)

// 카테고리 EN 라벨(사이드바·economy 네비와 정합) — 전체 지표 CATEGORY 컬럼 지역화용
const CAT_EN: Record<string, string> = {
  weather: "Weather & Disaster", housing: "Real Estate", appliance: "Appliance Indicators",
  energy: "Energy Labels", sentiment: "Biz · Consumer Sentiment", rates: "Rates · Credit",
  fx: "FX · Costs", prices: "Prices & Living Costs", labor: "Jobs · Wages · Income",
  online: "Online Market", importprice: "Import Prices", growth: "Nat'l Accounts", etc: "Other",
}
export const catEn = (k: string) => CAT_EN[k] ?? catKo(k)
/** 카테고리 키 → 현재 언어 라벨(EN 모드면 영문). 전체 지표 CATEGORY 컬럼·필터·헤더 공용. */
export const catLabel = (k: string) => T(catKo(k), catEn(k))

/** provenance 목록을 분류별 지표 수로 집계 — { [catKey]: count } */
export function countByCat(items: { indicator: string; label: string }[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const it of items) { const k = classify(it.indicator, it.label || "").key; m[k] = (m[k] || 0) + 1 }
  return m
}
