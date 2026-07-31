// 제품 분류·정규화 순수 함수 — 카테고리·유형·사이즈·거래선 병합코드(canonCode).
// page.tsx에서 분리: 단위 테스트(정확도 회귀) 및 재사용 목적. React/UI 의존 없음.

// 에어컨 마력(HP) 추론 — 명시 "X HP" 텍스트 + 브랜드별 모델코드 BTU 환산.
//   LG LA코드=번호/100·HS코드=BTU천 · Carrier WCAR*/CAC/CEP/CTD=BTU백 · TCL TAC##CW/CS · Samsung AR##.
const _btu2hp = (b: number) => (b <= 8 ? 0.75 : b <= 10 ? 1.0 : b <= 15 ? 1.5 : b <= 20 ? 2.0 : b <= 26 ? 2.5 : 3.0)
export const acHpNum = (m: string): number | null => {
  const s = m || ""
  const t = s.match(/(\d*\.?\d+)\s*HP/i); if (t) { const v = parseFloat(t[1]); if (v >= 0.3 && v <= 6) return v }
  const la = s.match(/\bLA(\d{3})/i); if (la) { const n = parseInt(la[1], 10) / 100; if (n >= 0.4 && n <= 6) return n }
  const hs = s.match(/\bHS[NU]?(\d{2})/i); if (hs) return _btu2hp(parseInt(hs[1], 10))
  const wc = s.match(/WCAR[A-Z](\d{3})/i); if (wc) return _btu2hp(parseInt(wc[1], 10))
  const cr = s.match(/(?:CAC|CEP|CTD|CAH)(\d{3})/i); if (cr) return _btu2hp(parseInt(cr[1], 10))
  const tac = s.match(/TAC-?(\d{2})C[WS]/i); if (tac) return _btu2hp(parseInt(tac[1], 10))
  const ar = s.match(/\bAR(\d{2})/i); if (ar) { const b = parseInt(ar[1], 10); if (b >= 6 && b <= 30) return _btu2hp(b) }
  return null
}
export const acHpLabel = (m: string): string | null => { const h = acHpNum(m); return h == null ? null : (Number.isInteger(h) ? h.toFixed(1) : String(h)) + "HP" }
// 포지셔닝/보드 스펙 필터 버킷 — PM_AC_HP 라벨과 일치
export const acHpBucket = (m: string): string | null => { const h = acHpNum(m); return h == null ? null : h <= 0.9 ? "0.75HP↓" : h <= 1.24 ? "1.0HP" : h <= 1.74 ? "1.5HP" : h <= 2.24 ? "2.0HP" : h <= 2.9 ? "2.5HP" : "3.0HP↑" }

// 스펙 도출 — 타입 기준(AC=HP, TV=패널, 세탁기=F/L·T/L, 냉장고=도어형). 모델명 우선, 없으면 capacity
// 보드 표시 스펙 — 포지셔닝과 동일한 정확 분류기(유형=브랜드코드 맵핑 포함) + 사이즈 버킷. 미매핑 최소화.
// 거래선 병합용 정규 코드 — 모델명+코드에서 영문+숫자 혼합 최장 토큰(≥5) 추출(거래선마다 다른 표기 흡수)
// 측정단위 토큰(3.5CUFT·8KG·1.5HP·300L 등)은 모델코드가 아님 → canonCode 후보에서 제외.
const _CANON_NOISE = /^(?:\d*(?:CUFT|CUF|CFT|CU)|\d+(?:KG|HP|LITERS?|LITRES?|WATTS?|INCH|MM|CM)|\d+L)$/
export const canonCode = (model: string, code: string | null) => {
  const pre = code && code.length >= 4 && !/^[≈]/.test(code) && code !== "N/A" ? code + " " : ""
  // 하이픈/점으로 끊긴 모델코드 결합(RBT-35SL→RBT35SL·3.5CUFT→35CUFT) 후 나머지 기호는 공백
  const src = (pre + (model || "")).toUpperCase().replace(/([A-Z0-9])[-.]([A-Z0-9])/g, "$1$2").replace(/[^A-Z0-9 ]/g, " ")
  const toks = src.split(/\s+/).filter((x) => /[A-Z]/.test(x) && /\d/.test(x) && x.length >= 5 && !_CANON_NOISE.test(x))
  return toks.sort((a, b) => b.length - a.length)[0] || ""
}

