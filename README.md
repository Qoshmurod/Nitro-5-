# 🏎️ NITRO 5 — Neon Poyga

Neon uslubidagi arkada poyga o'yini. Brauzerda ishlaydi, o'rnatish kerak emas.

## Loyiha vazifasi

**Nitro 5** — brauzerda o'ynaladigan, tez va qiziqarli poyga o'yini. Maqsad — neon yo'lda to'siqlardan qochib, iloji boricha uzoqqa borish va eng ko'p ochko to'plash.

- 🎮 **O'yinchiga:** qisqa, ammo qayta-qayta o'ynagisi keladigan poygalar — kombo, sakrash, bonuslar va rekordlar.
- 📈 **Rivojlanish:** tanga yig'ib yangi mashinalar ochish, ularni yaxshilash va vazifalarni bajarish.
- 💻 **Texnik jihat:** faqat HTML, CSS va JavaScript — server, kutubxona yoki o'rnatish talab qilinmaydi. Kompyuterda ham, telefonda ham ishlaydi.

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

Telefonda barmog'ingizni ekran bo'ylab surib boshqarasiz, yoki pastdagi ◀ NITRO ▶ tugmalaridan foydalanasiz.

## O'yin mexanikasi

- **Kombo** — to'siq yonidan juda yaqin o'tsangiz, kombo oshadi va ochko multiplikatori x5 gacha ko'tariladi. Har 4 ta komboda vaqt bir lahzaga sekinlashadi.
- **Nitro** — tezlikni 1.65 baravar oshiradi va ochkoni ikki baravar beradi. Yashil **N** kanistrlari nitroni to'ldiradi.
- **🛫 Tramplin** — ustidan o'tsangiz mashina sakraydi va to'siqlar ustidan uchib o'tadi. Har biri uchun bonus beriladi.
- **Bonuslar** — 🛡 qalqon bitta urilishdan saqlaydi, 🧲 magnit tangalarni o'ziga tortadi.
- **To'siqlar** — oddiy mashinalar, to'siq-barerlar, qator almashtiradigan mashinalar, uzun yuk mashinalari va zigzag yuradigan mototsikllar. Har doim kamida bitta o'tish yo'li qoladi.
- **Zonalar** — har 30 soniyada yangi rangli dunyo ochiladi, tezlik va musiqa tempi oshadi.
- **Garaj** — 6 ta mashina, har birining o'z qobiliyati bor: tez to'ladigan nitro, ko'proq tanga, yaxshi boshqaruv, qalqon bilan start.
- **Yaxshilash** — nitro sig'imi, magnit vaqti, omad va start raketasi. Har biri 5 darajali.
- **Davom etish** — halokatdan keyin 100 tangaga poygani bir marta davom ettirish mumkin.
- **Vazifalar** — har doim 3 ta faol vazifa bor. Bajarilganda tanga beriladi, keyingisi qiyinroq bo'ladi.
- **Kunlik sovg'a** — har kuni kirsangiz tanga beriladi, ketma-ket kunlar uchun 7-kungacha ko'payib boradi.
- **Rekordlar jadvali** — eng yaxshi 10 natija saqlanadi.
- **Musiqa** — fon musiqasi o'yin ichida yaratiladi va nitro hamda kombo paytida kuchayadi.

Barcha natijalar brauzerning o'zida (`localStorage`) saqlanadi.

## Fayllar

- `index.html` — sahifa va menyular
- `style.css` — neon dizayn
- `game.js` — o'yin mantiqi, ovoz va musiqa (Canvas 2D, Web Audio; kutubxonasiz)
