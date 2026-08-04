"use client"

import { useEffect, useState } from "react"

/** Cloudflare Access가 인증한 로그인 사용자 신원(이메일·이름)을 읽는다.
 *  · Access 뒤(axlgeph.report)에서는 `/cdn-cgi/access/get-identity`가 신원 JSON을 반환.
 *  · Access가 없는 환경(로컬·pages.dev 프리뷰)에서는 실패 → null (개발/미리보기 대응).
 *  개인화(개인 설정)는 이 email을 키로 사용한다. */
export type AccessIdentity = { email: string; name: string } | null

export function useAccessIdentity(): AccessIdentity {
  const [id, setId] = useState<AccessIdentity>(null)
  useEffect(() => {
    let alive = true
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
