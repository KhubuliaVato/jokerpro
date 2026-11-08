"""Writes the card back pictures of the shop (public/skins/*.svg). Run: python scripts/make-skins.py"""
import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "skins")
W, H = 100, 140
CX, CY = 50, 70


def f(x):
    return f"{x:.2f}".rstrip("0").rstrip(".")


def pts(points):
    return " ".join(f"{f(x)},{f(y)}" for x, y in points)


def star(n, r_out, r_in, rot=-90, cx=CX, cy=CY):
    out = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180 / n)
        out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return out


def poly(n, r, rot=-90, cx=CX, cy=CY):
    return [(cx + r * math.cos(math.radians(rot + i * 360 / n)), cy + r * math.sin(math.radians(rot + i * 360 / n))) for i in range(n)]


def svg(body, defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="none">'
        f"<defs>{defs}</defs>{body}</svg>"
    )


def frame(color, w=1.4, inner_opacity=0.5, rx=4):
    return (
        f'<rect x="6" y="6" width="88" height="128" rx="{rx}" fill="none" stroke="{color}" stroke-width="{w}"/>'
        f'<rect x="10" y="10" width="80" height="120" rx="{rx - 2}" fill="none" stroke="{color}" stroke-opacity="{inner_opacity}" stroke-width=".6"/>'
    )


def corners(color, size=9, w=1.2):
    s = size
    out = ""
    for (x, y, dx, dy) in [(6, 6, 1, 1), (94, 6, -1, 1), (6, 134, 1, -1), (94, 134, -1, -1)]:
        out += f'<path d="M{x + dx * 2} {y + dy * s}V{y + dy * 2}H{x + dx * s}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>'
    return out


def stars_field(n, seed, color="#fff", rmin=0.35, rmax=1.1, ymin=4, ymax=136):
    rnd = random.Random(seed)
    out = ""
    for _ in range(n):
        x, y, r = rnd.uniform(5, 95), rnd.uniform(ymin, ymax), rnd.uniform(rmin, rmax)
        out += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{color}" opacity="{f(rnd.uniform(.35, .95))}"/>'
    return out


def write(name, content):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"{name}.svg"), "w", encoding="utf8") as fh:
        fh.write(content)


def gem4(x, y, r, fill, stroke):
    return f'<polygon points="{pts(poly(4, r, -90, x, y))}" fill="{fill}" stroke="{stroke}" stroke-width=".5"/>'


# ---------------------------------------------------------------- gilded: gold brocade
def gilded():
    defs = (
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4d06"/><stop offset=".28" stop-color="#f6d365"/>'
        '<stop offset=".5" stop-color="#fff6c2"/><stop offset=".72" stop-color="#d4a017"/><stop offset="1" stop-color="#6e4505"/></linearGradient>'
        '<radialGradient id="b" cx=".5" cy=".45" r=".85"><stop offset="0" stop-color="#3d2907"/><stop offset="1" stop-color="#0f0901"/></radialGradient>'
        '<pattern id="l" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H9M0 0V9" stroke="url(#g)" stroke-width=".45" opacity=".5"/></pattern>'
        '<radialGradient id="m" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff6c2"/><stop offset=".5" stop-color="#e6b422"/><stop offset="1" stop-color="#7a4d06"/></radialGradient>'
    )
    rays = "".join(
        f'<path d="M{f(CX + 9 * math.cos(math.radians(a)))} {f(CY + 9 * math.sin(math.radians(a)))}L{f(CX + 22 * math.cos(math.radians(a)))} {f(CY + 22 * math.sin(math.radians(a)))}" stroke="url(#g)" stroke-width="1.1" stroke-linecap="round"/>'
        for a in range(0, 360, 22)
    )
    body = (
        '<rect width="100" height="140" fill="url(#b)"/><rect width="100" height="140" fill="url(#l)"/>'
        + frame("url(#g)", 1.8, 0.75)
        + corners("url(#g)", 11, 1.6)
        + f'<circle cx="{CX}" cy="{CY}" r="29" fill="#120b02" stroke="url(#g)" stroke-width="1.8"/>'
        + f'<circle cx="{CX}" cy="{CY}" r="25.5" fill="none" stroke="url(#g)" stroke-width=".6" stroke-dasharray="1.4 1.4"/>'
        + rays
        + f'<polygon points="{pts(star(8, 15, 7))}" fill="url(#m)" stroke="#5b3a04" stroke-width=".5"/>'
        + f'<circle cx="{CX}" cy="{CY}" r="3.4" fill="#120b02" stroke="url(#g)" stroke-width=".8"/>'
        + "".join(gem4(x, y, 2.6, "url(#g)", "none") for x, y in [(50, 22), (50, 118), (24, 70), (76, 70)])
    )
    write("gilded", svg(body, defs))


