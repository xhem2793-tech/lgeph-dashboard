# 리포트 발행 파이프라인

리포트 1건을 **발행**하면 (1) 대시보드에 자동 노출되고 (2) 법인 수신자에게 이메일이 나갑니다.
SONA 브리핑·주간 인사이트(주 1회) 모두 같은 경로를 씁니다.

## 사용법

```bash
# 1. 스펙 JSON 작성 (report.example.json 복사해서 수정)
# 2. PDF·썸네일(JPG)을 스펙에서 가리키는 경로에 둔다
# 3. 발행
npm run publish-report -- ./my-report.json            # 대시보드 반영 + 이메일
npm run publish-report -- ./my-report.json --no-email  # 대시보드 반영만
npm run publish-report -- ./my-report.json --deploy    # + git commit/push(자동 배포)
```

## 동작 순서

1. **자산 복사** — PDF → `public/`, 썸네일 → `public/reports/<id>.jpg`
2. **매니페스트 upsert** — `public/reports/index.json`(최신순). 뉴스·리포트 페이지가
   런타임에 이 파일을 읽어 카드로 노출 → *발행 = 자동 대시보드 반영*
3. **이메일(Resend)** — 본문 인라인 썸네일 + PDF 첨부, 지정 수신자에게 발송
4. **배포** — `--deploy` 시 `git add/commit/push` → Cloudflare Pages 자동 빌드

## 주간 시장 인사이트 자동 발행 (`weekly-insight.mjs`)

SONA 브리핑 포맷을 참고한 **주 1회 자동 리포트**. Supabase 최신 데이터(거시·환율·에너지·정책 일정·경쟁 뉴스)를
수집해 단일 16:9 슬라이드를 조립하고, 헤드리스 Chrome 으로 PDF·JPG 를 렌더한 뒤 발행 파이프라인에 넘깁니다.
값은 전부 수집 데이터 기반이며(추정 금지) 변화(▲▼)는 직전 관측 대비 자동 계산.

```bash
npm run weekly-insight            # 생성 → 대시보드 반영(이메일 미발송)
npm run weekly-insight -- --send   # + 법인 이메일 발송(명시적일 때만)
npm run weekly-insight -- --deploy  # + git commit/push(자동 배포)
```

- **기본값은 이메일 미발송** — SONA 처럼 사람이 검토 후 `--send` 로만 발송.
- 스케줄: `.github/workflows/weekly-insight.yml` — 매주 월요일 09:00(Manila) 자동 실행,
  대시보드에 반영(커밋/푸시)하되 이메일은 보내지 않음(발송은 시크릿+`--send` 로 opt-in).

## Resend 키

`RESEND_API_KEY` 환경변수 또는 `scripts/.resendkey`(gitignore)에서 읽습니다.
키는 **절대 커밋 금지**. 노출 시 Resend 대시보드에서 즉시 회전(rotate)하세요.

## 매니페스트 스키마 (`public/reports/index.json`)

| 필드 | 설명 |
|---|---|
| `id` | 고유 슬러그(upsert 키) |
| `title` / `summary` / `so` | 제목 · 요약 · 시사점(SO WHAT) |
| `topic` | 뉴스 분류(규제·정책 / 인사이트 …) — 카드가 걸릴 카테고리 |
| `kind` | 리포트 종류 라벨(정책 브리핑 / 주간 인사이트 …) |
| `date` | 발행일 YYYY-MM-DD(정렬 기준) |
| `pdf` / `thumb` | 원문 PDF · 미리보기 이미지 경로 |
| `sentAt` / `recipients` | 이메일 발송일 · 수신 인원(발송 안 하면 null) |
