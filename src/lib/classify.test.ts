// 분류기 정확도·회귀 골든셋 — canonCode(병합코드)·유형(form)·사이즈 분류의 정답 케이스.
//   목적: 분류 로직을 튜닝할 때 기존 정답이 깨지는 것을 자동 감지(회귀 방지).
//   케이스 근거: 코드 주석의 분류 의도 + 실제 디버깅에서 확정한 엣지케이스(RBT=1Door·MRGB=QLED급·LG QLED가드 등).
import { describe, it, expect } from "vitest"
import { canonCode, refFormOf, wmFormOf, acFormOf, tvFormOf, pmSizeBucket, acHpBucket } from "./classify"

describe("canonCode — 거래선 병합코드(측정단위 토큰 제외·하이픈 결합)", () => {
  const cases: [string, string | null, string][] = [
    ["RBT-35SL 3.5CUFT FUJIDENZO REF", "N/A", "RBT35SL"],   // 3.5CUFT가 병합코드로 오인되던 버그 → 실제 코드 채택
    ["RDD-35T 3.5CUFT", null, "RDD35T"],                     // 서로 다른 소형모델이 5CUFT로 붕괴되면 안 됨
    ["LG InstaView Door-in-Door", "GR-X247CQES", "GRX247CQES"],
    ["GR-X247CQES", null, "GRX247CQES"],                     // ↑와 동일 코드로 병합돼야(거래선 표기차 흡수)
    ["Side by Side Refrigerator", "GR-B24FWCHL", "GRB24FWCHL"],
  ]
  it.each(cases)("canonCode(%s, %s) = %s", (model, code, expected) => {
    expect(canonCode(model, code)).toBe(expected)
  })
  it("측정단위 토큰(8KG·300L·1.5HP)은 병합코드가 아니다", () => {
    expect(canonCode("8KG 1.5HP 300L", null)).toBe("")
  })
})

describe("냉장고 유형 refFormOf", () => {
  const cases: [string, string | null][] = [
    ["Side by Side Refrigerator", "SxS"],
    ["Fujidenzo ISR-450 No Frost", "SxS"],       // ISR 코드 = 양문
    ["French Door Multi-door Ref", "F/D"],
    ["Top Freezer 2-door Refrigerator", "T/F"],
    ["RBT35SL 3.5CUFT", "1Door"],                // 소형 단문(양문 오분류 방지 확정 케이스)
    ["Chest Freezer 7 cu.ft", "Freezer"],
    ["Roller Stand for Appliance", null],        // 냉장고 아님(액세서리) → 배제
  ]
  it.each(cases)("refFormOf(%s) = %s", (m, expected) => {
    expect(refFormOf(m)).toBe(expected)
  })
})

describe("세탁기 유형 wmFormOf", () => {
  const cases: [string, string | null][] = [
    ["8kg Front Load Washing Machine", "F/L"],
    ["7kg Twin Tub Washer", "Twin Tub"],
    ["Fully Automatic Top Load 8kg", "T/L"],
    ["LG WashTower", "W/T"],
    ["9kg Heat Pump Dryer", "Dryer"],            // 단독 건조기(워셔 텍스트 없음)
    ["Washer and Dryer Combo", "F/L"],           // 세탁건조 콤보 → 프론트로드
    ["Samsung AirDresser Styler", null],         // 의류관리기 → 세탁기 아님
  ]
  it.each(cases)("wmFormOf(%s) = %s", (m, expected) => {
    expect(wmFormOf(m)).toBe(expected)
  })
})

describe("에어컨 유형 acFormOf", () => {
  const cases: [string, string | null][] = [
    ["1.5HP Window Type Aircon", "창문형"],
    ["2.0HP Split Type Inverter", "벽걸이형"],
    ["Portable Aircon 1.0HP", "포터블"],
    ["Floor Standing Aircon 3.0HP", "스탠드형"],
    ["Cassette Type Ceiling Aircon", "시스템"],
    ["Air Purifier with HEPA", null],            // 공기청정기 → 에어컨 아님
  ]
  it.each(cases)("acFormOf(%s) = %s", (m, expected) => {
    expect(acFormOf(m)).toBe(expected)
  })
})

describe("TV 유형 tvFormOf(등급 통합)", () => {
  const cases: [string, string | undefined, string | null][] = [
    ["55 inch OLED evo C4", "LG", "OLED"],
    ["QNED 65 inch", "LG", "QLED급"],
    ["Mini RGB 100 inch", "LG", "QLED급"],        // MRGB=2026 플래그십 → 프리미엄 등급 확정
    ["QLED 55 inch", "Samsung", "QLED급"],
    ["QLED 55 inch", "LG", "UHD"],                // LG의 'QLED' 오분류 가드(퀀텀닷 아님)
    ["32 inch HD LED TV", undefined, "FHD·HD"],   // 소형(≤32˝)은 명시 4K 아니면 FHD·HD
    ["50 inch UHD Smart TV", "Samsung", "UHD"],
  ]
  it.each(cases)("tvFormOf(%s, %s) = %s", (m, brand, expected) => {
    expect(tvFormOf(m, brand)).toBe(expected)
  })
})

describe("사이즈 버킷 pmSizeBucket / acHpBucket", () => {
  it.each<[string, string, string]>([
    ["냉장고", "6.3 cu.ft", "7cu.ft↓"],
    ["냉장고", "Side by Side 24 cu.ft", "22cu.ft↑"],
    ["세탁기", "10.5 kg", "8~11"],
    ["세탁기", "7 kg", "8kg↓"],
    ["TV", "50 inch", "43~54"],
    ["TV", "65 inch", "65~74"],
  ])("pmSizeBucket(%s, %s) = %s", (cat, model, expected) => {
    expect(pmSizeBucket(cat, model, null)).toBe(expected)
  })
  it.each<[string, string]>([
    ["1.5HP", "1.5HP"],
    ["2.5 HP", "2.5HP"],
    ["0.75HP", "0.75HP↓"],
  ])("acHpBucket(%s) = %s", (m, expected) => {
    expect(acHpBucket(m)).toBe(expected)
  })
})
