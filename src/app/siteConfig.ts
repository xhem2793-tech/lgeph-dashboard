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
    { name: "국가동향", href: "/news" },
    { name: "시장동향", href: "/competitors" },
    { name: "주요지표", href: "/economy" },
    { name: "마케팅", href: "/competitor-ads" },
    { name: "주요일정", href: "/calendar" },
    { name: "리포트", href: "/reports", divider: true, soon: true },
    { name: "날씨·재난", href: "/weather", soon: true },
  ] as { name: string; href: string; divider?: boolean; soon?: boolean }[],
  externalLink: {
    blocks: "https://blocks.tremor.so/templates#dashboard",
  },
}

export type siteConfig = typeof siteConfig
