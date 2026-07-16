"""Rewrite /static/images/xxx → /static/images-opt/<compressed name> across frontend/src."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
OPT = SRC / "static" / "images-opt"
OLD = SRC / "static" / "images"

# Prefer jpeg for photos; keep png icons that remain png in opt
STEM_EXT: dict[str, str] = {}
for p in OPT.iterdir():
    if p.is_file():
        STEM_EXT[p.stem] = p.suffix  # .jpg / .png

# Manual alias for missing placeholder
PLACEHOLDER = "/static/images-opt/place21.jpg"

EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")
TEXT_SUFFIXES = {".vue", ".ts", ".js", ".json", ".scss", ".css", ".md"}


def map_path(path: str) -> str:
    # /static/images/foo.png → /static/images-opt/foo.jpg|png
    prefix = "/static/images/"
    if not path.startswith(prefix):
        return path
    name = path[len(prefix) :]
    stem = Path(name).stem
    if stem == "default-placeholder":
        return PLACEHOLDER
    if stem in STEM_EXT:
        return f"/static/images-opt/{stem}{STEM_EXT[stem]}"
    # fallback keep opt jpg
    return f"/static/images-opt/{stem}.jpg"


def rewrite_text(text: str) -> str:
    import re

    def repl(m: re.Match[str]) -> str:
        full = m.group(0)
        has_leading_slash = full.startswith("/")
        path = full if has_leading_slash else f"/{full}"
        mapped = map_path(path)
        return mapped if has_leading_slash else mapped.lstrip("/")

    return re.sub(
        r"/?static/images/[A-Za-z0-9_.-]+\.(?:png|jpg|jpeg|webp|gif)",
        repl,
        text,
    )


def main() -> None:
    changed_files = 0
    for path in SRC.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        # skip images dirs content
        if "static" in path.parts and path.suffix.lower() in {".png", ".jpg", ".jpeg"}:
            continue
        raw = path.read_text(encoding="utf-8")
        new = rewrite_text(raw)
        # also update comments about /static/images/*
        if new != raw:
            path.write_text(new, encoding="utf-8")
            changed_files += 1
            print("updated", path.relative_to(ROOT))

    # Update pages.json tabBar via already rewritten if under src
    print("changed_files=", changed_files)

    # Write README in images-opt
    (OPT / "README.md").write_text(
        "# 压缩后的小程序静态图（主包体积优化）\n\n"
        "由 `scripts/compress_static_images.py` 从 `static/images` 生成。\n"
        "代码统一引用 `/static/images-opt/...`。\n"
        "旧目录 `static/images` 中的大图应删除，否则仍会打进主包。\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
