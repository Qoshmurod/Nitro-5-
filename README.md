# 🏎️ NITRO 5 — Neon Poyga

Neon uslubidagi arkada poyga o'yini. Brauzerda ishlaydi, o'rnatish kerak emas.

## Ishga tushirish

`index.html` faylini brauzerda oching. Yoki lokal server orqali:

```bash
python3 -m http.server 8000
# keyin http://localhost:8000 manziliga kiring
```

## Boshqaruv

| Tugma | Amal |
|---|---|
| `←` `→` yoki `A` `D` | Chapga / o'ngga |
| `Space`, `Shift` yoki `↑` | Nitro |
| `P` / `Esc` | Pauza |
| `M` | Ovozni o'chirish/yoqish |

Telefonda ekran pastida ◀ NITRO ▶ tugmalari chiqadi.

## O'yin mexanikasi

- **Kombo** — to'siq yonidan juda yaqin o'tsangiz, kombo oshadi va ochko multiplikatori x5 gacha ko'tariladi. 2.6 soniya ichida yana yaqin o'tmasangiz, kombo yo'qoladi.
- **Nitro** — tezlikni 1.65 baravar oshiradi va ochkoni ikki baravar beradi. Yashil **N** kanistrlari nitroni to'ldiradi.
- **Bonuslar** — 🛡 qalqon bitta urilishdan saqlaydi, 🧲 magnit 8 soniya davomida tangalarni o'ziga tortadi.
- **Zonalar** — har 30 soniyada yangi rangli dunyo ochiladi va tezlik oshadi.
- **Tangalar va garaj** — yig'ilgan tangalar saqlanadi. Ularga garajda 6 xil mashina sotib olinadi, eng zo'ri "Kamalak".
- **Vazifalar** — har doim 3 ta faol vazifa bor. Bajarilganda tanga beriladi va keyingisi qiyinroq bo'ladi.
- **Rekordlar jadvali** — eng yaxshi 10 natija brauzerda (`localStorage`) saqlanadi.

## Fayllar

- `index.html` — sahifa va menyular
- `style.css` — neon dizayn
- `game.js` — o'yin mantiqi (Canvas 2D, Web Audio; kutubxonasiz)
