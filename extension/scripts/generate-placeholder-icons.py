#!/usr/bin/env python3
"""Generate placeholder PNG icons for moaring extension.

Creates solid-color 16x16, 48x48, 128x128 PNGs without external dependencies.
"""
import os
import struct
import zlib
from pathlib import Path

# moaring primary color (#3b82f6)
COLOR = (59, 130, 246)
SIZES = [16, 48, 128]
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "icons"


def make_png(size: int, color: tuple[int, int, int]) -> bytes:
    """Build a minimal solid-color PNG image."""
    # Raw image data: each row prefixed with filter byte (0 = None)
    raw = bytearray()
    for _ in range(size):
        raw.append(0)
        for _ in range(size):
            raw.extend(color)

    # IHDR: width, height, bit_depth, color_type(2=RGB), compression, filter, interlace
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw))

    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    signature = b"\x89PNG\r\n\x1a\n"
    return (
        signature
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUTPUT_DIR / f"icon{size}.png"
        path.write_bytes(make_png(size, COLOR))
        print(f"created {path} ({os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    main()