# ---------------------------------------------------------------- neon: synthwave grid and a glowing hexagon
def neon():
    defs = (
        '<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0720"/><stop offset=".5" stop-color="#150a3a"/><stop offset="1" stop-color="#0a0720"/></linearGradient>'
        '<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
        '<radialGradient id="h" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#f472b6" stop-opacity=".35"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>'
    )
    grid = ""
    for x in range(-90, 191, 13):
        grid += f'<path d="M{CX} {CY}L{x} 0M{CX} {CY}L{x} 140" stroke="#22d3ee" stroke-opacity=".38" stroke-width=".5"/>'
    for k in range(1, 8):
        d = 3 + k * k * 1.05
        grid += f'<path d="M0 {f(CY - d)}H100M0 {f(CY + d)}H100" stroke="#22d3ee" stroke-opacity="{f(0.45 - k * 0.04)}" stroke-width=".5"/>'
    body = (
        '<rect width="100" height="140" fill="url(#b)"/>'
        + grid
        + f'<circle cx="{CX}" cy="{CY}" r="30" fill="url(#h)"/>'
        + f'<polygon points="{pts(poly(6, 25))}" fill="#06031a" stroke="#22d3ee" stroke-width="1.2" filter="url(#gl)"/>'
        + f'<polygon points="{pts(poly(6, 22))}" fill="none" stroke="#22d3ee" stroke-opacity=".55" stroke-width=".6"/>'
        + f'<polygon points="{pts(poly(6, 14))}" fill="none" stroke="#f472b6" stroke-width="1.2" filter="url(#gl)"/>'
        + f'<polygon points="{pts(poly(3, 7))}" fill="#f472b6" opacity=".9" filter="url(#gl)"/>'
        + '<rect x="5" y="5" width="90" height="130" rx="3" fill="none" stroke="#22d3ee" stroke-width="1.2" filter="url(#gl)"/>'
        + corners("#f472b6", 10, 1.4)
    )
    write("neon", svg(body, defs))


# ---------------------------------------------------------------- obsidian: dark glass shards and a violet crystal
def obsidian():
    defs = (
        '<radialGradient id="b" cx=".5" cy=".5" r=".8"><stop offset="0" stop-color="#241d44"/><stop offset="1" stop-color="#07060e"/></radialGradient>'
        '<linearGradient id="c1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ddd6fe"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>'
        '<linearGradient id="c2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#4c1d95"/></linearGradient>'
        '<linearGradient id="c3" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#2e1065"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>'
    )
    shades = ["#14102a", "#1d1840", "#0c0a1a", "#26204e", "#100d22", "#1a1538"]
    shards = ""
    n = 14
    for i in range(n):
        a0, a1 = 360 * i / n - 90, 360 * (i + 1) / n - 90
        r = 120
        p0 = (CX + r * math.cos(math.radians(a0)), CY + r * math.sin(math.radians(a0)))
        p1 = (CX + r * math.cos(math.radians(a1)), CY + r * math.sin(math.radians(a1)))
        shards += f'<polygon points="{CX},{CY} {pts([p0, p1])}" fill="{shades[i % len(shades)]}" stroke="#7c6bd6" stroke-opacity=".28" stroke-width=".4"/>'
    rings = f'<circle cx="{CX}" cy="{CY}" r="40" fill="none" stroke="#7c6bd6" stroke-opacity=".25" stroke-width=".4"/>'
    hexo = poly(6, 22)
    facets = ""
    fills = ["url(#c1)", "url(#c2)", "url(#c3)", "url(#c1)", "url(#c2)", "url(#c3)"]
    for i in range(6):
        facets += f'<polygon points="{CX},{CY} {pts([hexo[i], hexo[(i + 1) % 6]])}" fill="{fills[i]}" stroke="#ede9fe" stroke-opacity=".7" stroke-width=".5"/>'
    body = (
        '<rect width="100" height="140" fill="url(#b)"/>'
        + shards
        + rings
        + f'<polygon points="{pts(poly(6, 26))}" fill="#0a0818" stroke="#a78bfa" stroke-width="1.2"/>'
        + facets
        + f'<polygon points="{pts(poly(6, 22))}" fill="none" stroke="#ede9fe" stroke-width=".9"/>'
        + frame("#8b7bea", 1.2, 0.45)
        + corners("#c4b5fd", 9, 1.2)
    )
    write("obsidian", svg(body, defs))


