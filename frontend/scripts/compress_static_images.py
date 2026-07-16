"""Compress frontend/src/static/images → static/images-opt (same logical names, smaller files)."""
from __future__ import annotations

import hashlib
import io
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "static" / "images"
DST = ROOT / "src" / "static" / "images-opt"

AVATAR_STEMS = {
    "default-avatar",
    "default-doctor",
    "doctor1",
    "doctor2",
    "tc59",
    "zixunshi11",
}
BANNER_STEMS = {"slide11", "huodong11", "banner2"}
ICON_PNG_STEMS = {"bottom1", "bottom2", "bottom3", "bottom4", "tab11", "tab12", "seI", "ZYZXS"}


def as_rgb(im: Image.Image) -> Image.Image:
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    if im.mode == "P":
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def resize_max(im: Image.Image, max_w: int, max_h: int | None = None) -> Image.Image:
    w, h = im.size
    scale = 1.0
    if w > max_w:
        scale = min(scale, max_w / w)
    if max_h and h > max_h:
        scale = min(scale, max_h / h)
    if scale < 1.0:
        return im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    return im


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    for old in DST.iterdir():
        if old.is_file():
            old.unlink()

    files = sorted(
        [p for p in SRC.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}],
        key=lambda p: p.name.lower(),
    )
    results: list[tuple[str, str, int, int, str]] = []
    content_hash_to_file: dict[str, Path] = {}

    for p in files:
        name = p.stem
        raw = p.read_bytes()
        digest = hashlib.md5(raw).hexdigest()
        im = Image.open(io.BytesIO(raw))

        if name in BANNER_STEMS:
            out_name = f"{name}.jpg"
            out_path = DST / out_name
            if digest in content_hash_to_file:
                shutil.copyfile(content_hash_to_file[digest], out_path)
                results.append((p.name, out_name, p.stat().st_size, out_path.stat().st_size, "dedupe"))
                continue
            im2 = resize_max(as_rgb(im), 1125, 750)
            im2.save(out_path, "JPEG", quality=78, optimize=True, progressive=True)
            content_hash_to_file[digest] = out_path
            results.append((p.name, out_name, p.stat().st_size, out_path.stat().st_size, "banner-jpg"))
            continue

        if name in AVATAR_STEMS:
            out_name = f"{name}.jpg"
            out_path = DST / out_name
            if digest in content_hash_to_file:
                shutil.copyfile(content_hash_to_file[digest], out_path)
                results.append((p.name, out_name, p.stat().st_size, out_path.stat().st_size, "dedupe"))
                continue
            im2 = resize_max(as_rgb(im), 240, 240)
            im2.save(out_path, "JPEG", quality=80, optimize=True)
            content_hash_to_file[digest] = out_path
            results.append((p.name, out_name, p.stat().st_size, out_path.stat().st_size, "avatar-jpg"))
            continue

        if name in ICON_PNG_STEMS:
            out_name = f"{name}.png"
            out_path = DST / out_name
            im2 = im.convert("RGBA") if im.mode not in ("RGBA", "RGB", "P") else im
            if isinstance(im2, Image.Image) and (im2.width > 128 or im2.height > 128):
                im2 = resize_max(im2.convert("RGBA") if im2.mode == "P" else im2, 96, 96)
            im2.save(out_path, "PNG", optimize=True)
            results.append((p.name, out_name, p.stat().st_size, out_path.stat().st_size, "icon-png"))
            continue

        # other medium assets → jpeg
        out_name = f"{name}.jpg"
        out_path = DST / out_name
        max_w = 750 if p.stat().st_size > 40_000 else 400
        im2 = resize_max(as_rgb(im), max_w)
        im2.save(out_path, "JPEG", quality=80, optimize=True)
        results.append((p.name, out_name, p.stat().st_size, out_path.stat().st_size, "jpeg"))

    old_total = new_total = 0
    print(f"{'src':22} {'out':22} {'oldKB':>8} {'newKB':>8} {'ratio':>7} note")
    for s, o, a, b, note in results:
        old_total += a
        new_total += b
        print(f"{s:22} {o:22} {a/1024:8.1f} {b/1024:8.1f} {b/max(a,1)*100:6.1f}% {note}")
    print(
        f"TOTAL old={old_total/1024:.1f}KB new={new_total/1024:.1f}KB "
        f"saved={(old_total-new_total)/1024:.1f}KB ({(1-new_total/max(old_total,1))*100:.1f}%)"
    )


if __name__ == "__main__":
    main()
