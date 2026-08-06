# -*- coding: utf-8 -*-
import os
from PIL import Image, ImageDraw

FOLDER = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(FOLDER, "publish")          # 별도 발행 폴더
os.makedirs(OUT, exist_ok=True)
CELL_W = 1560
GAP = 26
MARGIN = 34
BG = (255, 255, 255)
BORDER = (223, 226, 232)

GROUPS = [
    ("1_시작", 2, [
        "01_로그인.jpg",
        "02_웰컴팝업.jpg",
    ]),
    ("2_국가동향", 2, [
        "03_국가동향.jpg",
        "화면 캡처 2026-08-05 110243.png",
        "04_국가동향_기사팝업.jpg",
        "화면 캡처 2026-08-05 132125.png",   # 정책동향 기사 팝업(NCR 최저임금 TRO)
    ]),
    ("3_시장동향", 2, [
        "05_시장동향_채널별가격.jpg",
        "06_시장동향_일일변동.jpg",
        "화면 캡처 2026-08-05 110001.png",
        "화면 캡처 2026-08-05 110506.png",
        "화면 캡처 2026-08-05 110137.png",
        "화면 캡처 2026-08-05 110215.png",
    ]),
    ("4_주요지표", 2, [
        "10_주요지표.jpg",
        "화면 캡처 2026-08-05 110320.png",
    ]),
    ("5_마케팅", 2, [
        "11_마케팅.jpg",
        "12_마케팅_광고팝업.jpg",
    ]),
    ("6_주요일정", 2, [
        "13_주요일정.jpg",
        "화면 캡처 2026-08-05 132149.png",   # 이벤트 목록
    ]),
    ("7_지역시장지도", 2, [
        "17_지역시장지도_전체.jpg",
        "18_지역시장지도_물가.jpg",
        "화면 캡처 2026-08-05 110355.png",   # 인프라 투자(중부루손)
        "화면 캡처 2026-08-05 132425.png",   # 인구·소득(중부비사야스)
    ]),
]

def load_cell(fn):
    fp = os.path.join(FOLDER, fn)
    if not os.path.exists(fp):
        print("MISSING:", fn); return None
    im = Image.open(fp).convert("RGB")
    w, h = im.size
    if w != CELL_W:
        im = im.resize((CELL_W, round(h * CELL_W / w)), Image.LANCZOS)
    ImageDraw.Draw(im).rectangle([0, 0, im.size[0]-1, im.size[1]-1], outline=BORDER, width=2)
    return im

for suffix, cols, files in GROUPS:
    cells = [c for c in (load_cell(f) for f in files) if c]
    if not cells:
        continue
    rows = (len(cells) + cols - 1) // cols
    row_h = [0]*rows
    for i, c in enumerate(cells):
        row_h[i//cols] = max(row_h[i//cols], c.size[1])
    total_w = MARGIN*2 + cols*CELL_W + (cols-1)*GAP
    total_h = MARGIN*2 + sum(row_h) + (rows-1)*GAP
    canvas = Image.new("RGB", (total_w, total_h), BG)
    y = MARGIN
    for r in range(rows):
        x = MARGIN
        for cidx in range(cols):
            i = r*cols + cidx
            if i >= len(cells): break
            canvas.paste(cells[i], (x, y))
            x += CELL_W + GAP
        y += row_h[r] + GAP
    canvas.save(os.path.join(OUT, f"{suffix}.png"), "PNG")
    print(f"{suffix}: {len(cells)} imgs {canvas.size[0]}x{canvas.size[1]}")
