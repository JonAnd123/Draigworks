#!/usr/bin/env python3
"""Generate the Draigworks-themed copies of the marketing pages into /dw/.
Run from the website folder:  python3 scripts/build-dw.py
Re-run after editing any root page so the /dw/ copies stay in sync."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ["index.html", "services.html", "pricing.html", "hiw-guide.html", "contact.html", "portal.html"]
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Space+Grotesk:wght@400;500;600;700&display=swap">\n'
         '<link rel="stylesheet" href="../css/theme-draigworks.css">\n<meta name="robots" content="noindex,follow">')
out = ROOT / "dw"; out.mkdir(exist_ok=True)

def fix(m):
    attr, q, val = m.group(1), m.group(2), m.group(3)
    if re.match(r"(https?:|mailto:|tel:|//|#|data:|/)", val): return m.group(0)
    base = val.split("#")[0].split("?")[0]
    if base in PAGES: return m.group(0)                      # stay inside /dw/
    if val.startswith("portal/app.html"): val = "../portal/draigworks.html" + val[len("portal/app.html"):]
    else: val = "../" + val
    return f"{attr}={q}{val}{q}"

BRAND = "Draig Dental Compliance"
LOGO = '<img src="img/draigworks-white.png" alt="Draigworks logo" class="dw-logo">'

def rebrand(s):
    s = s.replace('Cymru <span class="cy">Compliance</span>', 'Draig <span class="cy">Dental Compliance</span>')
    return s.replace("Cymru Compliance", BRAND)

# Welsh strings: separate copy so the brand name also changes in Welsh
tr = (ROOT / "js" / "translations.js").read_text(encoding="utf-8")
(out / "translations.js").write_text(rebrand(tr), encoding="utf-8")

for p in PAGES:
    s = (ROOT / p).read_text(encoding="utf-8")
    s = re.sub(r'<img src="img/logo-header\.png"[^>]*>', LOGO, s)
    s = rebrand(s)
    s = s.replace('img/screens/', 'img/screens-dw/')   # portal screenshots in the Draigworks theme
    s = re.sub(r'<link rel="icon"[^>]*>', '<link rel="icon" href="img/draigworks-favicon.ico" sizes="any">', s)
    s = re.sub(r'<link rel="apple-touch-icon"[^>]*>', '<link rel="apple-touch-icon" href="img/draigworks-touch-icon.png">', s)
    s = s.replace("<html lang=\"en\">", '<html lang="en" data-brand="' + BRAND + '">', 1)
    s = s.replace('src="js/translations.js"', 'src="translations.js"')
    s = re.sub(r'\b(href|src)=(["\'])([^"\']*)\2', fix, s)
    s = s.replace('<link rel="stylesheet" href="../css/style.css">', '<link rel="stylesheet" href="../css/style.css">\n' + FONTS, 1)
    s = s.replace("<title>", "<title>", 1)
    (out / p).write_text(s, encoding="utf-8")
    print("wrote dw/" + p)
