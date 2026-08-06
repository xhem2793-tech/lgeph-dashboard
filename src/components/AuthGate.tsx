"use client"

import React from "react"
import { getSession, ensureSession, SUPABASE_AUTH_ENABLED } from "@/lib/authClient"
import { hydratePrefs } from "@/lib/useAccessIdentity"

/** 앱 접근 가드 — SUPABASE_AUTH_ENABLED가 true일 때만 세션을 강제한다.
 *  기본(false): 무동작으로 children 그대로 렌더(현재는 Cloudflare Access가 보호 → 이중 로그인 방지).
 *  Access를 끄고 전환할 때 authClient의 플래그를 true로 바꾸면, 세션 없을 시 /login으로 유도. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = React.useState(!SUPABASE_AUTH_ENABLED)
  React.useEffect(() => {
    if (!SUPABASE_AUTH_ENABLED) return
    let alive = true
    const s0 = getSession()
    if (s0) { setOk(true); void hydratePrefs(s0.email); return }
    // 액세스 토큰이 만료됐어도 리프레시 토큰으로 자동 갱신 시도 → 세션 지속(재로그인 최소화)
    ensureSession().then((s) => {
      if (!alive) return
      if (s) { setOk(true); void hydratePrefs(s.email) }
      else window.location.replace("/login/")
    })
    return () => { alive = false }
  }, [])
  if (!ok) return null
  return <>{children}</>
}