# ---------------------------------------------------------------- sakura: cherry blossoms
def blossom(cx, cy, r, fill, edge, rot=0, centre="#be185d", opacity=1):
    out = ""
    for k in range(5):
        a = rot + k * 72
        out += (
            f'<ellipse cx="{f(cx)}" cy="{f(cy - r * 0.52)}" rx="{f(r * 0.38)}" ry="{f(r * 0.56)}" fill="{fill}" stroke="{edge}" '
            f'stroke-width="{f(r * 0.05)}" opacity="{opacity}" transform="rotate({f(a)} {f(cx)} {f(cy)})"/>'
        )
    out += f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.17)}" fill="{centre}"/>'
    for k in range(5):
        a = math.radians(rot + k * 72 - 90)
        out += f'<circle cx="{f(cx + r * 0.3 * math.cos(a))}" cy="{f(cy + r * 0.3 * math.sin(a))}" r="{f(r * 0.05)}" fill="{centre}"/>'
    return out


def sakura():
    defs = (
        '<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#831843"/><stop offset=".5" stop-color="#db2777"/><stop offset="1" stop-color="#f9a8d4"/></linearGradient>'
        '<radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#500724" stop-opacity=".45"/></radialGradient>'
    )
    rnd = random.Random(7)
    small = ""
    spots = [(20, 26), (78, 22), (84, 62), (16, 78), (24, 118), (76, 116), (50, 14), (50, 128), (88, 96)]
    for i, (x, y) in enumerate(spots):
        small += blossom(x, y, 6.5 - (i % 3), "#fff1f2", "#f9a8d4", rnd.uniform(0, 72), "#db2777", 0.8)
    petals = ""
    for _ in range(14):
        x, y = rnd.uniform(8, 92), rnd.uniform(8, 132)
        petals += (
            f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="1.4" ry="2.1" fill="#fff1f2" opacity="{f(rnd.uniform(.35, .7))}" '
            f'transform="rotate({f(rnd.uniform(0, 180))} {f(x)} {f(y)})"/>'
        )
    body = (
        '<rect width="100" height="140" fill="url(#b)"/><rect width="100" height="140" fill="url(#v)"/>'
        + petals
        + small
        + f'<circle cx="{CX}" cy="{CY}" r="29" fill="#831843" fill-opacity=".55" stroke="#fff1f2" stroke-width="1.4"/>'
        + f'<circle cx="{CX}" cy="{CY}" r="25.5" fill="none" stroke="#fbcfe8" stroke-opacity=".7" stroke-width=".6"/>'
        + blossom(CX, CY, 21, "#fff1f2", "#f472b6", 0, "#be185d")
        + frame("#fff1f2", 1.3, 0.55)
    )
    write("sakura", svg(body, defs))


