from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 1350

def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rr(draw, xy, radius, fill, outline=None, width=2):
    """Rounded rectangle helper."""
    try:
        draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)
    except TypeError:
        draw.rounded_rectangle(xy, radius=radius, fill=fill)
        if outline:
            draw.rounded_rectangle(xy, radius=radius, outline=outline, width=width)

def text_w(draw, text, font):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0]
    except AttributeError:
        return font.getsize(text)[0]

def text_h(draw, text, font):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[3] - bbox[1]
    except AttributeError:
        return font.getsize(text)[1]

def draw_text_centered(draw, cx, cy, text, font, fill):
    w = text_w(draw, text, font)
    h = text_h(draw, text, font)
    draw.text((cx - w // 2, cy - h // 2), text, font=font, fill=fill)

def draw_circle(draw, cx, cy, r, fill, outline=None, width=2):
    draw.ellipse([(cx-r, cy-r), (cx+r, cy+r)], fill=fill, outline=outline, width=width)

def draw_pill(draw, x, y, w, h, text, bg, fg, font):
    rr(draw, [x, y, x+w, y+h], radius=h//2, fill=bg)
    tw = text_w(draw, text, font)
    th = text_h(draw, text, font)
    draw.text((x + (w - tw)//2, y + (h - th)//2), text, font=font, fill=fg)

def draw_arrow_down(draw, cx, y_top, length, color):
    y_bot = y_top + length
    draw.line([(cx, y_top), (cx, y_bot - 6)], fill=color, width=3)
    draw.polygon([(cx-7, y_bot-8), (cx+7, y_bot-8), (cx, y_bot)], fill=color)

# ── Build image ──────────────────────────────────────────────
img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)

# Gradient background (dark navy)
for y in range(H):
    t = y / H
    r = int(8  + 5*t)
    g = int(12 + 14*t)
    b = int(28 + 22*t)
    draw.line([(0, y), (W-1, y)], fill=(r, g, b))

# Subtle dot grid
for gy in range(0, H, 40):
    for gx in range(0, W, 40):
        draw.ellipse([(gx-1, gy-1), (gx+1, gy+1)], fill=(255,255,255,10))

# ── Fonts ─────────────────────────────────────────────────────
F = "C:/Windows/Fonts/"
def fa(s): return ImageFont.truetype(F+"arial.ttf",    s)
def fb(s): return ImageFont.truetype(F+"arialbd.ttf",  s)

f_main_title  = fb(30)
f_main_sub    = fa(13)
f_layer_label = fb(10)
f_layer_title = fb(25)
f_layer_sub   = fa(12)
f_pill_text   = fa(11)
f_badge_num   = fb(19)
f_footer_name = fb(20)
f_footer_url  = fa(13)
f_footer_tiny = fa(10)

# ── Layout constants ──────────────────────────────────────────
PAD_X      = 52          # left/right margin
CARD_X1    = PAD_X
CARD_X2    = W - PAD_X
ACCENT_W   = 7
BADGE_CX   = CARD_X1 + ACCENT_W + 44
TEXT_X     = CARD_X1 + ACCENT_W + 102
PILL_START_X = 648
PILL_AREA_W  = CARD_X2 - PILL_START_X   # ≈ 500
PILL_COLS  = 3
PILL_GAP   = 10
PILL_W     = (PILL_AREA_W - (PILL_COLS-1)*PILL_GAP) // PILL_COLS   # ≈ 160
PILL_H     = 28

# ── Layer definitions ─────────────────────────────────────────
layers = [
    {
        "num": "1",
        "label": "LAYER 1  ·  CLIENT APPLICATIONS",
        "title": "CLIENT APPLICATIONS",
        "sub1":  "Web Browser  ·  Android (Play Store)  ·  iPhone (App Store)",
        "sub2":  "Responsive UI / Mobile-first UX  ·  Offline-capable  ·  Push notifications",
        "accent": "#2563eb",
        "bg":     "#081428",
        "pills": [
            ("Next.js 14",     "#1d4ed8", "#bfdbfe"),
            ("Expo React Native","#1d4ed8","#bfdbfe"),
            ("TailwindCSS",    "#1d4ed8", "#bfdbfe"),
            ("Redux Toolkit",  "#0f2d6b", "#93c5fd"),
            ("TypeScript",     "#0f2d6b", "#93c5fd"),
            ("NativeWind",     "#0f2d6b", "#93c5fd"),
        ],
    },
    {
        "num": "2",
        "label": "LAYER 2  ·  API GATEWAY",
        "title": "API GATEWAY",
        "sub1":  "Port 8000  ·  Single unified entry point for all clients",
        "sub2":  "JWT validation  ·  Rate limiting  ·  SSL termination  ·  CORS  ·  Load balancing",
        "accent": "#d97706",
        "bg":     "#171000",
        "pills": [
            ("FastAPI",        "#92400e", "#fef3c7"),
            ("Nginx Proxy",    "#92400e", "#fef3c7"),
            ("JWT / OAuth2",   "#92400e", "#fef3c7"),
            ("SSL / HTTPS",    "#451a00", "#fcd34d"),
            ("Rate Limiting",  "#451a00", "#fcd34d"),
            ("Load Balancer",  "#451a00", "#fcd34d"),
        ],
    },
    {
        "num": "3",
        "label": "LAYER 3  ·  MICROSERVICES",
        "title": "MICROSERVICES",
        "sub1":  "Clean Architecture  ·  DDD  ·  CQRS  ·  6 independent Python services",
        "sub2":  "Auth :8003  ·  Steer :8001  ·  Skill :8002  ·  DocuMind :8006  ·  Notify :8005  ·  AI-Orch :8004",
        "accent": "#059669",
        "bg":     "#001810",
        "pills": [
            ("Auth Service",   "#14532d", "#86efac"),
            ("Steer Service",  "#14532d", "#86efac"),
            ("Skill Service",  "#14532d", "#86efac"),
            ("DocuMind RAG",   "#052e16", "#4ade80"),
            ("Notify Service", "#052e16", "#4ade80"),
            ("AI Orchestrator","#052e16", "#4ade80"),
        ],
    },
    {
        "num": "4",
        "label": "LAYER 4  ·  AI EXECUTION ENGINE",
        "title": "AI EXECUTION ENGINE",
        "sub1":  "100% local inference  ·  Fully private  ·  No cloud AI cost  ·  GPU accelerated",
        "sub2":  "LLM Chains: Summarize · Entity Extract · Workflow Gen  ·  RAG: Chunk → Embed → Retrieve",
        "accent": "#ea580c",
        "bg":     "#170800",
        "pills": [
            ("Llama 3.2",      "#9a3412", "#fed7aa"),
            ("Ollama :11434",  "#9a3412", "#fed7aa"),
            ("LLM Chains",     "#9a3412", "#fed7aa"),
            ("RAG Pipeline",   "#431407", "#fdba74"),
            ("Sent-Transformers","#431407","#fdba74"),
            ("ChromaDB 384-d", "#431407", "#fdba74"),
        ],
    },
    {
        "num": "5",
        "label": "LAYER 5  ·  DATA STORES",
        "title": "DATA STORES",
        "sub1":  "Per-service isolated databases  ·  Async event bus  ·  Vector store  ·  Token cache",
        "sub2":  "PostgreSQL (relational)  ·  Redis (cache + sessions)  ·  RabbitMQ (events)  ·  ChromaDB (vectors)",
        "accent": "#7c3aed",
        "bg":     "#100820",
        "pills": [
            ("PostgreSQL",     "#581c87", "#e9d5ff"),
            ("Redis Cache",    "#581c87", "#e9d5ff"),
            ("RabbitMQ",       "#581c87", "#e9d5ff"),
            ("ChromaDB",       "#3b0764", "#d8b4fe"),
            ("Alembic ORM",    "#3b0764", "#d8b4fe"),
            ("Event Sourcing", "#3b0764", "#d8b4fe"),
        ],
    },
    {
        "num": "6",
        "label": "LAYER 6  ·  INFRASTRUCTURE & CI/CD  ·  MULTI-CLOUD MLOPS",
        "title": "INFRASTRUCTURE & MLOPS",
        "sub1":  "Docker (local dev) → Kubernetes (prod)  ·  GitHub Actions CI/CD  ·  Multi-cloud deploy",
        "sub2":  "Vercel (Web)  ·  Render (Backend APIs)  ·  EAS (App Stores)  ·  Prometheus + Grafana",
        "accent": "#0284c7",
        "bg":     "#001525",
        "pills": [
            ("Docker Compose", "#0c4a6e", "#7dd3fc"),
            ("Kubernetes",     "#0c4a6e", "#7dd3fc"),
            ("GitHub Actions", "#0c4a6e", "#7dd3fc"),
            ("Vercel  (Web)",  "#082f49", "#bae6fd"),
            ("Render  (API)",  "#082f49", "#bae6fd"),
            ("EAS  (Mobile)",  "#082f49", "#bae6fd"),
        ],
    },
    {
        "num": "7",
        "label": "LAYER 7  ·  TESTING & QUALITY GATES",
        "title": "TESTING & QUALITY GATES",
        "sub1":  "45+ unit · 14 integration · 5 security/prompt-injection · 85%+ coverage target",
        "sub2":  "AI chain schema tests  ·  Nightly LLM regression  ·  Prompt injection hardening  ·  CI enforced",
        "accent": "#16a34a",
        "bg":     "#001808",
        "pills": [
            ("pytest",         "#14532d", "#86efac"),
            ("httpx AsyncClient","#14532d","#86efac"),
            ("85%+ Coverage",  "#14532d", "#86efac"),
            ("Security Tests", "#052e16", "#4ade80"),
            ("Prompt Injection","#052e16","#4ade80"),
            ("Nightly LLM CI", "#052e16", "#4ade80"),
        ],
    },
]

# ── TITLE ─────────────────────────────────────────────────────
TITLE_Y1 = 22
TITLE_H  = 78
rr(draw, [CARD_X1, TITLE_Y1, CARD_X2, TITLE_Y1+TITLE_H], radius=14,
   fill=hex_rgb("#0d1f3c"), outline=hex_rgb("#1d4ed8"), width=2)
# Left blue bar
draw.rectangle([CARD_X1, TITLE_Y1, CARD_X1+ACCENT_W, TITLE_Y1+TITLE_H],
               fill=hex_rgb("#3b82f6"))
draw_text_centered(draw, W//2, TITLE_Y1+30, "RAMBOT  ·  ENTERPRISE AI PLATFORM",
                   f_main_title, hex_rgb("#f1f5f9"))
draw_text_centered(draw, W//2, TITLE_Y1+58,
                   "Full-Stack Architecture  ·  Multi-Cloud MLOps  ·  Local AI  ·  7-Layer Design",
                   f_main_sub, hex_rgb("#64748b"))

# ── CARD LAYOUT ───────────────────────────────────────────────
CARD_H    = 152
ARROW_H   = 16
y_cursor  = TITLE_Y1 + TITLE_H + 14

for idx, layer in enumerate(layers):
    ac  = hex_rgb(layer["accent"])
    bg  = hex_rgb(layer["bg"])
    y1  = y_cursor
    y2  = y1 + CARD_H
    cy  = (y1 + y2) // 2  # vertical center of card

    # Card background
    rr(draw, [CARD_X1, y1, CARD_X2, y2], radius=14, fill=bg,
       outline=ac, width=2)

    # Accent stripe
    draw.rectangle([CARD_X1, y1, CARD_X1+ACCENT_W, y2], fill=ac)
    # Round top-left and bottom-left corners of stripe
    draw.rectangle([CARD_X1, y1, CARD_X1+ACCENT_W+6, y1+14], fill=bg)
    draw.rectangle([CARD_X1, y2-14, CARD_X1+ACCENT_W+6, y2],  fill=bg)
    rr(draw, [CARD_X1, y1, CARD_X1+ACCENT_W, y2], radius=12, fill=ac)

    # Badge circle
    draw_circle(draw, BADGE_CX, cy, 26, fill=hex_rgb("#0f172a"), outline=ac, width=2)
    draw_text_centered(draw, BADGE_CX, cy, layer["num"], f_badge_num, ac)

    # Layer label (small)
    label_y = y1 + 18
    draw.text((TEXT_X, label_y), layer["label"], font=f_layer_label, fill=ac)

    # Layer title
    title_y = y1 + 38
    draw.text((TEXT_X, title_y), layer["title"], font=f_layer_title,
              fill=hex_rgb("#f1f5f9"))

    # Sub lines
    sub1_y = y1 + 76
    draw.text((TEXT_X, sub1_y), layer["sub1"], font=f_layer_sub,
              fill=hex_rgb("#94a3b8"))
    sub2_y = y1 + 98
    draw.text((TEXT_X, sub2_y), layer["sub2"], font=f_layer_sub,
              fill=hex_rgb("#64748b"))

    # Divider between text and pills
    div_x = PILL_START_X - 16
    draw.line([(div_x, y1+22), (div_x, y2-22)], fill=hex_rgb("#1e293b"), width=1)

    # Pills: 2 rows × 3 cols
    pills = layer["pills"]
    for pi, (pill_text, pill_bg, pill_fg) in enumerate(pills):
        row = pi // PILL_COLS
        col = pi %  PILL_COLS
        px  = PILL_START_X + col * (PILL_W + PILL_GAP)
        py  = y1 + 30 + row * (PILL_H + 12)
        draw_pill(draw, px, py, PILL_W, PILL_H,
                  pill_text, hex_rgb(pill_bg), hex_rgb(pill_fg), f_pill_text)

    y_cursor = y2

    # Arrow between layers
    if idx < len(layers) - 1:
        draw_arrow_down(draw, W//2, y_cursor + 2, ARROW_H - 2, ac)
        y_cursor += ARROW_H + 2

# ── FOOTER ────────────────────────────────────────────────────
FOOT_Y = y_cursor + 8
FOOT_H = H - FOOT_Y - 4
draw.rectangle([0, FOOT_Y, W, H], fill=hex_rgb("#060d18"))
draw.line([(0, FOOT_Y), (W, FOOT_Y)], fill=hex_rgb("#1e293b"), width=2)

# Stack line (left)
stack_txt = ("Python 3.11  ·  FastAPI  ·  Next.js 14  ·  Expo RN  ·  Llama 3.2  ·  "
             "Ollama  ·  PostgreSQL  ·  Redis  ·  ChromaDB  ·  Docker  ·  Kubernetes")
draw.text((PAD_X, FOOT_Y + 12), stack_txt, font=f_footer_tiny, fill=hex_rgb("#334155"))

# Name
name_y = FOOT_Y + 30
nw = text_w(draw, "Ganpathi Ramkumar Palanivel", f_footer_name)
draw.text(((W - nw)//2, name_y), "Ganpathi Ramkumar Palanivel",
          font=f_footer_name, fill=hex_rgb("#e2e8f0"))

# URL
url_y = name_y + 28
uw = text_w(draw, "www.ramkumar.cloud", f_footer_url)
draw.text(((W - uw)//2, url_y), "www.ramkumar.cloud",
          font=f_footer_url, fill=hex_rgb("#3b82f6"))

# Save
out = "C:/Users/Ramkumar/Desktop/Rambot/RamBot_Architecture.png"
img.save(out, "PNG", optimize=True)
print(f"Saved: {out}")
print(f"Size : {W} x {H}")
