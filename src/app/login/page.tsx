"use client"

import React from "react"
import { sendOtp, verifyOtp, isAllowed, getSession, signOut } from "@/lib/authClient"
import { T, useLang } from "@/lib/i18n"

/** 로그인 — Supabase 이메일 OTP(코드). Cloudflare Access와 사용감 동일(이메일→코드).
 *  허용된 이메일(@lge.com 또는 허용목록)만 접근. 성공 시 /news 로 이동. nav/웰컴 없이 독립 렌더.
 *  한/영 이중언어 — 누가 들어올지 몰라 화면 안에서 KO/EN 선택(기본 KO). */
export default function LoginPage() {
  const { lang, setLang } = useLang()
  const [step, setStep] = React.useState<"email" | "code">("email")
  const [email, setEmail] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [note, setNote] = React.useState<string | null>(null)

  // 이미 로그인돼 있으면 바로 진입
  React.useEffect(() => { if (getSession()) window.location.replace("/news/") }, [])

  const go = (path: string) => window.location.replace(path)

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null); setNote(null)
    const em = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setErr(T("올바른 이메일을 입력해 주세요", "Please enter a valid email")); return }
    setBusy(true)
    try {
      if (!(await isAllowed(em))) { setErr(T("접근 권한이 없는 이메일입니다. 관리자에게 문의해 주세요.", "This email is not authorized. Please contact the administrator.")); setBusy(false); return }
      await sendOtp(em)
      setStep("code"); setNote(T("이메일로 보낸 6자리 코드를 입력해 주세요.", "Enter the 6-digit code sent to your email."))
    } catch (e) { setErr(e instanceof Error ? e.message : T("발송 중 오류가 발생했습니다", "Something went wrong while sending")) }
    setBusy(false)
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (code.trim().length < 6) { setErr(T("6자리 코드를 입력해 주세요", "Enter the 6-digit code")); return }
    setBusy(true)
    try {
      await verifyOtp(email, code)
      if (!(await isAllowed(email))) { signOut(); setErr(T("접근 권한이 없는 계정입니다.", "This account is not authorized.")); setBusy(false); return }
      go("/news/")
    } catch (e) { setErr(e instanceof Error ? e.message : T("인증 실패", "Verification failed")); setBusy(false) }
  }

  const resend = async () => {
    setErr(null); setNote(null); setBusy(true)
    try { await sendOtp(email); setNote(T("코드를 다시 보냈습니다.", "Code sent again.")) } catch (e) { setErr(e instanceof Error ? e.message : T("재발송 실패", "Resend failed")) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-5 dark:from-gray-950 dark:via-gray-950 dark:to-indigo-950/40">
      {/* 오로라 오브 */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-300/30 blur-3xl dark:bg-indigo-500/15" />
      <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-fuchsia-300/25 blur-3xl dark:bg-fuchsia-500/12" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />

      <div className="relative w-full max-w-[400px] overflow-hidden rounded-[24px] bg-white/90 ring-1 ring-black/[0.06] shadow-[0_28px_80px_-24px_rgba(30,30,80,0.4)] backdrop-blur-xl dark:bg-gray-900/85 dark:ring-white/10"
        style={{ animation: "loPop .5s cubic-bezier(.34,1.42,.64,1) both" }}>
        <style>{"@keyframes loPop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}@keyframes loUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"}</style>
        <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400" />

        <div className="px-8 pb-8 pt-9">
          {/* 로고 + 언어 배지 */}
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-extrabold tracking-tight leading-none">
              <span className="text-gray-900 dark:text-gray-50">axlgeph</span><span className="text-indigo-600 dark:text-indigo-400">.report</span>
            </span>
            <span className="mt-0.5 text-[11px] font-semibold italic leading-none text-gray-400 dark:text-gray-500">beta</span>
            {/* 한/영 선택(기본 KO) — 넉넉한 알약 토글 */}
            <div className="ml-auto flex items-center rounded-full bg-gray-100 p-1 text-[12.5px] font-bold ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
              {(["ko", "en"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-label={l === "ko" ? "한국어" : "English"} className={"rounded-full px-3 py-1 leading-none transition-colors " + (lang === l ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200")}>{l === "ko" ? "KO" : "EN"}</button>
              ))}
            </div>
          </div>

          <h1 className="mt-5 text-[21px] font-extrabold leading-tight tracking-tight text-gray-900 dark:text-gray-50">
            {step === "email" ? T("로그인", "Sign in") : T("코드 확인", "Verify code")}
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400">
            {step === "email"
              ? T("필리핀법인 마켓 인텔리전스 대시보드. 사내 이메일로 로그인해 주세요.", "LGE Philippines Market Intelligence Dashboard. Sign in with your work email.")
              : <>{T("아래 이메일로 보낸 6자리 코드를 입력하세요: ", "Enter the 6-digit code sent to: ")}<b className="font-semibold text-gray-700 dark:text-gray-200">{email}</b></>}
          </p>

          {step === "email" ? (
            <form onSubmit={submitEmail} className="mt-6 flex flex-col gap-3" style={{ animation: "loUp .4s ease both" }}>
              <input
                type="email" autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@lge.com"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[14px] text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50 dark:focus:ring-indigo-500/20"
              />
              <button type="submit" disabled={busy}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-[14px] font-bold text-white shadow-md shadow-violet-600/25 transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:hover:translate-y-0">
                {busy ? T("확인 중…", "Checking…") : T("로그인 코드 받기", "Get login code")}
              </button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="mt-6 flex flex-col gap-3" style={{ animation: "loUp .4s ease both" }}>
              <input
                inputMode="numeric" autoFocus maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-[22px] font-bold tracking-[0.4em] text-gray-900 outline-none transition-all placeholder:tracking-[0.4em] placeholder:text-gray-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50 dark:focus:ring-indigo-500/20 tabular-nums"
              />
              <button type="submit" disabled={busy}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-[14px] font-bold text-white shadow-md shadow-violet-600/25 transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:hover:translate-y-0">
                {busy ? T("확인 중…", "Verifying…") : T("로그인", "Sign in")}
              </button>
              <div className="flex items-center justify-between text-[12px]">
                <button type="button" onClick={() => { setStep("email"); setCode(""); setErr(null); setNote(null) }} className="font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">{T("← 이메일 변경", "← Change email")}</button>
                <button type="button" onClick={resend} disabled={busy} className="font-semibold text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400">{T("코드 재발송", "Resend code")}</button>
              </div>
            </form>
          )}

          {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300" style={{ animation: "loUp .3s ease both" }}>{err}</p>}
          {note && !err && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" style={{ animation: "loUp .3s ease both" }}>{note}</p>}

          <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
            <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
              {T("사내 이메일(@lge.com) 또는 승인된 계정만 접근할 수 있습니다.", "Only work emails (@lge.com) or approved accounts can access this.")}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
              {T("접근에 문제가 있으신가요?", "Having trouble signing in?")}
              <a
                href={"mailto:xhem2793@gmail.com?subject=" + encodeURIComponent(T("[axlgeph.report] 접근 문의", "[axlgeph.report] Access inquiry"))}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
                {T("문의하기", "Contact admin")}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