# ---------------------------------------------------------------- aurora: northern lights over mountains
def aurora():
    defs = (
        '<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617"/><stop offset=".5" stop-color="#0b1b3a"/><stop offset="1" stop-color="#020617"/></linearGradient>'
        '<linearGradient id="r1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34d399" stop-opacity="0"/><stop offset=".35" stop-color="#34d399"/><stop offset=".7" stop-color="#22d3ee"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>'
        '<linearGradient id="r2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a78bfa" stop-opacity="0"/><stop offset=".4" stop-color="#a78bfa"/><stop offset=".8" stop-color="#34d399"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></linearGradient>'
        '<filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>'
        '<filter id="bs" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1"/></filter>'
    )
    ribbons = (
        '<path d="M-5 58C20 38 38 74 58 56S86 34 105 52V72C86 56 70 82 52 72S18 56 -5 80Z" fill="url(#r1)" opacity=".85" filter="url(#bl)"/>'
        '<path d="M-5 70C18 56 36 88 56 72S84 52 105 68V82C86 72 70 98 52 86S18 76 -5 94Z" fill="url(#r2)" opacity=".7" filter="url(#bl)"/>'
        '<path d="M-5 64C22 46 40 82 60 64S86 44 105 60" fill="none" stroke="#bbf7d0" stroke-width="1.1" opacity=".75" filter="url(#bs)"/>'
    )
    mountains = (
        '<path d="M0 140V122L14 108 24 118 38 98 52 116 64 104 78 120 90 108 100 118V140Z" fill="#050b1c"/>'
        '<path d="M0 140V128L16 118 28 126 44 112 58 124 72 114 88 126 100 120V140Z" fill="#0a1530"/>'
    )
    body = (
        '<rect width="100" height="140" fill="url(#b)"/>'
        + stars_field(46, 21, "#e0f2fe", 0.3, 0.9, 12, 128)
        + ribbons
        + mountains
        + f'<g transform="translate(0 140) scale(1 -1)">{mountains}</g>'
        + f'<polygon points="{pts(star(4, 7, 1.7))}" fill="#ecfeff"/>'
        + f'<circle cx="{CX}" cy="{CY}" r="11" fill="none" stroke="#a7f3d0" stroke-opacity=".5" stroke-width=".5"/>'
        + frame("#a7f3d0", 1.2, 0.45)
    )
    write("aurora", svg(body, defs))


# ---------------------------------------------------------------- crimson (OldBlood): wine, gold lattice, a ruby diamond
def crimson():
    defs = (
        '<radialGradient id="b" cx=".5" cy=".45" r=".85"><stop offset="0" stop-color="#9f1239"/><stop offset=".6" stop-color="#6b0f2a"/><stop offset="1" stop-color="#2a0511"/></radialGradient>'
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8860b"/><stop offset=".4" stop-color="#fde68a"/><stop offset=".6" stop-color="#f5c542"/><stop offset="1" stop-color="#8a5a0a"/></linearGradient>'
        '<pattern id="l" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H9M0 0V9" stroke="#f5c542" stroke-opacity=".22" stroke-width=".55"/></pattern>'
        '<radialGradient id="ru" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fda4af"/><stop offset=".45" stop-color="#e11d48"/><stop offset="1" stop-color="#4c0519"/></radialGradient>'
    )
    d1 = [(CX, CY - 34), (CX + 24, CY), (CX, CY + 34), (CX - 24, CY)]
    d2 = [(CX, CY - 26), (CX + 18, CY), (CX, CY + 26), (CX - 18, CY)]
    body = (
        '<rect width="100" height="140" fill="url(#b)"/><rect width="100" height="140" fill="url(#l)"/>'
        + frame("url(#g)", 1.6, 0.7)
        + corners("url(#g)", 12, 1.5)
        + f'<polygon points="{pts(d1)}" fill="#3a0716" stroke="url(#g)" stroke-width="1.6"/>'
        + f'<polygon points="{pts(d2)}" fill="none" stroke="url(#g)" stroke-opacity=".7" stroke-width=".7"/>'
        + f'<polygon points="{pts(star(8, 15, 6.5, -90))}" fill="url(#g)" stroke="#5b3a04" stroke-width=".4"/>'
        + f'<circle cx="{CX}" cy="{CY}" r="7.2" fill="url(#ru)" stroke="url(#g)" stroke-width="1"/>'
        + f'<circle cx="{CX - 2}" cy="{CY - 2.4}" r="1.6" fill="#fff" opacity=".7"/>'
        + "".join(f'<circle cx="{x}" cy="{y}" r="1.5" fill="url(#g)"/>' for x, y in [(50, 17), (50, 123), (18, 70), (82, 70)])
    )
    write("crimson", svg(body, defs))


