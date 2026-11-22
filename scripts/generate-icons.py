"""Regenerate the Buseta Ya launcher, splash, and web icons with Pillow."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/images"
MODULES = ROOT / "node_modules"
ANTON = MODULES / "@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf"
ICONS = MODULES / "@expo/vector-icons/build/vendor/react-native-vector-icons"
GROUND = "#F1F0E9"
YELLOW = "#FFC72C"
INK = "#141414"
SIZE = 1024
ADAPTIVE_WIDTH = 670
ADAPTIVE_CORNER_RADIUS = 380


def glyph_mask(text, font_path, max_width, max_height):
    font = ImageFont.truetype(str(font_path), SIZE)
    left, top, right, bottom = font.getbbox(text)
    mask = Image.new("L", (right - left, bottom - top))
    ImageDraw.Draw(mask).text((-left, -top), text, font=font, fill=255)
    mask = mask.crop(mask.getbbox())
    mask.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    return mask


def placard(bus, monochrome=False, corner_radius=62):
    mark = Image.new("RGBA", (960, 800))
    draw = ImageDraw.Draw(mark)
    paint = "white" if monochrome else INK
    draw.rounded_rectangle(
        (0, 0, 959, 799), radius=corner_radius, fill=None if monochrome else YELLOW,
        outline=paint, width=44,
    )

    bus_mask = glyph_mask(bus, ICONS / "Fonts/MaterialCommunityIcons.ttf", 596, 252)
    ya_mask = glyph_mask("YA", ANTON, 530, 332)
    gap = 28
    top = (mark.height - bus_mask.height - ya_mask.height - gap) // 2
    for mask in (bus_mask, ya_mask):
        left = (mark.width - mask.width) // 2
        glyph = Image.new("RGBA", mask.size, paint)
        glyph.putalpha(mask)
        mark.alpha_composite(glyph, (left, top))
        top += mask.height + gap
    return mark


def canvas(mark, width, background=None):
    image = Image.new("RGBA", (SIZE, SIZE), background)
    height = round(mark.height * width / mark.width)
    resized = mark.resize((width, height), Image.Resampling.LANCZOS)
    image.alpha_composite(resized, ((SIZE - width) // 2, (SIZE - height) // 2))
    return image.convert("RGB") if background else image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adaptive-only", action="store_true", help="Regenerate only Android adaptive layers.")
    adaptive_only = parser.parse_args().adaptive_only
    glyphmap = json.loads(
        (ICONS / "glyphmaps/MaterialCommunityIcons.json").read_text(encoding="utf-8")
    )
    bus = chr(glyphmap["bus-side"])
    if not adaptive_only:
        mark = placard(bus)
        full = canvas(mark, 960, GROUND)
        full.save(ASSETS / "icon.png")
        full.resize((48, 48), Image.Resampling.LANCZOS).save(ASSETS / "favicon.png")
        canvas(mark, 960).save(ASSETS / "splash-icon.png")

    # Round the adaptive placard's corners so its full width fits the circular safe zone.
    for monochrome, layer in ((False, "foreground"), (True, "monochrome")):
        adaptive_mark = placard(bus, monochrome, corner_radius=ADAPTIVE_CORNER_RADIUS)
        canvas(adaptive_mark, ADAPTIVE_WIDTH).save(ASSETS / f"android-icon-{layer}.png")
    Image.new("RGB", (SIZE, SIZE), YELLOW).save(ASSETS / "android-icon-background.png")


if __name__ == "__main__":
    main()
