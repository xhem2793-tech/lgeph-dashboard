/** 지표 → 경제지표 카테고리 분류(네비 id와 정합). 전체 지표 리스트·사이드바 카운트 공용. */

export const CATS: { key: string; ko: string; re: RegExp }[] = [
  { key: "prices", ko: "물가·생활비", re: /cpi|inflation|price|물가|가격|생활비|유가|fuel|diesel|gasoline|meralco|전기|electric/i },
  { key: "growth", ko: "국민계정·성장", re: /gdp|gva|growth|investment|construction|industrial|capacity|manufactur|생산|성장|투자|건설|permit|가동/i },
  { key: "labor", ko: "고용·임금·소득", re: /unemploy|employ|wage|labor|labour|ofw|remittance|고용|임금|실업|송금|소득|income/i },
  { key: "sentiment", ko: "기업·소비 심리", re: /confidence|sentiment|cci|bci|bes|expectation|심리|기대|경기전망/i },
  { key: "housing", ko: "부동산·주택", re: /rppi|rrepi|housing|vacancy|property|residential|mortgage|주택|부동산|공실|건축허가|floorarea/i },
  { key: "fx", ko: "환율·원가", re: /fx|usd|neer|reer|peso|exchange|dollar|환율|페소|실효환율/i },
  { key: "rates", ko: "통화·금리·신용", re: /policy_rate|m3|money_supply|money|credit|loan|deposit|금리|통화|대출|신용|카드/i },
  { key: "appliance", ko: "가전 선행지표", re: /appliance|_ppi|producer_price|가전|내구재/i },
  { key: "energy", ko: "에너지 라벨", re: /energy_label|energy_star|doe_|효율|별점|star_rating/i },
  { key: "importprice", ko: "수입 단가", re: /import|comtrade|수입|cif/i },
  { key: "weather", ko: "날씨·재난", re: /cdd|temperature|temp_|typhoon|earthquake|quake|weather|enso|oni|기온|태풍|지진|냉방도일/i },
]
export const NAV_IDS = new Set(CATS.map((c) => c.key)) // 클릭 시 이동 가능한 분류(경제지표 뷰 존재)

export function classify(ind: string, label: string): { key: string; ko: string } {
  const hay = ind + " " + label
  for (const c of CATS) if (c.re.test(hay)) return { key: c.key, ko: c.ko }
  return { key: "etc", ko: "기타" }
}
export const catKo = (k: string) => (k === "etc" ? "기타" : CATS.find((c) => c.key === k)?.ko || k)

/** provenance 목록을 분류별 지표 수로 집계 — { [catKey]: count } */
export function countByCat(items: { indicator: string; label: string }[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const it of items) { const k = classify(it.indicator, it.label || "").key; m[k] = (m[k] || 0) + 1 }
  return m
}
