# PRIVATE 접근 설정 — Cloudflare Access + 이메일 허용리스트(One-time PIN)

axlgeph.report(Cloudflare Pages 정적 배포)를 **승인된 개별 계정만** 접근 가능하게 만드는 설정.
**결정 사항**: Cloudflare Access / 개별 계정 허용리스트 / Entra 앱 등록 불가 → **One-time PIN(OTP)** 방식 채택.

## 왜 OTP(One-time PIN)인가
- **Entra ID(Azure AD) 앱 등록이 필요 없음** — 사내 IT 협조 없이 Cloudflare 대시보드만으로 완결.
- 사용자는 **이메일 입력 → 받은편지함(Outlook)으로 온 6자리 코드 입력 → 통과**.
- **허용리스트에 없는 이메일은 코드조차 못 받고 차단** — 콘텐츠 노출 0.
- Zero Trust **무료 플랜 최대 50인**. 앱 코드/배포 변경 0.

## 설정 절차 (Cloudflare 대시보드에서 전부 가능)

### 1) Zero Trust 팀 생성(최초 1회)
Cloudflare 대시보드 → **Zero Trust** 진입 → 팀 이름(team domain) 지정(예: `axlgeph`) → 무료 플랜 선택.

### 2) Access Application 추가
Zero Trust → **Access → Applications → Add an application → Self-hosted**
- **Application name**: axlgeph report
- **Session Duration**: 24 hours(권장)
- **Application domain**: `axlgeph.report`  (필요 시 `www.axlgeph.report` 도 추가)

### 3) 로그인 방법 = One-time PIN
Zero Trust → Settings → **Authentication → Login methods** 에 **One-time PIN** 이 기본 활성.
(별도 IdP/Entra 등록 불필요. Google/Azure 등은 추가하지 않아도 됨.)

### 4) 정책(Policy) — 개별 허용리스트
Application → **Add a policy**
- **Action**: Allow
- **Configure rules → Include → Selector: `Emails`** → 승인 계정 이메일을 하나씩 추가
  (예: `hong@lge.com`, `kim@lge.com` …)
  - 나중에 도메인 전체로 바꾸려면 Selector `Emails ending in` = `@lge.com` 로 교체.
- Save.

### 5) 확인
시크릿창에서 `https://axlgeph.report` 접속 → 이메일 입력 화면 → 허용리스트 계정으로 코드 수신·입력 시 통과, 그 외 차단.

## 운영 메모
- **계정 추가/삭제**: 위 정책의 Emails 목록만 수정하면 즉시 반영(재배포 불필요).
- **여러 명 반복 입력 관리**: 인원이 늘면 Cloudflare **Access Group**(이메일 목록 그룹)으로 묶어 여러 앱/정책에서 재사용.
- **로그아웃/세션**: `https://<team>.cloudflareaccess.com/cdn-cgi/access/logout` 로 로그아웃.
- **나중에 Entra(SSO) 전환**: IT 협조가 가능해지면 Login method에 Azure AD를 추가하고 정책을 그룹 기준으로 바꾸면 됨(무중단 전환). 상세 절차는 git 이력의 이전 버전 참고.

## 앱(레포) 측 필요 작업
- **없음.** 엣지에서 인증하므로 Next.js 빌드/배포는 그대로. (원하면 Access가 붙은 뒤 접근 거부 화면 커스터마이징만 대시보드에서 선택 가능.)