# ---------------------------------------------------------------- emerald: scales, gold filigree, a cut gem
def emerald():
    defs = (
        '<radialGradient id="b" cx=".5" cy=".45" r=".85"><stop offset="0" stop-color="#047857"/><stop offset=".6" stop-color="#064e3b"/><stop offset="1" stop-color="#022c22"/></radialGradient>'
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8860b"/><stop offset=".4" stop-color="#fde68a"/><stop offset=".6" stop-color="#f5c542"/><stop offset="1" stop-color="#8a5a0a"/></linearGradient>'
        '<pattern id="s" width="16" height="11" patternUnits="userSpaceOnUse"><g fill="none" stroke="#f5c542" stroke-opacity=".32" stroke-width=".55"><circle cx="8" cy="11" r="8"/><circle cx="8" cy="11" r="5"/><circle cx="0" cy="5.5" r="8"/><circle cx="16" cy="5.5" r="8"/></g></pattern>'
        '<linearGradient id="e1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a7f3d0"/><stop offset="1" stop-color="#059669"/></linearGradient>'
        '<linearGradient id="e2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#047857"/></linearGradient>'
        '<linearGradient id="e3" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#065f46"/><stop offset="1" stop-color="#10b981"/></linearGradient>'
    )
    oct_o = poly(8, 21, -67.5)
    oct_i = poly(8, 10.5, -67.5)
    facets = ""
    fills = ["url(#e1)", "url(#e2)", "url(#e3)", "url(#e1)", "url(#e2)", "url(#e3)", "url(#e1)", "url(#e2)"]
    for i in range(8):
        a, b = oct_o[i], oct_o[(i + 1) % 8]
        c, d = oct_i[(i + 1) % 8], oct_i[i]
        facets += f'<polygon points="{pts([a, b, c, d])}" fill="{fills[i]}" stroke="#ecfdf5" stroke-opacity=".7" stroke-width=".45"/>'
    body = (
        '<rect width="100" height="140" fill="url(#b)"/><rect width="100" height="140" fill="url(#s)"/>'
        + frame("url(#g)", 1.6, 0.7)
        + corners("url(#g)", 12, 1.5)
        + f'<circle cx="{CX}" cy="{CY}" r="29" fill="#022c22" stroke="url(#g)" stroke-width="1.7"/>'
        + f'<circle cx="{CX}" cy="{CY}" r="25.6" fill="none" stroke="url(#g)" stroke-opacity=".6" stroke-width=".6"/>'
        + f'<polygon points="{pts(oct_o)}" fill="#064e3b" stroke="url(#g)" stroke-width="1"/>'
        + facets
        + f'<polygon points="{pts(oct_i)}" fill="#a7f3d0" fill-opacity=".85" stroke="#ecfdf5" stroke-width=".5"/>'
        + f'<polygon points="{pts([(CX - 3, CY - 6), (CX + 1, CY - 7), (CX - 1, CY - 2)])}" fill="#fff" opacity=".75"/>'
        + "".join(gem4(x, y, 2.6, "url(#e1)", "url(#g)") for x, y in [(50, 17), (50, 123), (18, 70), (82, 70)])
    )
    write("emerald", svg(body, defs))


