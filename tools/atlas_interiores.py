# Atlas de interiores de escaparate (interior mapping) para js/mundo/fachadas.js
#   python tools/atlas_interiores.py <carpeta_con_capturas> <scratch>/interiores_tiendas.png   (el .png NO va a assets: solo el .ktx2)
# Capturas: b1_top.png, b1_bot.png, b2_top.png, ... (cada una = media imagen 2x2 de Gemini, 1280x640).
# Rejilla 4x4 de 512 px:
#   0 farmacia · 1 panadería · 2 ferretería · 3 bar · 4 peluquería · 5 kiosco · 6 ropa · 7 electrónica
#   8 móviles · 9 inmobiliaria · 10-11 saqueadas (caos) · 12-13 capa delantera (fondo verde = transparente)
#   14 grietas del cristal (fondo verde) · 15 rótulos (10 franjas de 512x51)
# Luego: toktx --t2 --encode etc1s --clevel 2 --qlevel 160 --genmipmap --assign_oetf srgb interiores_tiendas.ktx2 interiores_tiendas.png
# (con flipY=false en three: se escribe volteado en vertical, como los demás lienzos horneados)
import sys, os, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
C = 512
A = Image.new('RGB', (C * 4, C * 4), (0, 0, 0))
rnd = random.Random(2030)

