import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { Inter, Public_Sans, IBM_Plex_Sans } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

/** EN 모드 본문 — Yahoo Finance(GT America)는 상용 폰트라 사용 불가.
 *  같은 계열(중립 그로테스크) 오픈폰트 Public Sans로 대체하고, 숫자는 tabular로 고정한다.
 *  레이아웃은 한글 기준 고정 — globals.css에서 자간을 미세 조정해 폭이 늘지 않게 한다 */
const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-sans",
})

const plexNum = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-num" })

import { TopNav } from "@/components/ui/navigation/TopNav"
import { LangProvider } from "@/lib/i18n"
import ThemeTransition from "@/components/ThemeTransition"
import { siteConfig } from "./siteConfig"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.name,
  description: siteConfig.description,
  keywords: ["LG전자", "필리핀", "가전시장", "경쟁사 가격", "거시경제", "시장 인텔리전스", "LGE-PH"],
  authors: [{ name: "LGE-PH 경영기획", url: siteConfig.url }],
  creator: "LGE-PH 경영기획",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Supabase — 데이터 fetch 전에 TLS 미리 수립(채널별 가격비교 등 초기 로딩 cold 비용 제거) */}
        <link rel="preconnect" href="https://ozvbyigntwhwzzagwojr.supabase.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://ozvbyigntwhwzzagwojr.supabase.co" />
        {/* 한글 본문 폰트 — 지도와 통일(Pretendard). 동적 서브셋으로 필요한 글자만 로드 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css" />
      </head>
      <body
        className={`${inter.variable} ${publicSans.variable} ${plexNum.variable} overflow-y-scroll scroll-auto antialiased selection:bg-indigo-100 selection:text-indigo-700 dark:bg-gray-950`}
        suppressHydrationWarning
      >
        <div className="w-full">
          <ThemeProvider defaultTheme="system" attribute="class">
            <ThemeTransition />
            <LangProvider>
              <TopNav />
              <main>{children}</main>
            </LangProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  )
}