# ---------------------------------------------------------------- midnight (Goodnight): a moon over a starry night
def midnight():
    defs = (
        '<radialGradient id="b" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#4f46e5"/><stop offset=".55" stop-color="#1e1b4b"/><stop offset="1" stop-color="#090722"/></radialGradient>'
        '<radialGradient id="mo" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e0e7ff"/><stop offset="1" stop-color="#a5b4fc"/></radialGradient>'
        '<radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#c7d2fe" stop-opacity=".55"/><stop offset="1" stop-color="#c7d2fe" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>'
        f'<mask id="cut"><rect width="100" height="140" fill="#fff"/><circle cx="{CX + 11}" cy="{CY - 5}" r="19" fill="#000"/></mask>'
    )
    body = (
        '<rect width="100" height="140" fill="url(#b)"/>'
        + stars_field(44, 5, "#fff", 0.3, 1.2, 12, 128)
        + f'<circle cx="{CX}" cy="{CY}" r="38" fill="url(#gl)"/>'
        + f'<circle cx="{CX - 4}" cy="{CY}" r="25" fill="url(#mo)" mask="url(#cut)"/>'
        + f'<g fill="#a5b4fc" opacity=".4"><circle cx="{CX - 16}" cy="{CY - 8}" r="3"/><circle cx="{CX - 20}" cy="{CY + 7}" r="2"/><circle cx="{CX - 12}" cy="{CY + 14}" r="2.4"/></g>'
        + '<path d="M20 30L42 18" stroke="url(#sh)" stroke-width="1" stroke-linecap="round"/><circle cx="42" cy="18" r="1.1" fill="#fff"/>'
        + '<path d="M58 124L80 112" stroke="url(#sh)" stroke-width=".8" stroke-linecap="round"/><circle cx="80" cy="112" r=".9" fill="#fff"/>'
        + "".join(f'<polygon points="{pts(star(4, r, r * 0.28, -90, x, y))}" fill="#fff"/>' for x, y, r in [(26, 104, 3.4), (76, 36, 3), (78, 94, 2.2)])
        + frame("#c7d2fe", 1.3, 0.5)
        + corners("#e0e7ff", 9, 1.1)
    )
    write("midnight", svg(body, defs))


# ---------------------------------------------------------------- damask (Elegant): rose damask with a medallion
def damask():
    motif = (
        '<g id="m"><path d="M12 2C17 9 20 12 20 17C20 21 16 23 12 20.5C8 23 4 21 4 17C4 12 7 9 12 2Z" fill="#fda4af"/>'
        '<path d="M12 20.5C12 25 8.5 28 3 28.5M12 20.5C12 25 15.5 28 21 28.5" stroke="#fda4af" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
        '<circle cx="12" cy="14" r="2.4" fill="#4c0519"/></g>'
    )
    defs = (
        motif
        + '<pattern id="d" width="24" height="34" patternUnits="userSpaceOnUse"><use href="#m"/><use href="#m" x="-12" y="17"/><use href="#m" x="12" y="17"/></pattern>'
        + '<radialGradient id="b" cx=".5" cy=".45" r=".85"><stop offset="0" stop-color="#7f1d3a"/><stop offset=".6" stop-color="#4c0519"/><stop offset="1" stop-color="#2a0310"/></radialGradient>'
        + '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8b4a0"/><stop offset=".4" stop-color="#ffe4e6"/><stop offset=".6" stop-color="#fda4af"/><stop offset="1" stop-color="#be7a86"/></linearGradient>'
    )
    body = (
        '<rect width="100" height="140" fill="url(#b)"/><rect width="100" height="140" fill="url(#d)" opacity=".5"/>'
        + f'<ellipse cx="{CX}" cy="{CY}" rx="26" ry="33" fill="#3a0716" stroke="url(#g)" stroke-width="1.6"/>'
        + f'<ellipse cx="{CX}" cy="{CY}" rx="22" ry="29" fill="none" stroke="url(#g)" stroke-opacity=".7" stroke-width=".6"/>'
        + f'<ellipse cx="{CX}" cy="{CY}" rx="18.5" ry="25" fill="none" stroke="url(#g)" stroke-opacity=".35" stroke-width=".5" stroke-dasharray="1.3 1.3"/>'
        + f'<g transform="translate({CX - 12} {CY - 15})"><use href="#m"/></g>'
        + gem4(CX, CY + 22, 3.4, "url(#g)", "none")
        + gem4(CX, CY - 22, 3.4, "url(#g)", "none")
        + frame("url(#g)", 1.5, 0.6)
        + corners("url(#g)", 11, 1.4)
    )
    write("damask", svg(body, defs))


# ================================================================ faces: a light texture over the paper colour of the deck
def face_svg(inner, defs=""):
    return svg(inner, defs)


