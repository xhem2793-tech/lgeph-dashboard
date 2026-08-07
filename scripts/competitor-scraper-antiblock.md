# 경쟁사 스크래퍼 — 차단 회피(anti-block) + 신규 거래선 파서 스펙

> 실제 스크래퍼는 **별도 repo의 GitHub Actions**에 있음. 이 문서는 그 repo에 그대로 이식할 수 있는 설계·코드 스켈레톤·파서 스펙이다. 대상: 공개 소매 가격 페이지(경쟁 인텔리전스, 준법: robots/ToS 존중·합리적 rate·로그인/개인정보 제외).

## 1. 왜 차단됐나 (근본 원인)
- **GitHub Actions 러너 = Azure 데이터센터 IP 대역.** 리테일러의 WAF/봇방지(Cloudflare 등)는 데이터센터 IP를 우선 차단·rate-limit → 우리 회사망 IP뿐 아니라 러너 IP도 막힘.
- 고정 UA·무헤더·고빈도 요청도 탐지 신호.

## 2. "절대 누락 없이" 차단 회피 — 다층 장치(defense-in-depth)
1. **레지덴셜/모바일 로테이팅 프록시(필수)** — 요청마다 PH 레지덴셜 IP 회전. 공급사 택1: Bright Data · Oxylabs · Smartproxy · IPRoyal · **Nimble**(이미 세션 검증됨, country=PH로 Desmark 우회 확인).
2. **UA·헤더 풀 회전** — 실브라우저 UA 20~30종 + Accept/Accept-Language(en-PH)/Referer/sec-ch-ua 랜덤.
3. **요청 페이싱·지터** — 페이지당 1.5~4s 랜덤 슬립, 거래선별 동시성 1~2로 제한.
4. **하이브리드 엔진** — 정적(HTTP: httpx/`curl_cffi`로 TLS 지문 위장)이 막히면 **헤드리스 브라우저(Playwright + stealth)** 로 폴백, 그것도 막히면 **스크래핑 API(Nimble/ScraperAPI)** 로 폴백. 3단 폴백 = 하드블록도 관통.
5. **세션·쿠키 유지** — 거래선별 세션 재사용(첫 진입 쿠키 확보 후 목록 순회).
6. **누락 방지(completeness)** — 목록의 "Showing X of N" 총계를 파싱 → 기대 페이지수 산출 → **수집 행수 != 기대치면 실패로 표기·재시도**(지수백오프 3~5회), 끝까지 실패한 페이지는 dead-letter 큐에 남겨 다음 런에서 우선 재수집. 부분 성공을 "성공"으로 커밋하지 않음.
7. **관측** — 거래선×런별 수집행수/기대치/차단율(403·429·챌린지)을 `v_ingest_health`류에 적재 → 대시보드 신선도 카드에서 감시(자정 실사와 연동).

## 3. GitHub Actions 반영 포인트
- Secrets: `PROXY_URL`(회전 게이트웨이) 또는 `NIMBLE_TOKEN`/`SCRAPERAPI_KEY`.
- 매트릭스로 거래선 병렬화(`strategy.matrix.retailer`), **T1은 매일, T2는 cron 주2~3회** 스케줄 분리.
- `fail-fast: false` + 재시도 스텝, 아티팩트로 dead-letter 업로드.
- 러너 IP 노출 최소화를 위해 **모든 아웃바운드는 프록시 경유**(직결 금지).

## 4. 신규 거래선 파서 스펙 (검증됨)
공통: WooCommerce 목록 `/(...)/page/{n}/`, 카드 = 제목(브랜드·용량·모델코드)·₱가격·상품URL. 모델코드는 제목 말미 영숫자 토큰 정규식.

| 거래선 | 목록 진입 | 특이 | LG |
|---|---|---|---|
| **Desmark** | `desmark.com.ph/product-category/appliances/home-appliances/{refrigerators\|washing-machines\|air-conditioners}/` 및 `/audio_video/video/tv/` · `page/{n}` | 448 SKU/28p, "Showing X of N"로 페이지수 산출, 브랜드 태그 `/product-tag/{brand}/` | ✓ |
| **Dueksam** | `dueksam.com.ph/appliances`, `shop_brand?brand={Brand}` | 가격 표기 O, 파나소닉·Fabriano 중심 | 확인 |
| **Magic** | `shopmagic.ph/magicappliance/` + Lazada 태그 | 몰 구조 | 확인 |
| **K-Servico** | `kservico.com.ph/product-category/home-appliance/` | **Emcor 계열 → 기존 Emcor와 dedup 필수** | 확인 |
| ~~GTC-Aldis~~ | — | B2B 유통사·소비자가 없음 → **제외** | 유통 |

카테고리 매핑: refrigerators→냉장고, washing-machines→세탁기, air-conditioners→에어컨(→classify가 RAC/SAC), tv→TV. `competitor_prices` 스키마(retailer/category/brand/model/price_php/srp_php/url/scraped_date/promo_text/installment/availability)에 맞춰 적재.

## 5. 파이썬 안티블록 레이어(스켈레톤)
```python
import random, time, httpx
UA_POOL = [ "...실브라우저 UA 20종..." ]
def headers():
    return {"User-Agent": random.choice(UA_POOL),
            "Accept-Language": "en-PH,en;q=0.9", "Accept": "text/html,...",
            "Referer": "https://www.google.com/"}
PROXY = os.environ["PROXY_URL"]  # 회전 레지덴셜 게이트웨이(요청마다 IP 교체)

def fetch(url, tries=5):
    for i in range(tries):
        try:
            r = httpx.get(url, headers=headers(), proxies=PROXY, timeout=30, follow_redirects=True)
            if r.status_code == 200 and "challenge" not in r.text.lower():
                return r.text
        except Exception: pass
        time.sleep((2**i) + random.random()*2)   # 지수 백오프 + 지터
    return nimble_fallback(url)                    # 3단 폴백(브라우저/스크래핑 API)

def scrape_woocommerce(cat_url):
    html = fetch(cat_url + "page/1/")
    total = parse_total(html)                      # "Showing 1–16 of 448" → 448
    pages = math.ceil(total/16); rows=[]
    for n in range(1, pages+1):
        rows += parse_cards(fetch(f"{cat_url}page/{n}/"))
        time.sleep(1.5 + random.random()*2.5)
    assert len(rows) >= total*0.95, f"누락 {len(rows)}/{total} → 재시도"  # 완결성 검증
    return rows
```
> 기존 Abenson/SM/Anson's 스크래퍼도 **같은 `fetch()`(프록시+UA+백오프+폴백)로 감싸면** 데이터센터 IP 차단이 사라진다. 신규 4곳은 `scrape_woocommerce`로 추가.
