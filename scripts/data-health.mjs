// 데이터 품질·신선도 게이트 — 매일 수집 파이프라인이 "조용히 죽는" 것을 감지한다.
//   · Supabase 뷰 v_data_health(유통별 최신일·오늘 행수·7일평균 대비 상태)를 조회
//   · 전체 신선도(staleness_days) 또는 유통별 FAIL(실종/급감) 발생 시 프로세스를 실패(exit 1)시킴
//     → GitHub Actions 잡이 실패로 표시되고 저장소 오너에게 자동 이메일(외부 서비스 불필요)
//   · 외부 알림 툴은 시크릿만 넣으면 자동 연동(없으면 조용히 건너뜀):
//       SLACK_WEBHOOK_URL     : FAIL/WARN 시 슬랙 메시지
//       HEARTBEAT_URL         : 성공 시 핑(healthchecks.io·Better Stack·Sentry Crons 공통 패턴 — 핑이 끊기면 그쪽에서 경보)
//   설정(선택): STALE_MAX_DAYS(기본 2) — 전체 데이터가 며칠 이상 낡으면 실패로 볼지
//   접속정보는 공개(publishable) 값이라 기본값으로 내장 — 필요 시 SUPABASE_URL/SUPABASE_ANON_KEY 환경변수로 override

const URL = process.env.SUPABASE_URL || "https://ozvbyigntwhwzzagwojr.supabase.co"
const KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dmJ5aWdudHdod3p6YWd3b2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODkxNDEsImV4cCI6MjA5ODQ2NTE0MX0.LrkBzEK9QzX1PCNm9KzTUZE29VcHuJOqikFOnbEpv6U"
const STALE_MAX = Number(process.env.STALE_MAX_DAYS || 2)

async function main() {
  const res = await fetch(`${URL}/rest/v1/v_data_health?select=*`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) {
    console.error(`[헬스] v_data_health 조회 실패 HTTP ${res.status}\n${await res.text()}`)
    process.exit(2)
  }
  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("[헬스] 데이터 없음 — 수집 파이프라인 전면 중단 의심")
    await notify("🔴 데이터 헬스: v_data_health 결과 없음 (수집 전면 중단 의심)")
    process.exit(1)
  }

  const staleness = Number(rows[0].staleness_days ?? 0)
  const latest = rows[0].latest_date
  const fails = rows.filter((r) => r.status === "FAIL")
  const warns = rows.filter((r) => r.status === "WARN")

  // 리포트 출력(Actions 로그에 남음)
  console.log(`[헬스] 최신 수집일=${latest} · 경과 ${staleness}일 · 유통 ${rows.length}곳`)
  for (const r of rows) {
    const mark = r.status === "FAIL" ? "❌" : r.status === "WARN" ? "⚠️ " : "✅"
    console.log(`  ${mark} ${r.retailer.padEnd(22)} 오늘 ${String(r.today_rows).padStart(5)}  (7일평균 ${r.avg7})  last=${r.last_seen}`)
  }

  const stale = staleness > STALE_MAX
  // 가격 정합성(이상치) 검사 — 신선도·건수는 정상이어도 스크래핑 오류로 말도 안 되는 가격이 섞일 수 있음
  let outlierFail = false
  const sanityLines = []
  try {
    const sres = await fetch(`${URL}/rest/v1/v_data_sanity?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    if (sres.ok) {
      const s = (await sres.json())[0]
      if (s) {
        const outliers = Number(s.outlier_rows || 0)
        const total = Number(s.latest_priced_rows || 0)
        console.log(`[헬스] 가격 정합성 · 이상치 ${outliers}건 / ${total}행 · 범위 ₱${s.min_price}~₱${s.max_price}`)
        if (outliers > 0) {
          const limit = Math.max(5, Math.round(total * 0.01))   // 1% 또는 5건 초과 시 FAIL, 이하 WARN
          const msg = `가격 이상치 ${outliers}건(범위 ₱${s.min_price}~₱${s.max_price}) — 스크래핑 파싱 오류 의심`
          if (outliers > limit) { outlierFail = true; sanityLines.push(`이상치 과다(FAIL): ${msg}`) }
          else sanityLines.push(`이상치 경고(WARN): ${msg}`)
        }
      }
    } else {
      console.error(`[헬스] v_data_sanity 조회 실패 HTTP ${sres.status}`)
    }
  } catch (e) { console.error("[헬스] 정합성 검사 예외:", e?.message || e) }

  const bad = stale || fails.length > 0 || outlierFail

  // 요약 메시지 구성
  const lines = []
  if (stale) lines.push(`전체 신선도 이상: 최신 수집일 ${latest} (${staleness}일 경과, 임계 ${STALE_MAX}일)`)
  if (fails.length) lines.push(`수집 실패/급감(FAIL): ${fails.map((r) => `${r.retailer}(오늘 ${r.today_rows}/평균 ${r.avg7})`).join(", ")}`)
  if (warns.length) lines.push(`감소 경고(WARN): ${warns.map((r) => `${r.retailer}(오늘 ${r.today_rows}/평균 ${r.avg7})`).join(", ")}`)
  lines.push(...sanityLines)

  if (bad) {
    await notify(`🔴 데이터 헬스 실패 — ${latest}\n` + lines.join("\n"))
    console.error("\n[헬스] 실패:\n" + lines.join("\n"))
    process.exit(1)
  }

  if (warns.length || sanityLines.length) {
    await notify(`⚠️ 데이터 헬스 경고 — ${latest}\n` + lines.join("\n"))
    console.log("\n[헬스] 경고(빌드는 통과):\n" + lines.join("\n"))
  } else {
    console.log("\n[헬스] 정상 — 전 유통 수집·가격 정합성 확인")
  }

  // 성공(FAIL 아님) 시 하트비트 핑 — 끊기면 모니터가 대신 경보
  if (process.env.HEARTBEAT_URL) {
    try { await fetch(process.env.HEARTBEAT_URL) } catch { /* 하트비트 실패는 무시 */ }
  }
}

async function notify(text) {
  const hook = process.env.SLACK_WEBHOOK_URL
  if (!hook) return
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
  } catch (e) {
    console.error("[헬스] 슬랙 알림 실패:", e?.message || e)
  }
}

main().catch((e) => {
  console.error("[헬스] 예외:", e?.stack || e)
  process.exit(2)
})