def gilded_face():
    rays = "".join(
        f'<path d="M{CX} {CY}L{f(CX + 70 * math.cos(math.radians(a)))} {f(CY + 70 * math.sin(math.radians(a)))}" stroke="#b8860b" stroke-opacity=".1" stroke-width="1.2"/>'
        for a in range(0, 360, 15)
    )
    defs = '<pattern id="l" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H9M0 0V9" stroke="#b8860b" stroke-opacity=".22" stroke-width=".5"/></pattern>'
    body = (
        '<rect width="100" height="140" fill="url(#l)"/>' + rays
        + '<rect x="4" y="4" width="92" height="132" rx="3" fill="none" stroke="#8a5a0a" stroke-opacity=".55" stroke-width=".8"/>'
        + corners("#8a5a0a", 9, 1.4)
    )
    write("gilded-face", face_svg(body, defs))


def neon_face():
    grid = ""
    for x in range(-60, 161, 16):
        grid += f'<path d="M{CX} {CY}L{x} 0M{CX} {CY}L{x} 140" stroke="#22d3ee" stroke-opacity=".12" stroke-width=".5"/>'
    for k in range(1, 8):
        d = 3 + k * k * 1.05
        grid += f'<path d="M0 {f(CY - d)}H100M0 {f(CY + d)}H100" stroke="#22d3ee" stroke-opacity=".12" stroke-width=".5"/>'
    body = grid + '<rect x="4" y="4" width="92" height="132" rx="3" fill="none" stroke="#22d3ee" stroke-opacity=".6" stroke-width=".8"/>' + corners("#f472b6", 9, 1.3)
    write("neon-face", face_svg(body))


def obsidian_face():
    shards = ""
    n = 14
    for i in range(n):
        a0 = 360 * i / n - 90
        shards += f'<path d="M{CX} {CY}L{f(CX + 120 * math.cos(math.radians(a0)))} {f(CY + 120 * math.sin(math.radians(a0)))}" stroke="#7c6bd6" stroke-opacity=".16" stroke-width=".5"/>'
    body = shards + f'<polygon points="{pts(poly(6, 24))}" fill="none" stroke="#a78bfa" stroke-opacity=".18" stroke-width=".6"/>' + '<rect x="4" y="4" width="92" height="132" rx="3" fill="none" stroke="#a78bfa" stroke-opacity=".5" stroke-width=".8"/>' + corners("#c4b5fd", 9, 1.2)
    write("obsidian-face", face_svg(body))


def sakura_face():
    rnd = random.Random(11)
    out = ""
    for x, y, r in [(10, 12, 5), (90, 128, 5), (92, 14, 3.4), (8, 126, 3.4)]:
        out += blossom(x, y, r, "#fbcfe8", "#f472b6", rnd.uniform(0, 72), "#db2777", 0.55)
    for _ in range(10):
        x, y = rnd.uniform(10, 90), rnd.uniform(10, 130)
        out += f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="1.2" ry="1.9" fill="#f9a8d4" opacity=".28" transform="rotate({f(rnd.uniform(0, 180))} {f(x)} {f(y)})"/>'
    body = out + '<rect x="4" y="4" width="92" height="132" rx="3" fill="none" stroke="#f472b6" stroke-opacity=".5" stroke-width=".8"/>'
    write("sakura-face", face_svg(body))


def aurora_face():
    defs = (
        '<linearGradient id="r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34d399" stop-opacity="0"/><stop offset=".5" stop-color="#34d399" stop-opacity=".3"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient>'
        '<filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>'
    )
    body = (
        '<path d="M-5 24C20 6 44 36 66 20S92 8 105 18V34C88 26 70 46 50 38S18 28 -5 44Z" fill="url(#r)" filter="url(#bl)"/>'
        '<path d="M-5 112C20 98 44 126 66 110S92 100 105 108V124C88 116 70 134 50 128S18 118 -5 132Z" fill="url(#r)" filter="url(#bl)"/>'
        + stars_field(14, 4, "#6ee7b7", 0.3, 0.7, 8, 132)
        + '<rect x="4" y="4" width="92" height="132" rx="3" fill="none" stroke="#34d399" stroke-opacity=".55" stroke-width=".8"/>'
    )
    write("aurora-face", face_svg(body, defs))


for fn in (gilded_face, neon_face, obsidian_face, sakura_face, aurora_face, gilded, neon, obsidian, sakura, aurora, crimson, emerald, midnight, damask):
    fn()
print("done")
