# -*- coding: utf-8 -*-
"""
Processa as capturas de tela brutas das telas do Equinox Mobile
e gera os mockups com proporção 3:4, cantos arredondados, notch dinâmico
e bordas temáticas para a apresentação SINTEC 2026.

Uso: python scripts/preparar_prints_sintec.py
"""
import os
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_RAW = os.path.join(RAIZ, "assets", "sintec", "raw")
DIR_OUT = os.path.join(RAIZ, "assets", "sintec")

os.makedirs(DIR_RAW, exist_ok=True)
os.makedirs(DIR_OUT, exist_ok=True)

W, H = 500, 670
BG = (15, 23, 42, 255)  # 0F172A

# Cores dos temas das colunas (idênticas a gerar_apresentacao_sintec.py)
DOMAIN_RGB = (52, 211, 153, 255)  # 34D399 (Login)
APP_RGB = (96, 165, 250, 255)     # 60A5FA (Usuário)
UI_RGB = (251, 146, 60, 255)      # FB923C (Admin)
ADAPT_RGB = (167, 139, 250, 255)  # A78BFA (Super Admin)


def apply_phone_shell(canvas, border_color):
    """Aplica máscara de cantos arredondados, borda neon e notch/dynamic island."""
    mask = Image.new("L", canvas.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([(0, 0), (W - 1, H - 1)], radius=32, fill=255)
    canvas.putalpha(mask)

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle([(1, 1), (W - 2, H - 2)], radius=32, outline=border_color, width=3)

    pw, ph = 64, 8
    px = (W - pw) // 2
    py = 12
    draw.rounded_rectangle([(px, py), (px + pw, py + ph)], radius=4, fill=(30, 41, 59, 255))
    return canvas


def main():
    p1 = os.path.join(DIR_RAW, "raw_login.png")
    p2 = os.path.join(DIR_RAW, "raw_usuario.png")
    p3 = os.path.join(DIR_RAW, "raw_admin.png")
    p4 = os.path.join(DIR_RAW, "raw_superadmin.png")

    for p in (p1, p2, p3, p4):
        if not os.path.exists(p):
            print(f"Aviso: {p} não encontrado.")
            return

    im1 = Image.open(p1).convert("RGBA")
    im2 = Image.open(p2).convert("RGBA")
    im3 = Image.open(p3).convert("RGBA")
    im4 = Image.open(p4).convert("RGBA")

    # 1. Login
    crop1 = im1.crop((275, 175, 640, 665))
    s1_factor = 580 / crop1.height
    c1 = crop1.resize((int(crop1.width * s1_factor), 580), Image.Resampling.LANCZOS)
    screen1 = Image.new("RGBA", (W, H), BG)
    screen1.paste(c1, ((W - c1.width) // 2, 45), c1)
    screen1 = apply_phone_shell(screen1, DOMAIN_RGB)
    out1 = os.path.join(DIR_OUT, "print_01_login.png")
    screen1.save(out1)
    print("Salvo ->", out1)

    # Elementos de cabeçalho comuns para 2, 3 e 4
    logo = im2.crop((8, 6, 140, 32))
    logo_s = logo.resize((int(logo.width * 1.3), int(logo.height * 1.3)), Image.Resampling.LANCZOS)

    # 2. Usuário
    av2 = im2.crop((950, 6, 1010, 32))
    av2_s = av2.resize((int(av2.width * 1.3), int(av2.height * 1.3)), Image.Resampling.LANCZOS)
    crop2 = im2.crop((395, 50, 628, 330))
    s2_factor = 410 / crop2.width
    c2 = crop2.resize((410, int(crop2.height * s2_factor)), Image.Resampling.LANCZOS)

    screen2 = Image.new("RGBA", (W, H), BG)
    screen2.paste(logo_s, (22, 28), logo_s)
    screen2.paste(av2_s, (W - av2_s.width - 22, 28), av2_s)
    screen2.paste(c2, ((W - c2.width) // 2, 90), c2)
    screen2 = apply_phone_shell(screen2, APP_RGB)
    out2 = os.path.join(DIR_OUT, "print_02_usuario.png")
    screen2.save(out2)
    print("Salvo ->", out2)

    # 3. Administrador
    av3 = im3.crop((945, 6, 1010, 32))
    av3_s = av3.resize((int(av3.width * 1.3), int(av3.height * 1.3)), Image.Resampling.LANCZOS)
    crop3 = im3.crop((395, 50, 628, 445))
    s3_factor = 550 / crop3.height
    c3 = crop3.resize((int(crop3.width * s3_factor), 550), Image.Resampling.LANCZOS)

    screen3 = Image.new("RGBA", (W, H), BG)
    screen3.paste(logo_s, (22, 28), logo_s)
    screen3.paste(av3_s, (W - av3_s.width - 22, 28), av3_s)
    screen3.paste(c3, ((W - c3.width) // 2, 80), c3)
    screen3 = apply_phone_shell(screen3, UI_RGB)
    out3 = os.path.join(DIR_OUT, "print_03_admin.png")
    screen3.save(out3)
    print("Salvo ->", out3)

    # 4. Super Admin
    av4 = im4.crop((945, 6, 1010, 32))
    av4_s = av4.resize((int(av4.width * 1.3), int(av4.height * 1.3)), Image.Resampling.LANCZOS)
    crop4 = im4.crop((395, 50, 628, 445))
    s4_factor = 550 / crop4.height
    c4 = crop4.resize((int(crop4.width * s4_factor), 550), Image.Resampling.LANCZOS)

    screen4 = Image.new("RGBA", (W, H), BG)
    screen4.paste(logo_s, (22, 28), logo_s)
    screen4.paste(av4_s, (W - av4_s.width - 22, 28), av4_s)
    screen4.paste(c4, ((W - c4.width) // 2, 80), c4)
    screen4 = apply_phone_shell(screen4, ADAPT_RGB)
    out4 = os.path.join(DIR_OUT, "print_04_superadmin.png")
    screen4.save(out4)
    print("Salvo ->", out4)


if __name__ == "__main__":
    main()
