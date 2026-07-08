export const siteConfig = {
  name: "LGE-PH 시장 인텔리전스",
  url: "https://axlgeph.report",
  description:
    "LG전자 필리핀법인 경영기획 — 필리핀 거시경제·가전시장 인텔리전스 대시보드",
  baseLinks: {
    home: "/",
    overview: "/overview",
    details: "/details",
    settings: "/settings",
  },
  nav: [
    { name: "대시보드", href: "/overview" },
    { name: "경제지표", href: "/economy" },
    { name: "주요뉴스", href: "/news" },
    { name: "경쟁사 가격", href: "/competitors" },
    { name: "캘린더", href: "/calendar" },
    { name: "부록", href: "/appendix" },
  ],
  externalLink: {
    blocks: "https://blocks.tremor.so/templates#dashboard",
  },
}

export type siteConfig = typeof siteConfig
