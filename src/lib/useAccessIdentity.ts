"use client"

import { useEffect, useState } from "react"
import { getSession } from "@/lib/authClient"

/** 로그인 사용자 신원(이메일·이름)을 읽는다.
 *  · 1순위: Supabase 세션(현재 로그인 방식) — getSession().email.
 *  · 2순위: Cloudflare Access 신원 `/cdn-cgi/access/get-identity`(Access 뒤일 때 이름 등 보강).
 *  · 둘 다 없으면 null(로컬·프리뷰). 개인화(개인 설정)는 이 email을 키로 사용한다. */
export type AccessIdentity = { email: string; name: string } | null

export function useAccessIdentity(): AccessIdentity {
  const [id, setId] = useState<AccessIdentity>(null)
  useEffect(() => {
    let alive = true
    // 1) Supabase 세션 우선 — 현재 로그인 게이트가 Supabase OTP이므로 여기서 신원 확보
    const s = getSession()
    if (s?.email) setId({ email: s.email, name: s.email.split("@")[0] })
    // 2) Cloudflare Access 신원도 시도 — 있으면 실명 등으로 보강(없으면 무시)
    fetch("/cdn-cgi/access/get-identity", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || !d.email) return
        const email = String(d.email)
        const name = (d.name && String(d.name).trim()) || email.split("@")[0]
        setId({ email, name })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return id
}

/** 로그인 사용자별 설정 저장 — localStorage를 email로 네임스페이스(같은 PC 공유해도 사용자별 분리). */
export function userPref<T>(email: string | null | undefined, key: string, fallback: T): T {
  if (typeof window === "undefined" || !email) return fallback
  try { const v = localStorage.getItem("axpref:" + email + ":" + key); return v == null ? fallback : (JSON.parse(v) as T) } catch { return fallback }
}
export function setUserPref<T>(email: string | null | undefined, key: string, value: T) {
  if (typeof window === "undefined" || !email) return
  try { localStorage.setItem("axpref:" + email + ":" + key, JSON.stringify(value)) } catch {}
}
