"""Regenerate the app icons: python3 tools/make_icons.py (needs Pillow)."""
from PIL import Image, ImageDraw, ImageFont
import glob
fonts = glob.glob('/usr/share/fonts/**/DejaVuSans-Bold.ttf', recursive=True)
def icon(n, path):
    im = Image.new('RGB', (n, n), '#1f6b55'); d = ImageDraw.Draw(im)
    w, h = int(n*.50), int(n*.56); cx, cy = n//2, n//2
    d.rounded_rectangle([cx-w//2+int(n*.06), cy-h//2-int(n*.05), cx+w//2+int(n*.06), cy+h//2-int(n*.05)], radius=int(n*.05), fill='#5cbf9c')
    x0, y0, x1, y1 = cx-w//2-int(n*.04), cy-h//2+int(n*.03), cx+w//2-int(n*.04), cy+h//2+int(n*.03)
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(n*.05), fill='#ffffff')
    pad = int(n*.04); s = (x1-x0-2*pad)/3; y = y1-int(n*.10)
    for i, c in enumerate(['#1f8a4c', '#dfe5e2', '#c8323c']):
        d.rectangle([x0+pad+i*s, y, x0+pad+(i+1)*s, y+int(n*.035)], fill=c)
    f = ImageFont.truetype(fonts[0], int(n*.13)) if fonts else ImageFont.load_default()
    t = 'Ciao'; bb = d.textbbox((0, 0), t, font=f)
    d.text(((x0+x1)/2-(bb[2]-bb[0])/2-bb[0], (y0+y)/2-(bb[3]-bb[1])/2-bb[1]), t, font=f, fill='#1f6b55')
    im.save(path)
icon(512, 'icons/icon-512.png'); icon(192, 'icons/icon-192.png'); icon(180, 'icons/apple-touch-icon.png')
