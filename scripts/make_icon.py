"""Draws Melo's original app icon: a monkey with headphones and sunglasses."""
import sys
from PIL import Image, ImageDraw, ImageFilter

S = 4  # supersample factor for smooth edges
N = 1024 * S


def c(v):
    return int(v * S)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


PURPLE = (139, 92, 255)
PINK = (255, 61, 110)
INK = (16, 14, 24)
FUR = (122, 74, 42)
FUR_DARK = (92, 54, 30)
SKIN = (240, 197, 150)
SKIN_SHADE = (222, 172, 124)

# Background: diagonal purple -> pink gradient
grad = Image.new("RGB", (256, 256))
gp = grad.load()
for y in range(256):
    for x in range(256):
        gp[x, y] = lerp(PURPLE, PINK, (x + y) / 510)
img = grad.resize((N, N), Image.BICUBIC)

# Soft glow behind the head
glow = Image.new("L", (N, N), 0)
ImageDraw.Draw(glow).ellipse([c(170), c(200), c(854), c(884)], fill=110)
glow = glow.filter(ImageFilter.GaussianBlur(c(60)))
img.paste(Image.new("RGB", (N, N), (255, 255, 255)), (0, 0), glow)

d = ImageDraw.Draw(img)

# Headband (drawn first so the head sits in front of its lower ends)
d.arc([c(170), c(150), c(854), c(834)], start=190, end=350, fill=INK, width=c(64))
d.arc([c(196), c(176), c(828), c(808)], start=200, end=340, fill=(60, 56, 78), width=c(14))

# Ears peeking out under the cups
for cx in (238, 786):
    d.ellipse([c(cx - 92), c(500), c(cx + 92), c(684)], fill=FUR_DARK)

# Head
d.ellipse([c(232), c(270), c(792), c(830)], fill=FUR)
# Tuft
d.polygon([(c(470), c(290)), (c(512), c(220)), (c(540), c(292))], fill=FUR)
d.polygon([(c(520), c(288)), (c(575), c(236)), (c(585), c(300))], fill=FUR)

# Face: upper heart-shaped mask + muzzle
d.ellipse([c(300), c(400), c(530), c(640)], fill=SKIN)
d.ellipse([c(494), c(400), c(724), c(640)], fill=SKIN)
d.ellipse([c(330), c(560), c(694), c(800)], fill=SKIN)
d.ellipse([c(372), c(640), c(652), c(796)], fill=SKIN_SHADE)
d.ellipse([c(380), c(626), c(644), c(782)], fill=SKIN)

# Sunglasses
d.rounded_rectangle([c(296), c(456), c(500), c(590)], radius=c(56), fill=INK)
d.rounded_rectangle([c(524), c(456), c(728), c(590)], radius=c(56), fill=INK)
d.rectangle([c(490), c(484), c(534), c(510)], fill=INK)
d.line([(c(300), c(486)), (c(256), c(470))], fill=INK, width=c(20))
d.line([(c(724), c(486)), (c(768), c(470))], fill=INK, width=c(20))
# Lens shine
for x0 in (322, 550):
    d.line([(c(x0 + 20), c(560)), (c(x0 + 70), c(480))], fill=(255, 255, 255, 0), width=c(18))
    d.line([(c(x0 + 58), c(566)), (c(x0 + 92), c(512))], fill=(120, 110, 150), width=c(10))
# Pink lens tint along the bottom edge
for x0, x1 in ((296, 500), (524, 728)):
    d.arc([c(x0 + 18), c(470), c(x1 - 18), c(578)], start=20, end=160, fill=PINK, width=c(8))

# Nostrils and smile
d.ellipse([c(470), c(648), c(496), c(672)], fill=FUR_DARK)
d.ellipse([c(528), c(648), c(554), c(672)], fill=FUR_DARK)
d.arc([c(430), c(640), c(594), c(752)], start=25, end=155, fill=FUR_DARK, width=c(14))

# Ear cups
for x0 in (178, 714):
    d.rounded_rectangle([c(x0), c(452), c(x0 + 132), c(712)], radius=c(54), fill=INK)
    d.rounded_rectangle([c(x0 + 24), c(482), c(x0 + 108), c(682)], radius=c(36), fill=PINK)
    d.rounded_rectangle([c(x0 + 40), c(500), c(x0 + 92), c(664)], radius=c(24), fill=(255, 120, 154))

img.resize((1024, 1024), Image.LANCZOS).save(sys.argv[1])