def celda(i, im):
    A.paste(im.resize((C, C), Image.LANCZOS), ((i % 4) * C, (i // 4) * C))

RECORTE = {9: .085, 10: .09, 11: .1}  # celdas cuya foto trae marco grueso
def mitades(nombre, i0):
    im = Image.open(os.path.join(src, nombre)).convert('RGB'); w, h = im.size; s = h  # dos cuadrados lado a lado
    r = []
    for k in range(2):
        ins = int(s * RECORTE.get(i0 + k, .038))  # recorta el marco negro de la rejilla
        r.append(im.crop((k * s + ins, ins, (k + 1) * s - ins, s - ins)))
    return r

orden = ['b1_top', 'b1_bot', 'b2_top', 'b2_bot', 'b3_top', 'b3_bot']
fotos = []
for n in orden:
    p = os.path.join(src, n + '.png')
    if os.path.exists(p): fotos += mitades(n + '.png', len(fotos))
for i, f in enumerate(fotos[:12]): celda(i, f)
# celdas que falten: interior procedural (estantes y cajas de colores)
def procedural(i, oscuro=False):
    im = Image.new('RGB', (C, C)); d = ImageDraw.Draw(im)
    for y in range(C):  # fondo en perspectiva de una caja: pared trasera en el centro (mitad)
        pass
    base = (40, 34, 30) if oscuro else (120, 100, 80)
    d.rectangle((0, 0, C, C), fill=base)
    d.polygon([(0, C), (C, C), (C * .75, C * .75), (C * .25, C * .75)], fill=tuple(int(c * .6) for c in base))  # suelo
    d.polygon([(0, 0), (C, 0), (C * .75, C * .25), (C * .25, C * .25)], fill=tuple(int(c * 1.2) for c in base))  # techo
    d.rectangle((C * .25, C * .25, C * .75, C * .75), fill=tuple(int(c * .9) for c in base))
    for k in range(4):
        y = C * (.32 + k * .11)
        d.rectangle((C * .27, y, C * .73, y + 4), fill=(60, 45, 30))
        for p in range(14):
            if oscuro and rnd.random() < .8: continue
            x = C * .28 + p * C * .032; hh = rnd.randint(12, 34)
            d.rectangle((x, y - hh, x + C * .026, y), fill=(rnd.randint(60, 220), rnd.randint(60, 200), rnd.randint(50, 180)))
    return im.filter(ImageFilter.GaussianBlur(.6))
for i in range(len(fotos), 12): celda(i, procedural(i, i >= 10))

# capas delanteras sobre verde puro (el shader recorta el verde): repisa de escaparate con género y mostrador
VERDE = (0, 255, 0)
def capa_repisa(cal):
    im = Image.new('RGB', (C, C), VERDE); d = ImageDraw.Draw(im)
    d.rectangle((0, C * .80, C, C), fill=(46, 36, 28))            # repisa baja del escaparate
    d.rectangle((0, C * .80, C, C * .815), fill=(90, 72, 54))
    x = 14
    while x < C - 30:
        w = rnd.randint(18, 46); h = rnd.randint(30, 90); col = tuple(rnd.randint(40, 230) for _ in range(3))
        if col[1] > col[0] + 40 and col[1] > col[2] + 40: col = (col[1], col[0], col[2])  # nada verde puro
        if rnd.random() < .5: d.rectangle((x, C * .80 - h, x + w, C * .80), fill=col)
        else:
            d.ellipse((x, C * .80 - h * .3, x + w, C * .80), fill=col); d.rectangle((x + w * .3, C * .80 - h, x + w * .7, C * .80 - h * .2), fill=col)
        x += w + rnd.randint(6, 30)
    if cal:  # guirnalda de bombillas arriba
        for k in range(14):
            cx = 18 + k * 36; cy = 22 + 10 * math.sin(k * .9)
            d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(255, 220, 150))
        d.line([(0, 18)] + [(18 + k * 36, 22 + 10 * math.sin(k * .9)) for k in range(14)] + [(C, 18)], fill=(30, 30, 30), width=2)
    return im
celda(12, capa_repisa(True)); celda(13, capa_repisa(False))
# grietas del cristal roto
def grietas():
    im = Image.new('RGB', (C, C), VERDE); d = ImageDraw.Draw(im)
    for _ in range(3):
        cx, cy = rnd.randint(120, 400), rnd.randint(120, 400)
        for k in range(16):
            a = k / 16 * math.tau + rnd.uniform(-.2, .2); r = 0; x, y = cx, cy
            while r < 380:
                st = rnd.randint(14, 40); a += rnd.uniform(-.25, .25); nx, ny = x + math.cos(a) * st, y + math.sin(a) * st
                d.line((x, y, nx, ny), fill=(235, 240, 245), width=2 if r < 60 else 1); x, y, r = nx, ny, r + st
        for rr in (26, 60, 110):
            pts = [(cx + math.cos(t / 12 * math.tau) * rr * rnd.uniform(.8, 1.2), cy + math.sin(t / 12 * math.tau) * rr * rnd.uniform(.8, 1.2)) for t in range(13)]
            d.line(pts, fill=(220, 228, 236), width=1)
        d.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=(10, 12, 14))  # agujero
    return im
celda(14, grietas())
# rótulos de las tiendas (franjas 512x51)
def fuente(px):
    for f in ('bahnschrift.ttf', 'arialbd.ttf'):
        try: return ImageFont.truetype(os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', f), px)
        except OSError: pass
    return ImageFont.load_default()
ROT = [('FARMACIA', (18, 110, 58), (235, 255, 240)), ('PANADERÍA', (110, 72, 30), (255, 238, 200)), ('FERRETERÍA', (28, 58, 102), (255, 255, 255)),
       ('BAR', (90, 30, 20), (255, 214, 150)), ('PELUQUERÍA', (106, 29, 74), (255, 224, 242)), ('PRENSA · KIOSCO', (160, 20, 20), (255, 230, 120)),
       ('MODA', (24, 24, 26), (240, 230, 210)), ('ELECTRODOMÉSTICOS', (20, 70, 120), (230, 245, 255)), ('MÓVILES', (230, 90, 20), (255, 255, 255)),
       ('INMOBILIARIA', (40, 60, 52), (230, 220, 180))]
r15 = Image.new('RGB', (C, C), (10, 10, 10)); d = ImageDraw.Draw(r15)
H = C // 10
for k, (t, fondo, letra) in enumerate(ROT):
    y0 = k * H
    for yy in range(H):  # degradado vertical
        f = 1 - yy / H * .45; d.line((0, y0 + yy, C, y0 + yy), fill=tuple(int(c * f) for c in fondo))
    d.rectangle((3, y0 + 3, C - 4, y0 + H - 4), outline=tuple(min(255, c + 60) for c in fondo), width=2)
    px = 38
    while px > 14 and d.textlength(t, font=fuente(px)) > C - 60: px -= 2
    d.text((C / 2 + (14 if k == 0 else 0), y0 + H / 2 + 1), t, font=fuente(px), fill=letra, anchor='mm')
    if k == 0:  # cruz verde
        cx, cy = 34, y0 + H / 2; d.rectangle((cx - 13, cy - 4, cx + 13, cy + 4), fill=(60, 255, 120)); d.rectangle((cx - 4, cy - 13, cx + 4, cy + 13), fill=(60, 255, 120))
celda(15, r15)
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
A.transpose(Image.FLIP_TOP_BOTTOM).save(out)  # volteado: el .ktx2 se lee con flipY = false
A.save(out.replace('.png', '_vista.png'))
print('ok', len(fotos), 'fotos')
