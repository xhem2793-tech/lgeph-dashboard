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
import { siteConfig } from "./siteConfig"

export const metadata: Metadata = {
  metadataBase: new URL("https://yoururl.com"),
  title: siteConfig.name,
  description: siteConfig.description,
  keywords: [],
  authors: [
    {
      name: "yourname",
      url: "",
    },
  ],
  creator: "yourname",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: "Tremor OSS Dashboard",
    creator: "@tremorlabs",
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
      <body
        className={`${inter.className} ${publicSans.variable} ${plexNum.variable} overflow-y-scroll scroll-auto antialiased selection:bg-indigo-100 selection:text-indigo-700 dark:bg-gray-950`}
        suppressHydrationWarning
      >
        <div className="mx-auto max-w-screen-2xl">
          <ThemeProvider defaultTheme="system" attribute="class">
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
