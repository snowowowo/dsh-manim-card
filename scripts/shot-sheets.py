# 把 shot-corpus.mjs 落的 PNG 拼成对照表（每格带 id 与状态），供逐条读图。
#
# 为什么不直接一张张读：一百多张 1280×720 的图，一张张翻既慢又容易漏。
# 每组拼成 3×2 的格子（每格 640×360），一张表看 6 条；可疑的再回原尺寸细看。
#
# 用法：python scripts/shot-sheets.py <shots 目录> [--cols 3] [--rows 2]
# 产物：<shots 目录>/sheets/<组>-<序号>.png
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TILE_W, TILE_H = 640, 360
CAPTION_H = 22


def load_font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("shots", type=Path)
    parser.add_argument("--cols", type=int, default=3)
    parser.add_argument("--rows", type=int, default=2)
    args = parser.parse_args()

    index_file = args.shots / "index.json"
    meta = {}
    if index_file.exists():
        for entry in json.loads(index_file.read_text())["results"]:
            meta[entry["id"]] = entry

    tiles = sorted(p for p in args.shots.glob("*/*.png") if p.parent.name != "sheets")
    if not tiles:
        raise SystemExit(f"{args.shots} 下没有 PNG——先跑 scripts/shot-corpus.mjs")

    groups: dict[str, list[Path]] = {}
    for tile in tiles:
        groups.setdefault(tile.parent.name, []).append(tile)

    out_dir = args.shots / "sheets"
    out_dir.mkdir(exist_ok=True)
    font = load_font(13)

    per_sheet = args.cols * args.rows
    made = 0
    for group, files in groups.items():
        for start in range(0, len(files), per_sheet):
            batch = files[start : start + per_sheet]
            sheet = Image.new("RGB", (args.cols * TILE_W, args.rows * (TILE_H + CAPTION_H)), (24, 24, 28))
            draw = ImageDraw.Draw(sheet)
            for slot, file in enumerate(batch):
                col, row = slot % args.cols, slot // args.cols
                x, y = col * TILE_W, row * (TILE_H + CAPTION_H)
                image = Image.open(file).convert("RGB").resize((TILE_W, TILE_H), Image.LANCZOS)
                sheet.paste(image, (x, y))
                entry = meta.get(file.stem)
                if entry is None:
                    label, color = f"{file.stem}（无元数据）", (200, 200, 80)
                elif not entry["ok"]:
                    label = f"✗ {file.stem}  {str(entry.get('error') or '')[:70]}"
                    color = (255, 120, 120)
                else:
                    label = f"✓ {file.stem}  墨迹 {entry['ink'] * 100:.1f}%"
                    color = (140, 220, 140) if entry["ink"] >= 0.002 else (255, 210, 90)
                draw.rectangle([x, y + TILE_H, x + TILE_W - 1, y + TILE_H + CAPTION_H - 1], fill=(16, 16, 20))
                draw.text((x + 6, y + TILE_H + 4), label, font=font, fill=color)
                draw.rectangle([x, y, x + TILE_W - 1, y + TILE_H + CAPTION_H - 1], outline=(60, 60, 68), width=1)
            target = out_dir / f"{group}-{start // per_sheet + 1}.png"
            sheet.save(target)
            made += 1
            print(f"  {target.relative_to(args.shots)}  ({len(batch)} 条)")
    print(f"对照表完成：{made} 张 → {out_dir}")


if __name__ == "__main__":
    main()
