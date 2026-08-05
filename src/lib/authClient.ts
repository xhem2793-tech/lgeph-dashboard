"use client"

/** Supabase Auth (이메일 OTP 코드) — SDK 없이 REST로 구현.
 *  · 앱이 이미 익명키로 REST를 쓰므로 동일 키 사용. 번들 추가 없음.
 *  · 플로우: 이메일 입력 → /auth/v1/otp(코드 메일 발송) → 6자리 코드 입력 → /auth/v1/verify → 세션 토큰 저장.
 *  · 허용목록: verify 성공 후 RPC is_email_allowed(email)로 접근 허용 판정(목록은 비노출).
 *  · Cloudflare Access와 병행 가능. SUPABASE_AUTH_ENABLED가 true일 때만 AuthGate가 강제한다. */

const SB_URL = "https://ozvbyigntwhwzzagwojr.supabase.co"
const SB_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dmJ5aWdudHdod3p6YWd3b2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODkxNDEsImV4cCI6MjA5ODQ2NTE0MX0.LrkBzEK9QzX1PCNm9KzTUZE29VcHuJOqikFOnbEpv6U"

const LS_KEY = "ax_sb_session"

/** 인증 강제 스위치 — 기본 false(현재는 Cloudflare Access가 보호).
 *  Access를 끄고 Supabase 로그인으로 전환할 때 true로 바꾸고 배포하면 AuthGate가 /login으로 유도한다. */
export const SUPABASE_AUTH_ENABLED = true

export type AuthSession = { access_token: string; refresh_token: string; expires_at: number; email: string }

export function getSession(): AuthSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "null") as AuthSession | null
    if (s && s.access_token && s.expires_at > Date.now() / 1000 + 30) return s
  } catch {}
  return null
}

export function signOut() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

/** 이메일로 6자리 코드 발송. create_user:true라 최초 로그인도 허용(접근 통제는 허용목록으로). */
export async function sendOtp(email: string): Promise<void> {
  const r = await fetch(`${SB_URL}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: SB_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), create_user: true }),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({} as Record<string, string>))
    throw new Error(e.msg || e.error_description || e.error || `발송 실패(${r.status})`)
  }
}

/** 6자리 코드 검증 → 세션 저장 후 반환. */
export async function verifyOtp(email: string, token: string): Promise<AuthSession> {
  const r = await fetch(`${SB_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: SB_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "email", email: email.trim(), token: token.trim() }),
  })
  const d = await r.json().catch(() => ({} as Record<string, unknown>))
  if (!r.ok || !d.access_token) {
    throw new Error((d.msg as string) || (d.error_description as string) || "코드가 올바르지 않거나 만료되었습니다")
  }
  const sess: AuthSession = {
    access_token: d.access_token as string,
    refresh_token: (d.refresh_token as string) ?? "",
    expires_at: (d.expires_at as number) ?? Math.floor(Date.now() / 1000) + ((d.expires_in as number) || 3600),
    email: email.trim(),
  }
  try { localStorage.setItem(LS_KEY, JSON.stringify(sess)) } catch {}
  return sess
}

/** 접근 허용 판정(RPC) — 목록 비노출. 허용목록 이메일 또는 @lge.com 도메인이면 true. */
export async function isAllowed(email: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/is_email_allowed`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ check_email: email.trim() }),
    })
    if (!r.ok) return false
    return (await r.json()) === true
  } catch { return false }
}
