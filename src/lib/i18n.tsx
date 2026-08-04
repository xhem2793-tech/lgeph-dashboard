"use client"

import React from "react"

/** 언어 전환 — KO(기본) / EN.
 *
 *  ■ 원칙
 *   1) 원문을 지우지 않는다. DB에는 한국어 원문 + 영문 컬럼(_en)이 함께 산다.
 *   2) 번역이 없으면 원문을 보여준다(pick()의 폴백). 빈칸이나 지어낸 번역은 금지.
 *   3) UI 문구는 사전(DICT)에 모아 한 곳에서 관리한다.
 */
export type Lang = "ko" | "en"

/** 인라인 번역 헬퍼 — 컴포넌트 어디서나 `T("한글", "English")`로 병기.
 *  LangProvider가 현재 언어를 이 모듈 변수에 동기화하고, 언어 전환 시 트리를 리마운트(key=lang)해 즉시 반영된다.
 *  (키 관리 없이 전면 번역용. 훅이 아니라 JSX 텍스트/문자열 어디든 사용 가능) */
let _lang: Lang = "ko"
export function T(ko: string, en: string): string { return _lang === "en" ? en : ko }
/** 데이터 필드용 비-훅 picker — EN이면 en(없으면 ko 폴백), KO면 ko. 훅이 아니라 data 레이어/어디서나 사용.
 *  (언어 토글 시 트리가 리마운트되어 데이터 재조회·재평가되므로 최신 _lang을 참조한다) */
export function pickL(ko?: string | null, en?: string | null): string {
  return _lang === "en" ? (en && en.trim() ? en : ko ?? "") : (ko ?? "")
}

const Ctx = React.createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "ko",
  setLang: () => {},
})

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("ko")
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("ax_lang") : null
    if (saved === "en" || saved === "ko") {
      setLangState(saved)
      if (typeof document !== "undefined") document.documentElement.lang = saved
    }
  }, [])
  /** 언어 전환 — 상태를 '즉시' 바꿔 리마운트로 바로 반영(지연 없음). 페이드는 순수 CSS로 겹쳐만 준다. */
  const setLang = React.useCallback((l: Lang) => {
    _lang = l                                    // T() 헬퍼가 이번 렌더에서 곧바로 새 언어 참조
    setLangState(l)                              // 즉시 상태 변경 → 트리 리마운트(key=lang) → 전체 반영
    try { window.localStorage.setItem("ax_lang", l) } catch {}
    const root = typeof document !== "undefined" ? document.documentElement : null
    if (root) {
      root.lang = l
      root.classList.add("lang-in")              // 짧은 페이드-인(반영을 막지 않음)
      window.setTimeout(() => root.classList.remove("lang-in"), 300)
    }
  }, [])
  _lang = lang  // 모듈 변수 동기화(T 헬퍼가 참조)
  // key={lang} — 언어 전환 시 트리 전체 리마운트로 T() 결과가 즉시 반영됨
  return <Ctx.Provider value={{ lang, setLang }}><React.Fragment key={lang}>{children}</React.Fragment></Ctx.Provider>
}

export function useLang() {
  const { lang, setLang } = React.useContext(Ctx)
  const t = React.useCallback((key: keyof typeof DICT) => (lang === "en" ? DICT[key].en : DICT[key].ko), [lang])
  /** 데이터 필드 — 번역이 없으면 원문 폴백 */
  const pick = React.useCallback(
    (ko?: string | null, en?: string | null) => (lang === "en" ? (en && en.trim() ? en : ko ?? "") : ko ?? ""),
    [lang],
  )
  return { lang, setLang, t, pick }
}

