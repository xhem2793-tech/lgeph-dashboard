"use client"

import React from "react"
import { useTheme } from "next-themes"
import { useAccessIdentity, userPref, setUserPref } from "@/lib/useAccessIdentity"
import { T } from "@/lib/i18n"

/** 내 설정 — 로그인 사용자(Cloudflare Access 신원)별 개인화. 이메일로 네임스페이스해 저장(같은 PC 공유해도 분리). */

const HOME_OPTS = [
  { href: "/news", label: "국가동향" },
  { href: "/competitors", label: "시장동향" },
  { href: "/economy", label: "주요지표" },
  { href: "/competitor-ads", label: "마케팅" },
  { href: "/reports", label: "리포트" },
]
const PROD_OPTS = ["전체", "에어컨", "냉장고", "세탁기", "TV"]
const homeLabel = (href: string): string =>
  href === "/news" ? T("국가동향", "News")
  : href === "/competitors" ? T("시장동향", "Market")
  : href === "/economy" ? T("주요지표", "Indicators")
  : href === "/competitor-ads" ? T("마케팅", "Marketing")
  : href === "/reports" ? T("리포트", "Reports")
  : ""

export default function MePage() {
  const me = useAccessIdentity()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [home, setHome] = React.useState("/news")
  const [prod, setProd] = React.useState("전체")
  const [favN, setFavN] = React.useState(0)
  React.useEffect(() => setMounted(true), [])
  // 저장된 개인 설정 로드(이메일 확정 후)
  React.useEffect(() => {
    if (!me) return
    setHome(userPref(me.email, "home", "/news"))
    setProd(userPref(me.email, "prod", "전체"))
    try { const f = localStorage.getItem("ind_fav"); if (f) setFavN((JSON.parse(f) as string[]).length) } catch {}
  }, [me])
  const cur = mounted ? ((theme === "system" ? resolvedTheme : theme) === "dark" ? "dark" : "light") : "light"

  const saveHome = (h: string) => { setHome(h); if (me) setUserPref(me.email, "home", h) }
  const saveProd = (p: string) => { setProd(p); if (me) setUserPref(me.email, "prod", p) }

  return (
    <main className="mx-auto w-full max-w-[760px] px-6 pb-14 pt-4 sm:px-8" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>

      {/* 헤더 — 인사 + 신원 */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-fuchsia-50/50 p-5 dark:border-indigo-500/20 dark:from-indigo-500/[0.07] dark:via-gray-950 dark:to-fuchsia-500/[0.05]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-fuchsia-200/30 blur-3xl dark:bg-fuchsia-500/10" />
        <div className="relative flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[20px] font-extrabold uppercase text-white shadow-sm">{me ? me.name.slice(0, 1) : "·"}</span>
          <div className="min-w-0">
            <h1 className="text-[19px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">{me ? T("안녕하세요, ", "Hello, ") + me.name + T("님", "") : T("내 설정", "My Settings")}</h1>
            <p className="mt-0.5 truncate text-[12.5px] text-gray-500 dark:text-gray-400">{me ? me.email + T(" · 로그인 계정 기준으로 저장됩니다", " · Saved per signed-in account") : T("로그인 후 개인화가 적용됩니다", "Personalization applies after sign-in")}</p>
          </div>
        </div>
      </div>

      {!me && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {T("현재 로그인 신원을 읽지 못했습니다(미리보기·개발 환경). ", "Could not read your sign-in identity (preview / development environment). ")}<b>axlgeph.report</b>{T("에서 로그인하면 계정별로 설정이 저장됩니다. 아래 설정은 이 브라우저에 임시 저장됩니다.", " — sign in there to save settings per account. The settings below are stored temporarily in this browser.")}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* 기본 시작 페이지 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40 sm:p-5">
          <h2 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{T("기본 시작 페이지", "Default landing page")}</h2>
          <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{T("로고를 클릭하면 이동할 나의 홈 화면입니다.", "The home screen you go to when you click the logo.")}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {HOME_OPTS.map((o) => {
              const on = home === o.href
              return <button key={o.href} type="button" onClick={() => saveHome(o.href)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-all duration-200 active:scale-95 " + (on ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25" : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:text-indigo-600 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:text-indigo-300")}>{homeLabel(o.href)}</button>
            })}
          </div>
        </section>

        {/* 기본 제품 필터 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40 sm:p-5">
          <h2 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{T("관심 제품(기본 필터)", "Preferred products (default filter)")}</h2>
          <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{T("시장동향·마케팅 등에서 우선 보고 싶은 제품군입니다.", "The product group you want to see first in Market, Marketing and more.")}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PROD_OPTS.map((p) => {
              const on = prod === p
              return <button key={p} type="button" onClick={() => saveProd(p)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-all duration-200 active:scale-95 " + (on ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25" : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:text-indigo-600 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:text-indigo-300")}>{p}</button>
            })}
          </div>
        </section>

        {/* 테마 + 즐겨찾기 */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40 sm:p-5">
            <h2 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{T("테마", "Theme")}</h2>
            <div className="mt-3 inline-flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
              {([["light", T("라이트", "Light")], ["dark", T("다크", "Dark")]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTheme(k)} className={"rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all " + (cur === k ? "bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-gray-50" : "text-gray-500 dark:text-gray-400")}>{l}</button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40 sm:p-5">
            <h2 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{T("즐겨찾기 지표", "Favorite indicators")}</h2>
            <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">{T("주요지표 리스트에서 ☆로 담은 지표 ", "Indicators starred (☆) in the Key Indicators list: ")}<b className="tabular-nums text-indigo-600 dark:text-indigo-400">{favN}</b>{T("개", "")}</p>
            <a href="/economy" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{T("주요지표에서 관리 →", "Manage in Key Indicators →")}</a>
          </div>
        </section>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">{T("개인 설정은 ", "Personal settings are stored in this browser, keyed to your ")}<b>{T("로그인 계정(이메일)", "signed-in account (email)")}</b>{T(" 기준으로 이 브라우저에 저장됩니다. 다른 기기에서도 동일하게 쓰려면 계정 동기화(서버 저장)를 추후 지원할 수 있습니다.", ". Cross-device sync (server storage) may be supported later.")}</p>
    </main>
  )
}
