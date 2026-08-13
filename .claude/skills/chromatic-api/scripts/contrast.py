#!/usr/bin/env python3
"""WCAG contrast ratio between two colors — for triaging `color-contrast` hits.

The API names the failing rule and selector but not the colors, so once you have
traced a selector back to its theme tokens, use this to confirm the failure and
check a candidate fix.

    ./contrast.py '#B1DDE4' '#7C9BA0'
    ./contrast.py '#B1DDE4' '#7C9BA0' --large     # 3:1 threshold
    ./contrast.py '#E9E9E9' '#636363' '#B1DDE4' '#7C9BA0'   # before/after pairs

Thresholds: AA 4.5:1 normal / 3:1 large, AAA 7:1 normal / 4.5:1 large. "Large" is
>=18pt, or >=14pt bold. Body text at size="S" is normal text.
"""

from __future__ import annotations

import argparse


def luminance(color: str) -> float:
    value = color.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    if len(value) != 6:
        raise SystemExit(f"error: '{color}' is not a hex color")
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def ratio(foreground: str, background: str) -> float:
    a, b = luminance(foreground), luminance(background)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("colors", nargs="+", help="hex colors in pairs (fg bg [fg bg ...])")
    parser.add_argument("--large", action="store_true", help="use large-text thresholds")
    args = parser.parse_args()

    if len(args.colors) % 2:
        raise SystemExit("error: colors must come in pairs (foreground background)")

    aa, aaa = (3.0, 4.5) if args.large else (4.5, 7.0)
    size = "large" if args.large else "normal"
    print(f"thresholds ({size} text): AA {aa}:1, AAA {aaa}:1\n")

    for i in range(0, len(args.colors), 2):
        foreground, background = args.colors[i], args.colors[i + 1]
        value = ratio(foreground, background)
        verdict = "AAA" if value >= aaa else "AA" if value >= aa else "FAIL"
        print(f"  {foreground} on {background}  {value:5.2f}:1  {verdict}")
        if verdict == "FAIL":
            print(f"      short of AA by {aa - value:.2f}")


if __name__ == "__main__":
    main()