export const DICT = {
  nav_overview: { ko: "대시보드", en: "Overview" },
  nav_economy: { ko: "주요지표", en: "Indicators" },
  nav_news: { ko: "국가동향", en: "News" },
  nav_competitors: { ko: "시장동향", en: "Market" },
  nav_competitor_ads: { ko: "마케팅", en: "Marketing" },
  nav_calendar: { ko: "주요일정", en: "Calendar" },
  nav_appendix: { ko: "자료", en: "Appendix" },
  nav_reports: { ko: "리포트", en: "Reports" },
  nav_weather: { ko: "날씨·재난", en: "Weather" },
  search_ph: { ko: "지표·뉴스·키워드 검색", en: "Search indicators, news, keywords" },
  org: { ko: "LGE-PH 경영기획", en: "LGE-PH Strategy" },
  brief_title: { ko: "금주 브리핑", en: "This Week's Briefing" },
  brief_evidence: { ko: "근거", en: "Evidence" },
  brief_empty: { ko: "오늘 초안 없음 — 아직 생성 전", en: "No draft today — not generated yet" },
  brief_approve: { ko: "AI · 검토 전 → 승인", en: "AI draft → approve" },
  brief_approving: { ko: "승인 중…", en: "Approving…" },
  brief_fail: { ko: "승인 실패 — 다시 시도", en: "Approval failed — retry" },
  price_title: { ko: "가격 동향", en: "Price Moves" },
  price_daily: { ko: "매일 갱신", en: "Daily" },
  price_all: { ko: "전체", en: "All" },
  price_down: { ko: "↓ 인하순", en: "↓ Cuts" },
  price_up: { ko: "↑ 인상순", en: "↑ Hikes" },
  price_none: { ko: "변동 없음", en: "No change" },
  th_brand: { ko: "브랜드", en: "Brand" },
  th_category: { ko: "카테고리", en: "Category" },
  th_model: { ko: "모델", en: "Model" },
  th_srp: { ko: "SRP", en: "SRP" },
  th_delta: { ko: "전일비", en: "D/D" },
  th_retail: { ko: "유통", en: "Retail" },
  price_note: {
    ko: "LG · Samsung · Panasonic · TCL · Midea · Hisense 기준",
    en: "LG · Samsung · Panasonic · TCL · Midea · Hisense",
  },
  price_asof: { ko: "기준", en: "as of" },
  cat_ref: { ko: "냉장고", en: "REF" },
  cat_wash: { ko: "세탁기", en: "W/M" },
  cat_tv: { ko: "TV", en: "TV" },
  cat_ac: { ko: "에어컨", en: "RAC" },
  d_fx: { ko: "환율", en: "FX" },
  d_oil: { ko: "유가", en: "Fuel" },
  d_wx: { ko: "날씨", en: "Weather" },
  d_basis: { ko: "기준 · 전년 동기 대비", en: "as of · vs. same period last year" },
  d_loading: { ko: "데이터 불러오는 중…", en: "Loading data…" },
  r_7d: { ko: "최근 7일", en: "Last 7 days" },
  r_1m: { ko: "한 달", en: "1 month" },
  r_3m: { ko: "3개월", en: "3 months" },
  r_1y: { ko: "연간", en: "1 year" },
  rail_title: { ko: "주요지표", en: "Key Indicators" },
  rail_hint: { ko: "누르면 상세 차트", en: "Tap for full chart" },
  rail_monthly: { ko: "월별 지표", en: "Monthly" },
  rail_quarterly: { ko: "분기 지표", en: "Quarterly" },
  rail_note: {
    ko: "배지 색은 사업영향 기준 · 4초마다 전월비 ↔ 전년비 교대",
    en: "Badge color = business impact · toggles MoM ↔ YoY every 4s",
  },
  rail_fail: { ko: "지표를 불러오지 못함 · 확인 필요", en: "Failed to load indicators · check needed" },
  prev_year: { ko: "전년", en: "Prev yr" },
  cur_year: { ko: "현재", en: "Current" },
  news_title: { ko: "주요 뉴스", en: "Top News" },
  news_sub: { ko: "경제·산업·B2B", en: "Economy · Industry · B2B" },
  news_updated: { ko: "최신", en: "Updated" },
  news_none_today: { ko: "오늘 신규 없음", en: "No new items today" },
  ce_title: { ko: "CE 동향", en: "CE Trends" },
  ce_sub: { ko: "생활가전·소비", en: "Home appliances" },
  b2b_title: { ko: "B2B 동향", en: "B2B Trends" },
  b2b_sub: { ko: "공조·인프라", en: "HVAC · Infra" },
  market_title: { ko: "시장 동향", en: "Market" },
  market_sub: { ko: "경제·정치·사회", en: "Economy · Politics" },
  analysis_title: { ko: "인사이트", en: "Insights" },
  analysis_sub: { ko: "자체 칼럼 · 외부 큐레이션", en: "In-house · Curated" },
  analysis_own: { ko: "자체", en: "In-house" },
  analysis_ext: { ko: "외부", en: "External" },
  analysis_note: {
    ko: "외부 글은 원문을 옮기지 않음. 요약·해석·링크만 (출처와 저작권 보존)",
    en: "External pieces are not reproduced — summary, take and link only",
  },
  why_matters: { ko: "왜 중요한가", en: "Why it matters" },
  daily_title: { ko: "일간 지표", en: "Daily Indicators" },
  cal_title: { ko: "캘린더", en: "Calendar" },
  cal_upcoming: { ko: "예정", en: "Upcoming" },
  cal_past: { ko: "결과", en: "Released" },
  cal_none_up: { ko: "남은 일정 없음", en: "No upcoming events" },
  cal_none_past: { ko: "발표된 결과 없음", en: "No releases" },
  confirmed: { ko: "CONFIRMED", en: "CONFIRMED" },
  source: { ko: "출처", en: "Source" },
} as const