export const PM_CATS = ["냉장고", "세탁기", "TV", "RAC", "SAC"]
export const isAC = (c: string) => c === "RAC" || c === "SAC"
// 가격대(tier) 절대 기준(₱) — 카테고리별 실판매가 분위(p25~p75)에 맞춘 시장 세그먼트. [엔트리상한, 프리미엄하한]
//   예: 에어컨 ₱3만 미만 LOW · 3~6만 MED · 6만+ 프리미엄 (₱5만=MED). 상대백분위가 아니라 절대금액.
export const PM_TIER_BANDS: Record<string, [number, number]> = {
  "RAC": [30000, 60000],
  "SAC": [60000, 120000],
  "TV": [35000, 80000],
  "냉장고": [25000, 55000],
  "세탁기": [22000, 50000],
}
export const pmTierOf = (cat: string, p: number) => { const b = PM_TIER_BANDS[cat] || [25000, 60000]; return p >= b[1] ? "프리미엄" : p >= b[0] ? "미드" : "엔트리" }
// 에어컨은 마력(HP)별로 스펙을 쪼갠다 — 그 외는 SEGMENTS(진열 세그먼트) 사용
export const PM_AC_HP: { t: string; re: RegExp }[] = [
  { t: "0.75HP↓", re: /0\.(5|75) ?HP/i },
  { t: "1.0HP", re: /(^|[^\d.])1(\.0)? ?HP/i },
  { t: "1.5HP", re: /1\.5 ?HP/i },
  { t: "2.0HP", re: /(^|[^\d.])2(\.0)? ?HP/i },
  { t: "2.5HP", re: /2\.5 ?HP/i },
  { t: "3.0HP↑", re: /(3(\.0)?|3\.5|4(\.0)?|5(\.0)?) ?HP/i },
]
// 에어컨 설치형태(유형) — HP(스펙)와 별개 축. 우선순위 분류(포터블→스탠드→창문→벽걸이) + 브랜드 코드 인지.
//   Carrier WCAR*=창문·CAC/CEP/CTD=스플릿, Panasonic CW*=창문·CS/CU=스플릿, Samsung AR##=스플릿,
//   Midea MS*=스플릿, TCL TAC##CW/CS, LG LA=창문·HS=스플릿, Condura WCON/WRAC=창문, Kolin KAP=포터블·KA##M=스플릿.
// 유형 우선순위: 포터블 → 스탠드(플로어) → 시스템(SAC: 카세트·천장·멀티·VRF·덕트) → 창문 → 벽걸이(스플릿)
//   시스템에어컨(카세트/멀티스플릿/천장형)이 스탠드형으로 뭉뚱그려지던 문제 분리(2026-07-31).
export const RAC_FORMS = ["창문형", "벽걸이형", "포터블"]   // RAC 유형
export const SAC_FORMS = ["스탠드형", "시스템"]              // SAC 유형(스탠드·천장/카세트/멀티)
export const acFormOf = (m: string): string | null => {
  const s = m || ""
  // 에어컨 아님(공기청정기·산소발생기·에어커튼·제습기 단독) → 배제
  if (/air ?purifier|oxygen concentrat|air ?curtain|\bhepa\b|nebuli/i.test(s)) return null
  if (/portable|\bKAP-?\d/i.test(s)) return "포터블"
  if (/floor ?mount|floor ?standing|스탠드|\bstanding\b|\bZPNQ|53C[LN]V|53CFV|53KFV/i.test(s)) return "스탠드형"
  if (/cassette|ceiling|천장|\bmulti[- ]?split|multi[- ]?v\b|\bvrf\b|\bvrv\b|ducted|concealed|시스템|\bZTNQ|\bZ\dUQ|\bZVNQ|\bZUAB|AMNQ|\bAC0\d{2}[A-Z]/i.test(s)) return "시스템"
  if (/window|창문|\bwdw\b|\bLA\d{3}|WCAR[A-Z]|\bWCON|WRAC|CW[- ]?[A-Z]{0,3}\d|TAC[- ]?\d+CW|\bAW\d|\d+WC[A-Z]*\b|\bKAM ?\d|KAM-?\d|FP-?\d+ARA|MWMDP|HWTAC/i.test(s)) return "창문형"
  if (/split|wall[- ]?mount|벽걸이|HS[NU]?\d{2}|\bAR\d{2}|CS[/-]?CU|\bCS-?[A-Z]{0,2}\d|CSCU|MS[A-Z]{1,3}-?\d|\bMWWA|FTK[A-Z]|TAC[- ]?\d+CS|(?:CAC|CEP|CTD|CAH)\d|KA-?\d+M|\bI?WAR[- ]?\d|\bWAM\d|\bHW-?\d\d|KS-?IW|\bKA-?\d+G|53GCV|53KPV|53CXV|FP ?53|FP\d{2}[A-Z]/i.test(s)) return "벽걸이형"
  // 최종 안전장치(never 기타): 잔여 실물 에어컨은 최빈 구성인 스플릿(벽걸이)로 배정 — 비-에어컨은 위에서 이미 null 배제
  return "벽걸이형"
}
// 냉장고 도어형(유형) — 텍스트 + 브랜드 코드프리픽스(LG RV[SFTB]·Samsung R[SFTB]·Condura C**·Haier HR*)
export const REF_FORMS = ["SxS", "F/D", "T/F", "B/F", "1Door", "Freezer"]
export const refFormOf = (m: string): string | null => {
  const s = m || ""
  // 액세서리(가전받침대·전압기 AVR·거치대)는 냉장고 아님 → 배제(카테고리 오분류 방어)
  if (/roller stand|appliance stand|support base|voltage reg|\bAVR\b/i.test(s)) return null
  // 명시 타입 텍스트 우선(집계된 마케팅 텍스트/애매한 브랜드코드보다 신뢰) → 그다음 확실한 코드만 폴백
  if (/side by side|\bsxs\b|양문|instaview/i.test(s)) return "SxS"
  if (/french[- ]?door|multi[- ]?door|4[- ]?door|프렌치/i.test(s)) return "F/D"
  // 퍼스널/바 냉장고는 '투도어' 표기가 있어도 소형 단문급 → 1Door 우선(3.5cu.ft급 소형 오분류 방지)
  if (/personal ?(?:ref|refrig|fridge)|bar ?fridge|mini ?bar/i.test(s)) return "1Door"
  if (/top[- ]?mount|two[- ]?door|2[- ]?door|double[- ]?door|top ?freezer|상냉/i.test(s)) return "T/F"
  if (/bottom[- ]?(?:mount|freezer)|하냉|BMF/i.test(s)) return "B/F"
  if (/single[- ]?door|1[- ]?door|one[- ]?door|personal|mini ?(?:bar|fridge|refrig)/i.test(s)) return "1Door"
  if (/chest|showcase|\bfreezer\b|upright|beverage|beer|chiller|wine ?cool/i.test(s)) return "Freezer"
  // ── 브랜드 코드 프리픽스 맵핑 (용량 텍스트가 없는 잔여 대비 — 다층 안전장치) ──
  //   LG RV*·Samsung R*·Condura C*·Fujidenzo I**·Panasonic NR-*·Haier HRF*·Toshiba GR-R*·Sharp SJ*·TCL TRF·Midea MDR*·Whirlpool WF
  if (/\bRVS|\bRS\d|\bISR|\bCSS|\bGRRS/i.test(s)) return "SxS"                                          // 양문
  if (/\bRVF|\bRF\d|\bIFR|\bGRRF/i.test(s)) return "F/D"                                                // 프렌치/멀티도어
  if (/\bRUB|\bRVB|\bRB\d|\bIBM|\bCBF|\bGRRB/i.test(s)) return "B/F"                                    // 하냉동
  if (/\bIRB|\bCPR|\bNRAQ|\bNR-?A|\bRBT|\bRUO|\bHR-?\d0\b/i.test(s)) return "1Door"                       // 소형 퍼스널·단문·미니
  if (/\bCUF|\bCTF|\bCCH|\bGR-?V|\bSC\d|\bHCF|\bHCH|\bIFC|\bISU|\bMDRC|\bCCF|\bIWC|\bEBC/i.test(s)) return "Freezer" // 냉동고·칠러·쇼케이스·쿨러
  if (/\bRVT|\bRUT|\bRT\d|\bCTD|\bCMD|\bNRB|\bNRT|\bNR-?[BT]|\bHRF[- ]?IV|\bGRRT|\bGRRP|\bGR-?[BY]|\bGRB|\bGRY|\bSJ|\bTRF|\bTCF|\bMDRD|\bWF\d|\bARTM|\bINR|\bIRD|\bRDD|\bITV/i.test(s)) return "T/F" // 2도어 상냉동(기본)
  // ── 최종 안전장치: 냉장고는 '기타' 없이 사이즈 기준으로 기본 배정(소형=단문, 그 외=최빈 구성인 상냉동) ──
  const v = refCuft(s)
  if (v != null && v < 6) return "1Door"
  return "T/F"
}
// 세탁기 로드형(유형)
// 세탁기 카테고리에 건조기 포함 — 유형으로 구분. 워시타워/트윈/프론트/탑로드 + 건조기(단독)
export const WM_FORMS = ["F/L", "T/L", "Twin Tub", "Single Tub", "W/T", "Dryer"]
export const wmFormOf = (m: string): string | null => {
  const s = m || ""
  if (/wash ?tower|washtower|\bWT\d/i.test(s)) return "W/T"
  if (/twin ?(?:wash|tub)|twinwash/i.test(s)) return "Twin Tub"
  // 단조(single tub)·스핀드라이 — 보급형 반자동 세탁기 (탑로드 자동과 구분)
  if (/single ?tub|spin ?dry(?:er)?/i.test(s)) return "Single Tub"
  // 세탁건조 콤보(Combo/Combi · Washer and/& Dryer)는 프론트로드 → F/L (단독 건조기보다 먼저)
  if (/comb[io]|washer.{0,6}dryer/i.test(s)) return "F/L"
  // 단독 건조기(워셔/세탁 텍스트 없이) — 콤보는 위에서 이미 F/L 처리
  if (/\bdryer\b|heat ?pump ?dry|drying machine/i.test(s) && !/\bwasher\b|washing/i.test(s)) return "Dryer"
  if (/\bDVE?\d|\bDVG\d|\bDLE\d/i.test(s)) return "Dryer"   // Samsung DV·LG DLE 건조기 코드
  // 명시 로드형 텍스트 우선 → 코드 폴백(마케팅 텍스트 노이즈로 탑로드가 프론트로 오분류되던 문제)
  if (/top[- ]?load|topload|fully ?auto(?:matic)? ?washing/i.test(s)) return "T/L"
  if (/front[- ]?load|frontload|\bdrum\b/i.test(s)) return "F/L"
  if (/\bFV\d|\bWW\d|\bNA-?V|\bTWF|\bWD\d|\bTWD|\bAWD|WWEB|FWEB|\bESJN|\bHW\d{2}|\bF\d{2}S|\bMF\d/i.test(s)) return "F/L"
  if (/\bT[0-9]\d{3}|\bWA\d|\bNA-?[FW]|\bTWA|\bTWT|\bCWM|\bHWM|\bVHH|\bAWTM|\bAWFM|\bGWTW|\bMA\d{3}W|\bMT\d{3}W|\bMAW|\bMTW|\bAW[- ]?[A-Z]?\d/i.test(s)) return "T/L"
  if (/\bAHW|\bES-?WP|\bEWM|\bWM-?\d|\bBWS|\bHSD|\bJWS/i.test(s)) return "Single Tub"   // 단조 코드 폴백
  // 의류관리기(Styler·AirDresser·Smart Closet)는 세탁기 아님 → 배제
  if (/styler|air ?dresser|smart closet|clothing care|의류관리/i.test(s)) return null
  // 최종 안전장치(never 기타): 잔여 실물 세탁기는 최빈 구성인 탑로드로 배정
  return "T/L"
}
// TV 패널을 **등급(계열)**으로 통합 — 개별 패널명이 아니라 시장 등급으로:
//   OLED(자발광 최상) > QLED급(퀀텀닷·미니LED 프리미엄 LED: QLED·QNED·NanoCell·MiniLED·ULED·NeoQLED) > UHD(표준 4K) > FHD·HD(엔트리)
//   근거: QNED/Neo QLED/Hi-QLED 모두 QLED와 동일 퀀텀닷 계열(2026 시장 통용). 브랜드 인지로 LG의 QLED 오분류 방지.
export const TV_FORMS = ["OLED", "QLED급", "UHD", "FHD·HD"]
export const tvFormOf = (m: string, brand?: string): string | null => {
  const s = m || ""
  const isLG = /^lg$/i.test(brand || "")
  // 액세서리(녹음기·마이크·셋톱박스·마운트 '단품')는 TV 아님 → 배제.
  //   ※ 광의어(bracket/mount) 금지 — 'with FREE 벽걸이 번들' 실제 TV가 잘못 제외되던 문제. 단품 식별코드만.
  if (/\bVML\d|\bVLT\d|\bVXT\d|\bVST\d|affordabox|set-?top|\bICD-|voice recorder|\bmicrophone\b|\bDM-?1000/i.test(s)) return null
  if (/\boled\b/i.test(s)) return "OLED"
  // QLED급(퀀텀닷/미니LED 프리미엄) — LG 고유(QNED/NanoCell/MiniLED)는 항상, QLED/ULED/NeoQLED는 비LG만
  if (/qned|nano ?cell|\bnano\b|mini ?led|miniled|mini ?rgb|micro ?rgb|rgb ?evo/i.test(s)) return "QLED급"   // LG Mini/Micro RGB evo(2026 플래그십)=프리미엄 등급
  if (!isLG && /qled|\buled\b|neo ?qled/i.test(s)) return "QLED급"
  const inch = tvInOf(s)
  const explicit4k = /uhd|\b4k\b|crystal|\bUA\d|\bNU\d|\bUQ\d|\bUR\d|\bUT\d|WPREU\d/i.test(s)
  // 소형(≤32˝)은 UHD 패널이 사실상 없음 → 명시 4K/UHD가 아니면 무조건 FHD·HD(2K·HD·720p 포함)
  if (inch != null && inch <= 32 && !explicit4k) return "FHD·HD"
  if (explicit4k) return "UHD"
  if (/full ?hd|\bfhd\b|\b2k\b|\bhd\b/i.test(s)) return "FHD·HD"
  // 최종 안전장치(never 기타): 사이즈로 배정 — 40˝↓=FHD·HD, 그 이상=UHD(표준 4K)
  return inch != null && inch < 40 ? "FHD·HD" : "UHD"
}
export const pmFormOf = (cat: string, m: string, brand?: string): string | null =>
  isAC(cat) ? acFormOf(m) : cat === "냉장고" ? refFormOf(m) : cat === "세탁기" ? wmFormOf(m) : cat === "TV" ? tvFormOf(m, brand) : null

