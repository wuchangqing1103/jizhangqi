"""生成 PWA 图标。

用法（在仓库根目录执行）：python scripts/gen-icons.py

从一张 1024x1024 母版按需导出三张 PNG：
  public/icons/icon-512.png
  public/icons/icon-192.png
  public/icons/apple-touch-icon.png   （180x180，iOS 主屏）
母版是满版墨色 #1e1c18 底 + 居中米白 ¥，不画圆角、不加投影——
iOS / Android 会自己裁切，满版出血才不会出现白边。
"""

from pathlib import Path

from PIL import Image, ImageDraw

INK = "#1e1c18"
CREAM = "#f3f1ec"
MASTER = 1024
STROKE = 74

ICON_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"


def draw_master() -> Image.Image:
    """画 1024 母版：两条斜撇、一竖、两横组成 ¥。"""
    image = Image.new("RGB", (MASTER, MASTER), INK)
    draw = ImageDraw.Draw(image)

    def stroke(points: list[tuple[int, int]]) -> None:
        draw.line(points, fill=CREAM, width=STROKE, joint="curve")
        radius = STROKE / 2
        for x, y in (points[0], points[-1]):
            draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=CREAM)

    stroke([(300, 300), (512, 520)])  # 左撇
    stroke([(724, 300), (512, 520)])  # 右撇
    stroke([(512, 512), (512, 736)])  # 竖
    stroke([(334, 556), (690, 556)])  # 上横
    stroke([(334, 646), (690, 646)])  # 下横
    return image


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    master = draw_master()
    targets = {
        "icon-512.png": 512,
        "icon-192.png": 192,
        "apple-touch-icon.png": 180,
    }
    for name, size in targets.items():
        icon = master.resize((size, size), Image.LANCZOS)
        path = ICON_DIR / name
        icon.save(path, format="PNG", optimize=True)
        print(f"{name}: {icon.width}x{icon.height} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()