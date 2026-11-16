#!/usr/bin/env python3
"""Generate desktop-shell icons: the Windows-required icon.ico and standard Tauri icon sizes.

Contract:
- Source: src-tauri/icons/icon.png, square and at least 256px (currently 512x512). Generate outputs; do not hand-edit them.
- Outputs: icon.ico with 16/24/32/48/64/128/256 sizes, 32x32.png, 128x128.png, and 128x128@2x.png.
- Match official tauri icon encoding: BMP at sizes up to 128 for older tools/resource compilers; PNG at 256 for compactness.
- tauri.conf.json bundle.icon explicitly lists these outputs. Windows tauri-build requires icon.ico when generating resources;
  its absence fails the build. See decisions/implemented/bug-fix/2026-10-04-desktop-windows-icon-ico.md.

Usage (from the repository root or desktop/):
    python3 desktop/scripts/make-icons.py
Dependency: Pillow (pip install pillow).
"""
from pathlib import Path
import io
import struct
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover - readable diagnostic when the dependency is missing
    sys.exit("需要 Pillow：pip install pillow")

ICON_DIR = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
SOURCE = ICON_DIR / "icon.png"
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
PNG_ENTRY_MIN = 256  # Use PNG encoding at this size and above; use BMP below it, matching tauri icon.
PNG_SIZES = {"32x32.png": 32, "128x128.png": 128, "128x128@2x.png": 256}


def _entry_blob(img: Image.Image, size: int) -> tuple[int, bytes]:
    """Encode one size as a single-entry ICO and extract its bits-per-pixel and payload."""
    bitmap_format = "png" if size >= PNG_ENTRY_MIN else "bmp"
    buf = io.BytesIO()
    img.save(buf, format="ICO", sizes=[(size, size)], bitmap_format=bitmap_format)
    data = buf.getvalue()
    bpp = struct.unpack("<H", data[12:14])[0]
    length, offset = struct.unpack("<II", data[14:22])  # Directory entry: size at byte 14 and imageOffset at byte 18.
    return bpp, data[offset:offset + length]


def build_ico(src: Image.Image, sizes: list[int]) -> bytes:
    entries = [(size, *_entry_blob(src.resize((size, size), Image.LANCZOS), size)) for size in sizes]
    header = struct.pack("<HHH", 0, 1, len(entries))
    offset = 6 + 16 * len(entries)
    directory = b""
    payload = b""
    for size, bpp, blob in entries:
        dim = 0 if size == 256 else size  # ICO directory entries encode size 256 as zero.
        directory += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, bpp, len(blob), offset + len(payload))
        payload += blob
    return header + directory + payload


def main() -> int:
    if not SOURCE.is_file():
        sys.exit(f"缺少源图：{SOURCE}")
    src = Image.open(SOURCE).convert("RGBA")
    if src.width != src.height:
        sys.exit(f"源图必须是正方形：{SOURCE} 是 {src.width}×{src.height}")
    if src.width < max(ICO_SIZES):
        sys.exit(f"源图至少 {max(ICO_SIZES)}px：{SOURCE} 是 {src.width}px")

    ico = build_ico(src, ICO_SIZES)
    (ICON_DIR / "icon.ico").write_bytes(ico)
    print(f"icon.ico  {ICO_SIZES}  {len(ico)} bytes")
    for name, size in PNG_SIZES.items():
        src.resize((size, size), Image.LANCZOS).save(ICON_DIR / name, format="PNG")
        print(f"{name}  {size}×{size}")
    print(f"源图 {SOURCE.name} 保留为 {src.width}×{src.height} 设计源（不覆盖）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())