// ── 스펙(사이즈) 축 — 에어컨=HP, 냉장고=cu.ft, 세탁기=kg, TV=인치. 명시단위 우선, 없으면 브랜드 코드에서 추론 ──
export const REF_SIZE = ["7cu.ft↓", "7~14", "14~22", "22cu.ft↑"]
export const WM_SIZE = ["8kg↓", "8~11", "11kg↑"]
export const TV_SIZE = ["43˝↓", "43~54", "55~64", "65~74", "75˝↑"]
const _mnum = (s: string, re: RegExp) => { const x = s.match(re); return x ? parseFloat(x[1]) : null }
export const refCuft = (s: string): number | null => {
  const v = _mnum(s, /(\d+(?:\.\d+)?)\s*cu/i); if (v != null) return v
  const L = _mnum(s, /(\d{3})\s*(?:L\b|li?ters?)/i); if (L != null && L >= 80 && L <= 800) return +(L * 0.0353).toFixed(1)
  let c = s.match(/\b(?:RVS|RVF|RVT|RVB|RUB|RUS|RUT|CMD|CTD)-?[A-Z]?(\d{2,3})/i)
  if (c) { const n = parseInt(c[1], 10) / 10; if (n >= 3 && n <= 40) return n }
  // 파나소닉·하이어·삼성 등은 코드에 리터(L)를 담는다 → cu.ft 환산(L×0.0353)
  c = s.match(/\b(?:NR[-\s]?[A-Z]{1,2}|HRF-?[A-Z]{0,3}|HR[-\s]?|SC|HCF|GR[-\s]?[A-Z]|BCD|RS|RF|RT|RB|RL|RH|CCH|CPR)(\d{2,3})/i)
  if (c) { const L2 = parseInt(c[1], 10); if (L2 >= 60 && L2 <= 800) return +(L2 * 0.0353).toFixed(1); if (L2 >= 30 && L2 < 60) return +(L2 / 10).toFixed(1) }
  return null
}
export const wmKgOf = (s: string): number | null => {
  const v = _mnum(s, /(\d+(?:\.\d+)?)\s*kg/i); if (v != null) return v
  const cw = s.match(/CWM(\d+(?:\.\d+)?)/i); if (cw) { const n = parseFloat(cw[1]); if (n >= 4 && n <= 30) return n }
  // 파나소닉 NA-[문자]+숫자: 선두 2~3자리를 /10 해 4~30 되는 해석 채택(W8023→8.0·S056→5.6·FD90→9.0·W10523→10.5)
  const p = s.match(/\bNA[-\s]?[A-Z]{1,2}(\d{2,4})/i); if (p) { const d = p[1]; for (const k of [3, 2]) { if (d.length >= k) { const n = parseInt(d.slice(0, k), 10) / 10; if (n >= 4 && n <= 30) return n } } }
  let c = s.match(/\b(?:FV|WW|WA|WD|WT)(\d{2})/i); if (c) { let n = parseInt(c[1], 10); if (n > 30) n /= 10; if (n >= 4 && n <= 30) return n }
  const t = s.match(/\bT2(\d)(\d)(\d)/i); if (t) { const a = +t[1], b = +t[2], c2 = +t[3]; const n = a >= 3 ? a * 10 + b : (b === 0 ? c2 : b + (c2 >= 5 ? 0.5 : 0)); if (n >= 4 && n <= 30) return n }
  c = s.match(/\b(?:TWA|TWF|TWT|TWD)(\d{2,3})/i); if (c) { let n = parseInt(c[1], 10); while (n > 30) n /= 10; if (n >= 4 && n <= 30) return n }
  c = s.match(/\bM[AF](\d{2,3})/i); if (c) { let n = parseInt(c[1], 10); while (n > 30) n /= 10; if (n >= 4 && n <= 30) return n }
  c = s.match(/\bHWM(\d{2,3})/i); if (c) { let n = parseInt(c[1], 10); if (n > 30) n /= 10; if (n >= 4 && n <= 30) return n }
  return null
}
export const tvInOf = (s: string): number | null => {
  const v = _mnum(s, /(\d{2,3})\s*(?:inch|in\b|˝|")/i); if (v != null && v >= 20 && v <= 120) return v
  let c = s.match(/\bWPREU(\d{2})/i)   // Prestiz WPREU{인치}{일련} — 앞 2자리=인치
  if (c) { const n = parseInt(c[1], 10); if (n >= 20 && n <= 120) return n }
  c = s.match(/\b(?:QA|UA|QN|QE|UN|KD|XR|TH|LH|OLED)(\d{2,3})/i)
  if (c) { const n = parseInt(c[1], 10); if (n >= 20 && n <= 120) return n }
  c = s.match(/\bH(\d{2,3})[A-Z]/i)
  if (c) { const n = parseInt(c[1], 10); if (n >= 20 && n <= 120) return n }
  c = s.match(/(?:^|\s)(\d{2,3})(?:["˝]|\s?inch|[A-Z]{2})/i)
  if (c) { const n = parseInt(c[1], 10); if (n >= 20 && n <= 120) return n }
  return null
}
export const pmSizeBucket = (cat: string, model: string, capacity: string | null): string | null => {
  const src = (model || "") + " " + (capacity || "")
  if (cat === "냉장고") { const v = refCuft(src); return v == null ? null : v < 7 ? "7cu.ft↓" : v < 14 ? "7~14" : v < 22 ? "14~22" : "22cu.ft↑" }
  if (cat === "세탁기") { const v = wmKgOf(src); return v == null ? null : v < 8 ? "8kg↓" : v < 11 ? "8~11" : "11kg↑" }
  if (cat === "TV") { const v = tvInOf(src); return v == null ? null : v < 43 ? "43˝↓" : v < 55 ? "43~54" : v < 65 ? "55~64" : v < 75 ? "65~74" : "75˝↑" }
  return null
}
// 두 축 목록·매처 — 분류 안 되는 잔여는 "기타"로 흡수(필터에서 제품이 사라지지 않게)
export const ETC = "기타"
export const pmFormsFor = (c: string) => { const base = c === "RAC" ? RAC_FORMS : c === "SAC" ? SAC_FORMS : c === "냉장고" ? REF_FORMS : c === "세탁기" ? WM_FORMS : c === "TV" ? TV_FORMS : []; return [...base] }   // 유형 '기타' 없음 — 분류기 최종 폴백으로 실물은 항상 유형 배정
export const pmFormHit = (cat: string, model: string, t: string, brand?: string) => { if (t === "전체") return true; const f = pmFormOf(cat, model, brand); return t === ETC ? f == null : f === t }
export const pmSizeList = (c: string) => { const base = isAC(c) ? PM_AC_HP.map((x) => x.t) : c === "냉장고" ? REF_SIZE : c === "세탁기" ? WM_SIZE : c === "TV" ? TV_SIZE : []; return base.length ? [...base, ETC] : [] }
export const pmSizeHit = (cat: string, model: string, capacity: string | null, t: string) => { if (t === "전체") return true; const b = isAC(cat) ? acHpBucket(model) : pmSizeBucket(cat, model, capacity); return t === ETC ? b == null : b === t }
