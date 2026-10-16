"""Generate the Convey app icon set.

Run from this directory:  py generate-icons.py

The mark is a gradient play triangle with two motion beams trailing behind it,
drawn in the Aurora Dark palette (violet #7C6BFF -> cyan #3FD0E0) over the
near-black app canvas. Everything is drawn programmatically so the icon can be
tweaked without a vector editor.

Outputs (all referenced by ../app.json):
    icon.png             1024  full-bleed square, opaque  (iOS / fallback)
    adaptive-icon.png    1024  mark only, transparent     (Android foreground)
    monochrome-icon.png  1024  mark only, white, alpha    (Android 13+ themed)
    splash-icon.png      1024  mark only, transparent     (expo-splash-screen)
    favicon.png            64  full-bleed square          (web)
"""

import math

from PIL import Image, ImageDraw, ImageFilter

S = 1024

# Aurora Dark palette
BG_TOP = (18, 26, 56)
BG_BOT = (5, 6, 11)
VIOLET = (124, 107, 255)  # #7C6BFF
CYAN = (63, 208, 224)  # #3FD0E0
WHITE = (255, 255, 255)

# Adaptive-icon safe zone: content must fit a 66dp circle on a 108dp canvas.
# The mark's furthest point is the tip of the trailing beam, 0.319 of the canvas
# from centre, so 0.86 keeps it comfortably inside the 0.3055 safe radius.
ADAPTIVE_SCALE = 0.86
SPLASH_SCALE = 1.15


# --- gradients --------------------------------------------------------------
def diag_grad(c1, c2, skew=0.62):
    small = 128
    img = Image.new('RGB', (small, small))
    px = img.load()
    for y in range(small):
        for x in range(small):
            t = min(1.0, (x / small) * skew + (y / small) * (1 - skew))
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return img.resize((S, S), Image.BICUBIC)


def vgrad(c1, c2):
    small = 128
    img = Image.new('RGB', (small, small))
    px = img.load()
    for y in range(small):
        t = y / (small - 1)
        col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        for x in range(small):
            px[x, y] = col
    return img.resize((S, S), Image.BICUBIC)


# --- masks ------------------------------------------------------------------
def blank():
    return Image.new('L', (S, S), 0)


def norm(v):
    m = math.hypot(v[0], v[1])
    return (v[0] / m, v[1] / m) if m else (0.0, 0.0)


def rounded_poly(pts, radius):
    """Rounded polygon whose corner arcs are tangent to both adjoining edges."""
    n = len(pts)
    core, centers = [], []
    for i in range(n):
        v = pts[i]
        prev, nxt = pts[(i - 1) % n], pts[(i + 1) % n]
        u1 = norm((prev[0] - v[0], prev[1] - v[1]))
        u2 = norm((nxt[0] - v[0], nxt[1] - v[1]))
        cos_t = max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1]))
        theta = math.acos(cos_t)
        sin_half = math.sin(theta / 2)
        if sin_half < 1e-6:
            continue
        bis = norm((u1[0] + u2[0], u1[1] + u2[1]))
        centers.append((v[0] + bis[0] * radius / sin_half, v[1] + bis[1] * radius / sin_half))
        t = radius / math.tan(theta / 2)
        core.append((v[0] + u1[0] * t, v[1] + u1[1] * t))
        core.append((v[0] + u2[0] * t, v[1] + u2[1] * t))

    mask = blank()
    d = ImageDraw.Draw(mask)
    d.polygon(core, fill=255)
    for cx, cy in centers:
        d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=255)
    return mask


def rounded_rect(x0, y0, x1, y1, radius):
    mask = blank()
    ImageDraw.Draw(mask).rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=255)
    return mask


def squircle_mask(radius=228):
    mask = blank()
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
    return mask


# --- the mark ---------------------------------------------------------------
TRIANGLE = [(S * 0.395, S * 0.275), (S * 0.395, S * 0.725), (S * 0.775, S * 0.5)]
BEAMS = ((0.432, 0.55), (0.538, 0.9))  # (top edge, opacity)


def paste(canvas, colour_img, mask, alpha=1.0):
    layer = colour_img.convert('RGBA')
    a = mask if alpha >= 1.0 else mask.point(lambda v: int(v * alpha))
    canvas.paste(layer, (0, 0), a)
    return canvas


def mark(scale=1.0, flat_colour=None):
    """The Convey mark on a transparent canvas."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    fill = diag_grad(VIOLET, CYAN) if flat_colour is None else Image.new('RGB', (S, S), flat_colour)

    for top, alpha in BEAMS:
        paste(canvas, fill, rounded_rect(S * 0.185, S * top, S * 0.335, S * (top + 0.030), S * 0.015), alpha)
    paste(canvas, fill, rounded_poly(TRIANGLE, S * 0.042))

    if scale == 1.0:
        return canvas

    size = int(S * scale)
    scaled = canvas.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(scaled, ((S - size) // 2, (S - size) // 2), scaled)
    return out


def plate():
    """The aurora canvas the full-bleed icon sits on."""
    bg = vgrad(BG_TOP, BG_BOT)
    bloom = blank()
    ImageDraw.Draw(bloom).ellipse([S * 0.17, S * 0.20, S * 0.83, S * 0.86], fill=88)
    bloom = bloom.filter(ImageFilter.GaussianBlur(135))
    return Image.composite(Image.new('RGB', (S, S), VIOLET), bg, bloom)


def full_bleed():
    base = plate()
    m = mark()
    base.paste(m, (0, 0), m)
    return base


if __name__ == '__main__':
    full_bleed().convert('RGB').save('icon.png')
    mark(ADAPTIVE_SCALE).save('adaptive-icon.png')
    mark(ADAPTIVE_SCALE, flat_colour=WHITE).save('monochrome-icon.png')
    mark(SPLASH_SCALE).save('splash-icon.png')
    full_bleed().resize((64, 64), Image.LANCZOS).convert('RGB').save('favicon.png')
    print('icon set written')
