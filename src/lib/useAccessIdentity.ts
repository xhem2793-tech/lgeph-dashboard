"use client"

import { useEffect, useState } from "react"
import { getSession, fetchPrefs, pushPref } from "@/lib/authClient"

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

/** 로그인 사용자별 설정 저장 — localStorage를 email로 네임스페이스(같은 PC 공유해도 사용자별 분리).
 *  읽기는 localStorage(동기·즉시). 기기 간 동기화는 로그인 시 hydratePrefs()가 DB→localStorage로 채워준다. */
export function userPref<T>(email: string | null | undefined, key: string, fallback: T): T {
  if (typeof window === "undefined" || !email) return fallback
  try { const v = localStorage.getItem("axpref:" + email + ":" + key); return v == null ? fallback : (JSON.parse(v) as T) } catch { return fallback }
}
export function setUserPref<T>(email: string | null | undefined, key: string, value: T) {
  if (typeof window === "undefined" || !email) return
  try { localStorage.setItem("axpref:" + email + ":" + key, JSON.stringify(value)) } catch {}
  // DB에도 저장(기기 간 동기화). 실패해도 로컬은 이미 반영됨(fire-and-forget).
  void pushPref(key, value)
}

/** 로그인 직후 호출 — DB의 계정 설정을 localStorage로 내려받아 이 기기에 반영(기기 간 동기화).
 *  DB에 값이 있으면 그것을 우선(다른 기기서 바꾼 최신 설정 반영). */
export async function hydratePrefs(email: string | null | undefined): Promise<void> {
  if (typeof window === "undefined" || !email) return
  const data = await fetchPrefs()
  if (!data) return
  for (const [k, v] of Object.entries(data)) {
    try { localStorage.setItem("axpref:" + email + ":" + k, JSON.stringify(v)) } catch {}
  }
}
