# PRIVATE 접근 설정 — Outlook(Microsoft Entra ID) 기반, LG전자 계정 전용

axlgeph.report(Cloudflare Pages 정적 배포)를 **허락된 계정만** 접근 가능하게 만드는 설정 가이드.
정적 사이트라 앱 코드 변경 없이 **엣지(Cloudflare Access)** 에서 인증을 거는 방식이 가장 안전·간단하다.

## 권장안 — Cloudflare Access (Zero Trust) + Microsoft Entra ID

사용자가 사이트에 접속하면 → Microsoft(Outlook/회사계정) 로그인 → **@lge.com(또는 지정 그룹)** 만 통과.
- **앱 코드 변경 0** (빌드/배포 그대로). 로그인·세션·리다이렉트를 Cloudflare가 엣지에서 처리.
- Zero Trust **무료 플랜: 최대 50 사용자** 무료(초과 시 사용자당 과금).
- 로그인 실패/미허가 계정은 사이트 자체가 안 보임(콘텐츠 노출 0).

### 1) Microsoft Entra ID(Azure AD) 앱 등록 — LG전자 IT/관리자
1. Entra 관리센터 → App registrations → New registration
   - Name: `axlgeph-report-access`
   - Redirect URI(Web): `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`
     (`<team-name>` = 2)단계에서 정하는 Cloudflare Zero Trust 팀 도메인)
2. Certificates & secrets → New client secret → 값 복사(Application secret)
3. Overview에서 **Application (client) ID**, **Directory (tenant) ID** 복사
4. API permissions → Microsoft Graph → Delegated: `openid`, `email`, `profile`, `offline_access`, (그룹 제한 쓰면 `GroupMember.Read.All`) → Grant admin consent

### 2) Cloudflare Zero Trust — IdP 연결
Cloudflare 대시보드 → Zero Trust → Settings → Authentication → Login methods → Add new → **Azure AD**
- App ID / Client secret / Directory(tenant) ID 입력
- (선택) "Support groups" 체크 시 Entra 보안그룹으로 정밀 제한 가능

### 3) Access Application + 정책
Zero Trust → Access → Applications → Add an application → **Self-hosted**
- Application domain: `axlgeph.report` (+ 필요 시 `www.axlgeph.report`)
- Identity providers: 위에서 추가한 Azure AD
- Policy(허용 기준) — 택1:
  - **이메일 도메인**: Selector `Emails ending in` = `@lge.com`  ← 가장 간단
  - **Entra 그룹**: Selector `Azure groups` = `<대시보드 승인 그룹>`  ← 세밀한 제어
- Session Duration: 24h(권장)

### 4) 확인
- 시크릿창으로 `https://axlgeph.report` 접속 → Microsoft 로그인 화면 → @lge.com 로그인 시 통과, 외부 계정은 차단.

## 대안 — 앱 레벨(MSAL) 인증
정적 export를 유지하면서 클라이언트에서 MSAL로 로그인 게이트를 두는 방법. 단점: 콘텐츠가 번들에 포함되어 완전 차단이 아니고(민감 데이터 노출 위험), 구현·유지비 큼. **비권장.** (Cloudflare Access가 더 안전)

## 결정 필요 사항(사용자 확인)
- [ ] 허용 기준: **@lge.com 전체** vs **특정 Entra 보안그룹**(그룹명?)
- [ ] Cloudflare Zero Trust 팀 도메인(`<team-name>`) 신규 생성 가능 여부
- [ ] Entra 앱 등록 주체: 직접 가능 / LG전자 IT 협조 필요
- [ ] 예상 사용자 수(50명 무료 플랜 내인지)
