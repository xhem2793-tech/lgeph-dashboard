# -*- coding: utf-8 -*-
import os, sys
from PIL import Image, ImageDraw

FOLDER = os.path.dirname(os.path.abspath(__file__))
COLS = int(sys.argv[1]) if len(sys.argv) > 1 else 3
CELL_W = 1560          # 원본 해상도에 가깝게 — 축소로 인한 추가 열화 방지
GAP = 26
MARGIN = 40
BG = (255, 255, 255)
BORDER = (223, 226, 232)

ORDER = [
    "01_로그인.jpg",
    "02_웰컴팝업.jpg",
    "03_국가동향.jpg",
    "화면 캡처 2026-08-05 110243.png",
    "04_국가동향_기사팝업.jpg",
    "화면 캡처 2026-08-05 132125.png",
    "05_시장동향_채널별가격.jpg",
    "06_시장동향_일일변동.jpg",
    "화면 캡처 2026-08-05 110001.png",
    "화면 캡처 2026-08-05 110506.png",
    "화면 캡처 2026-08-05 110137.png",
    "화면 캡처 2026-08-05 110215.png",
    "10_주요지표.jpg",
    "화면 캡처 2026-08-05 110320.png",
    "11_마케팅.jpg",
    "12_마케팅_광고팝업.jpg",
    "13_주요일정.jpg",
    "화면 캡처 2026-08-05 132149.png",
    "17_지역시장지도_전체.jpg",
    "18_지역시장지도_물가.jpg",
    "화면 캡처 2026-08-05 110355.png",
    "화면 캡처 2026-08-05 132425.png",
]

cells = []
for fn in ORDER:
    fp = os.path.join(FOLDER, fn)
    if not os.path.exists(fp):
        print("MISSING:", fn); continue
    im = Image.open(fp).convert("RGB")
    w, h = im.size
    if w != CELL_W:                       # 원본보다 크게 늘리지 않음(업스케일 블러 방지); 큰 것만 축소
        nh = round(h * CELL_W / w)
        im = im.resize((CELL_W, nh), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], outline=BORDER, width=2)
    cells.append(im)

rows = (len(cells) + COLS - 1) // COLS
row_h = [0] * rows
for i, c in enumerate(cells):
    row_h[i // COLS] = max(row_h[i // COLS], c.size[1])

total_w = MARGIN * 2 + COLS * CELL_W + (COLS - 1) * GAP
total_h = MARGIN * 2 + sum(row_h) + (rows - 1) * GAP
canvas = Image.new("RGB", (total_w, total_h), BG)
y = MARGIN
for r in range(rows):
    x = MARGIN
    for cidx in range(COLS):
        i = r * COLS + cidx
        if i >= len(cells):
            break
        canvas.paste(cells[i], (x, y))
        x += CELL_W + GAP
    y += row_h[r] + GAP

base = os.path.join(FOLDER, f"_PACKAGE_{COLS}col")
canvas.save(base + ".png", "PNG")                       # 무손실
canvas.save(base + ".jpg", "JPEG", quality=95, subsampling=0)  # 고품질 JPEG
canvas.save(base + ".pdf", "PDF", resolution=200.0)     # 원본 캔버스에서 직접 PDF
print(f"{len(cells)} imgs, {canvas.size[0]}x{canvas.size[1]} -> {base}.(png/jpg/pdf)")
