#!/usr/bin/env python3
"""
Generate a retro 8-bit pixel art ship module slots diagram.
Run: python3 generate_acep_slots.py
Requires: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Color palette (8-bit retro: black/amber/green/dark-teal)
BLACK      = (0, 0, 0)
DARK_BG    = (8, 12, 10)
AMBER      = (255, 176, 0)
AMBER_DIM  = (180, 110, 0)
AMBER_DARK = (80, 48, 0)
GREEN      = (0, 220, 80)
GREEN_DIM  = (0, 140, 50)
TEAL       = (0, 160, 140)
TEAL_DIM   = (0, 90, 80)
DARK_TEAL  = (0, 50, 45)
GRID_LINE  = (0, 60, 55)
EMPTY_SLOT = (20, 30, 28)

# Image dimensions (pixel art scale)
SCALE      = 3          # pixel multiplier for chunky feel
COLS       = 2          # slots per row
SLOT_W     = 80         # slot width in base pixels
SLOT_H     = 48         # slot height in base pixels
PAD        = 8          # padding around slots
HEADER_H   = 20         # header height
FOOTER_H   = 16

# Main module slots
MAIN_SLOTS = [
    ("GEN", True,  "power"),   # Generator  — installed
    ("DRV", True,  "drive"),   # Drive      — installed
    ("WPN", True,  "weapon"),  # Weapon     — installed
    ("ARM", False, None),      # Armor      — empty
    ("SHD", False, None),      # Shield     — empty
    ("SCN", False, None),      # Scanner    — empty
    ("MIN", False, None),      # Mining     — empty
    ("CGO", False, None),      # Cargo      — empty
]

EXTRA_SLOTS = [
    ("EXT-1", False, None),
    ("EXT-2", False, None),
]

ROWS_MAIN  = (len(MAIN_SLOTS) + COLS - 1) // COLS    # 4
ROWS_EXTRA = (len(EXTRA_SLOTS) + COLS - 1) // COLS   # 1

SECTION_GAP = 14   # gap between main and extra section

IMG_W = COLS * SLOT_W + (COLS + 1) * PAD
IMG_H = (HEADER_H + PAD
         + ROWS_MAIN  * SLOT_H + (ROWS_MAIN  + 1) * PAD
         + SECTION_GAP
         + 10                       # "EXTRA SLOTS" label
         + PAD
         + ROWS_EXTRA * SLOT_H + (ROWS_EXTRA + 1) * PAD
         + FOOTER_H + PAD)

def draw_scanlines(draw, w, h, scale):
    """Subtle horizontal scanlines for CRT feel."""
    for y in range(0, h * scale, 2 * scale):
        draw.rectangle([0, y, w * scale - 1, y + scale - 1],
                        fill=(0, 0, 0, 30))

def draw_pixel_border(draw, x, y, w, h, color, thickness=1):
    """Draw a chunky pixel border (no anti-aliasing)."""
    for t in range(thickness):
        draw.rectangle([x + t, y + t, x + w - 1 - t, y + h - 1 - t],
                        outline=color, fill=None)

def small_icon_power(draw, cx, cy, color):
    """3x5 pixel lightning bolt icon."""
    pts = [(cx, cy-4), (cx, cy-1), (cx+2, cy-1),
           (cx, cy+4), (cx, cy+1), (cx-2, cy+1)]
    # Simple lightning shape
    px = 2
    draw.polygon([
        (cx-px, cy-4), (cx+px, cy-4),
        (cx+px, cy),   (cx+2*px, cy),
        (cx, cy+4),    (cx-px, cy+1),
        (cx+px, cy+1), (cx-px, cy)
    ], fill=color)

def small_icon_drive(draw, cx, cy, color):
    """Thruster nozzle icon."""
    draw.polygon([
        (cx-3, cy-4), (cx+3, cy-4),
        (cx+5, cy),   (cx+3, cy+4),
        (cx-3, cy+4), (cx-5, cy)
    ], fill=color)
    # exhaust dots
    for i in range(3):
        draw.rectangle([cx - 1 + i*2, cy + 5, cx + i*2, cy + 6], fill=AMBER_DIM)

def small_icon_weapon(draw, cx, cy, color):
    """Cannon barrel icon."""
    draw.rectangle([cx - 6, cy - 2, cx + 4, cy + 2], fill=color)
    draw.rectangle([cx + 4, cy - 1, cx + 7, cy + 1], fill=color)
    draw.rectangle([cx - 6, cy - 4, cx - 2, cy + 4], fill=AMBER_DIM)

def draw_installed_module(draw, sx, sy, sw, sh, label, mod_type):
    """Draw a slot with an installed module (amber)."""
    # Slot background
    draw.rectangle([sx, sy, sx + sw - 1, sy + sh - 1], fill=(25, 20, 5))
    # Border — double line, amber
    draw_pixel_border(draw, sx, sy, sw, sh, AMBER, thickness=2)
    # Inner highlight top-left
    draw.line([sx + 2, sy + 2, sx + sw - 4, sy + 2], fill=AMBER_DIM)
    draw.line([sx + 2, sy + 2, sx + 2, sy + sh - 4], fill=AMBER_DIM)

    # Label
    lx = sx + 4
    ly = sy + 4
    _draw_text_chunky(draw, label, lx, ly, AMBER, scale=1)

    # Icon in center
    cx = sx + sw // 2
    cy = sy + sh // 2 + 4
    if mod_type == "power":
        small_icon_power(draw, cx, cy, AMBER)
    elif mod_type == "drive":
        small_icon_drive(draw, cx, cy, AMBER)
    elif mod_type == "weapon":
        small_icon_weapon(draw, cx, cy, AMBER)

    # Status bar at bottom
    bar_y = sy + sh - 6
    bar_w = sw - 12
    draw.rectangle([sx + 6, bar_y, sx + 6 + bar_w - 1, bar_y + 3], fill=DARK_BG)
    draw.rectangle([sx + 6, bar_y, sx + 6 + int(bar_w * 0.85) - 1, bar_y + 3], fill=GREEN)

def draw_empty_slot(draw, sx, sy, sw, sh, label):
    """Draw an empty/locked slot."""
    draw.rectangle([sx, sy, sx + sw - 1, sy + sh - 1], fill=EMPTY_SLOT)
    draw_pixel_border(draw, sx, sy, sw, sh, TEAL_DIM, thickness=1)

    # Corner dashes (pixel art corner markers)
    c = TEAL
    s = 4
    draw.line([sx + 1, sy + 1, sx + s, sy + 1], fill=c)
    draw.line([sx + 1, sy + 1, sx + 1, sy + s], fill=c)
    draw.line([sx + sw - 2, sy + 1, sx + sw - 2 - s, sy + 1], fill=c)
    draw.line([sx + sw - 2, sy + 1, sx + sw - 2, sy + s], fill=c)
    draw.line([sx + 1, sy + sh - 2, sx + s, sy + sh - 2], fill=c)
    draw.line([sx + 1, sy + sh - 2, sx + 1, sy + sh - 2 - s], fill=c)
    draw.line([sx + sw - 2, sy + sh - 2, sx + sw - 2 - s, sy + sh - 2], fill=c)
    draw.line([sx + sw - 2, sy + sh - 2, sx + sw - 2, sy + sh - 2 - s], fill=c)

    # Label
    _draw_text_chunky(draw, label, sx + 4, sy + 4, TEAL_DIM, scale=1)

    # "???" centered
    _draw_text_chunky(draw, "???", sx + sw // 2 - 6, sy + sh // 2 - 3, TEAL, scale=1)

def _draw_text_chunky(draw, text, x, y, color, scale=1):
    """
    Draw text using a manual 5x7 pixel font for chunky 8-bit look.
    Very small subset — letters, digits, ?.
    """
    FONT = {
        'G': [(0,1),(0,2),(0,3),(0,4),(0,5),(1,0),(2,0),(3,0),(4,0),(4,1),(4,2),(4,3),
              (3,3),(2,3),(1,3),(1,4),(1,5),(2,5),(3,5),(4,5)],  # noqa
        'E': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(1,0),(2,0),(3,0),(4,0),
              (1,3),(2,3),(3,3),(1,5),(2,5),(3,5),(4,5)],
        'N': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(1,1),(2,2),(3,3),(4,0),(4,1),(4,2),(4,3),(4,4),(4,5)],
        'D': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(1,0),(2,0),(3,1),(4,2),(4,3),(3,4),(2,5),(1,5)],
        'R': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(1,0),(2,0),(3,0),(4,1),(4,2),(3,3),(2,3),(1,3),
              (2,4),(3,5),(4,5)],
        'V': [(0,0),(0,1),(0,2),(0,3),(1,4),(2,5),(3,4),(4,0),(4,1),(4,2),(4,3)],
        'W': [(0,0),(0,1),(0,2),(0,3),(0,4),(1,5),(2,3),(3,5),(4,0),(4,1),(4,2),(4,3),(4,4)],
        'P': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(1,0),(2,0),(3,0),(4,1),(4,2),(3,3),(2,3),(1,3)],
        'N': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(1,1),(2,2),(3,3),(4,0),(4,1),(4,2),(4,3),(4,4),(4,5)],
        'A': [(0,2),(0,3),(0,4),(0,5),(1,1),(2,0),(3,1),(4,2),(4,3),(4,4),(4,5),(1,3),(2,3),(3,3)],
        'M': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(1,1),(2,2),(3,1),(4,0),(4,1),(4,2),(4,3),(4,4),(4,5)],
        'S': [(1,0),(2,0),(3,0),(4,0),(0,1),(0,2),(1,3),(2,3),(3,3),(4,4),(4,5),(0,5),(1,5),(2,5),(3,5)],
        'H': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(4,0),(4,1),(4,2),(4,3),(4,4),(4,5),
              (1,3),(2,3),(3,3)],
        'D': [(0,0),(0,1),(0,2),(0,3),(0,4),(0,5),(1,0),(2,0),(3,1),(4,2),(4,3),(3,4),(2,5),(1,5)],
        'C': [(1,0),(2,0),(3,0),(4,0),(0,1),(0,2),(0,3),(0,4),(1,5),(2,5),(3,5),(4,5)],
        'O': [(1,0),(2,0),(3,0),(0,1),(4,1),(0,2),(4,2),(0,3),(4,3),(0,4),(4,4),(1,5),(2,5),(3,5)],
        'I': [(0,0),(1,0),(2,0),(3,0),(4,0),(2,1),(2,2),(2,3),(2,4),(0,5),(1,5),(2,5),(3,5),(4,5)],
        'X': [(0,0),(1,1),(2,2),(3,3),(4,4),(4,0),(3,1),(1,3),(0,4),(0,5),(4,5)],  # hack
        '?': [(1,0),(2,0),(3,0),(4,1),(4,2),(3,3),(2,3),(2,4),(2,6)],
        '-': [(0,3),(1,3),(2,3),(3,3),(4,3)],
        '1': [(1,0),(1,1),(1,2),(1,3),(1,4),(1,5),(2,0),(2,1),(2,2),(2,3),(2,4),(2,5)],
        '2': [(0,0),(1,0),(2,0),(3,0),(4,1),(4,2),(3,3),(2,3),(1,3),(0,4),(0,5),(1,5),(2,5),(3,5),(4,5)],
    }

    CHAR_W = 6  # 5px + 1px gap

    for i, ch in enumerate(text):
        ox = x + i * CHAR_W * scale
        oy = y
        pixels = FONT.get(ch, [])
        for (px_row, px_col) in pixels:
            rx = ox + px_col * scale
            ry = oy + px_row * scale
            draw.rectangle([rx, ry, rx + scale - 1, ry + scale - 1], fill=color)

def main():
    target = "/home/manuel/claude/voidSector/packages/client/public/compendium/acep/acep-slots-diagram.png"
    os.makedirs(os.path.dirname(target), exist_ok=True)

    # Create base image (will be upscaled)
    img = Image.new("RGB", (IMG_W * SCALE, IMG_H * SCALE), DARK_BG)
    draw = ImageDraw.Draw(img)

    # Background grid
    for gx in range(0, IMG_W * SCALE, 8 * SCALE):
        draw.line([gx, 0, gx, IMG_H * SCALE], fill=GRID_LINE)
    for gy in range(0, IMG_H * SCALE, 8 * SCALE):
        draw.line([0, gy, IMG_W * SCALE, gy], fill=GRID_LINE)

    # Outer border
    draw_pixel_border(draw, 0, 0, IMG_W * SCALE, IMG_H * SCALE, TEAL, thickness=2 * SCALE)

    # Header
    hx = PAD * SCALE
    hy = PAD * SCALE
    _draw_text_chunky(draw, "SHIP MODULE DIAGRAM", hx, hy, AMBER, scale=SCALE)

    # Horizontal rule under header
    rule_y = (PAD + HEADER_H) * SCALE
    draw.rectangle([PAD * SCALE, rule_y, (IMG_W - PAD) * SCALE, rule_y + SCALE], fill=TEAL_DIM)

    # Draw main slots
    slot_start_y = (PAD + HEADER_H + PAD) * SCALE
    for idx, (label, installed, mod_type) in enumerate(MAIN_SLOTS):
        col = idx % COLS
        row = idx // COLS
        sx = (PAD + col * (SLOT_W + PAD)) * SCALE
        sy = slot_start_y + row * (SLOT_H + PAD) * SCALE + PAD * SCALE

        sw = SLOT_W * SCALE
        sh = SLOT_H * SCALE

        if installed:
            draw_installed_module(draw, sx, sy, sw, sh, label, mod_type)
        else:
            draw_empty_slot(draw, sx, sy, sw, sh, label)

    # "EXTRA SLOTS" section label
    extra_label_y = (slot_start_y // SCALE
                     + ROWS_MAIN * (SLOT_H + PAD) + PAD
                     + SECTION_GAP) * SCALE
    _draw_text_chunky(draw, "EXTRA SLOTS", PAD * SCALE, extra_label_y, TEAL, scale=SCALE)
    draw.rectangle([PAD * SCALE, extra_label_y + 8 * SCALE,
                    (IMG_W - PAD) * SCALE, extra_label_y + 8 * SCALE + SCALE],
                   fill=DARK_TEAL)

    # Draw extra slots
    extra_start_y = extra_label_y + (10 + PAD) * SCALE
    for idx, (label, installed, mod_type) in enumerate(EXTRA_SLOTS):
        col = idx % COLS
        sx = (PAD + col * (SLOT_W + PAD)) * SCALE
        sy = extra_start_y + PAD * SCALE

        sw = SLOT_W * SCALE
        sh = SLOT_H * SCALE
        draw_empty_slot(draw, sx, sy, sw, sh, label)

    # Footer
    footer_y = IMG_H * SCALE - (FOOTER_H + PAD // 2) * SCALE
    draw.rectangle([PAD * SCALE, footer_y,
                    (IMG_W - PAD) * SCALE, footer_y + SCALE], fill=TEAL_DIM)
    _draw_text_chunky(draw, "ACEP v2.0", PAD * SCALE, footer_y + 3 * SCALE, AMBER_DIM, scale=SCALE)

    # Apply scanlines overlay (semi-transparent via per-pixel manipulation)
    pixels = img.load()
    for py in range(0, IMG_H * SCALE, 2 * SCALE):
        for px2 in range(IMG_W * SCALE):
            r, g, b = pixels[px2, py]
            pixels[px2, py] = (max(0, r - 15), max(0, g - 15), max(0, b - 15))

    img.save(target, "PNG")
    print(f"Saved to: {target}")
    print(f"Size: {img.size[0]}x{img.size[1]}px")

if __name__ == "__main__":
    main()
