# sticky-fight — 2D Stickman Jangovar O'yin (Fighting Game)

Bu loyiha o'quv markazlarida talabalarga IT/veb-dasturlash namunalari va zamonaviy veb-texnologiyalarni ko'rsatish uchun maxsus tayyorlangan, ro'yxatdan o'tishsiz ishlaydigan, real vaqt rejimidagi (real-time) 2D jangovar brauzer o'yinidir.

---

## 🌟 Asosiy Xususiyatlar

1. **Procedural Canvas Animatsiyalar**: Qahramonlar (stickman) sprite-rasmlardan foydalanmasdan, to'liq HTML5 Canvas orqali matematik formulalar yordamida chiziladi va animatsiya qilinadi. Bu kodni soddalashtiradi va animatsiyalar tezligini boshqarishni osonlashtiradi.
2. **Web Audio API Ovoz Sintezi**: O'yinda tashqi audio (.mp3, .wav) fayllar ishlatilmaydi. Hujum (qilich shovqini), blok (to'qnashuv), zarba (zarba ovozi) va g'alaba/mag'lubiyat ohanglari brauzerning ichki Web Audio API generatorlari orqali dasturiy ravishda sintezlanadi. Bu audio yuklanmay qolish xavfini nolga tushiradi.
3. **Avtoritar Server Modeli (Multiplayer)**: Ko'p o'yinchi rejimida aldashlarning (cheat) oldini olish uchun jismoniy hisob-kitoblar, qilich hit-box to'qnashuvlari, zararlar va joning kamayishi bevosita Node.js (Socket.io) serverida 60 FPS chastotada hisoblanadi.
4. **Aqlli Bot AI (Single Player)**: Kompyuterga qarshi o'yin rejimida bot uch xil qiyinlik darajasiga ega (Oson, Normal, Qiyin). Bot masofani sezadi, o'yinchining hujumlariga ma'lum ehtimollik bilan blok qo'yadi va ba'zida orqaga chekinadi.
5. **Qahramon Xususiyatlari**: 4 ta qahramon rangiga ko'ra alohida bonus statlarga ega (Green - ko'proq jon, Yellow - tezroq yurish, Blue - kuchli blok, Red - tezkor zarbalar).

---

## 🛠️ Loyiha Fayl-Papka Tuzilishi

Loyiha juda toza va modulli strukturaga ega, talabalar tushunishi va o'zgartirishi oson:

```
sticky-fight/
├── client/
│   ├── index.html          # Ekranlar, modal oynalar va mobil tugmalar strukturasi
│   ├── style.css           # Premium glassmorphism dark-theme dizayni
│   └── js/
│       ├── main.js         # Navigatsiya, sozlamalar va Hero tanlash preview loop
│       ├── ui.js           # HP bar, HUD elementlari va Canvas avto-resizer
│       ├── stickman.js     # Stickman skelet-kinematikasi va yog'och qilichni chizish
│       ├── audio.js        # Web Audio API dinamik sintezator
│       ├── botAI.js        # Bot harakatlarining state machine logikasi
│       ├── network.js      # Socket.io orqali multiplayer ulanish va sinxronizatsiya
│       └── battle.js       # Asosiy o'yin sikli (game loop), fizika va effektlar
├── server/
│   ├── server.js           # Express + Socket.io server va 60 FPS physics tick
│   └── roomManager.js      # 5 xonali kodlar va xonalarni 10 daqiqalik tozalash
├── package.json            # Zavisimostlar (express, socket.io)
└── README.md               # Ishga tushirish qo'llanmasi
```

---

## 🚀 Ishga Tushirish Yo'riqnomasi

Loyihani o'z kompyuteringizda ishga tushirish uchun quyidagi bosqichlarni bajaring:

### 1. Talablar
- Tizimingizda [Node.js](https://nodejs.org/) (v16 va undan yuqori) o'rnatilgan bo'lishi kerak.

### 2. Bog'liqliklarni o'rnatish
Loyiha papkasiga o'tib, terminalda quyidagi buyruqni bosing:
```bash
npm install
```

### 3. Serverni ishga tushirish
Serverni va lokal loyihani ishga tushirish:
```bash
npm start
```
Server ishga tushgach, terminalda quyidagi xabar chiqadi:
`[sticky-fight] Server listening on http://localhost:3000`

### 4. Brauzerda ochish
- Brauzeringizda [http://localhost:3000](http://localhost:3000) manziliga kiring.
- Ikki o'yinchili (multiplayer) rejimni tekshirish uchun ikkita alohida brauzer oynasini (yoki inkognito rejimida) ochib, xona kodi orqali ulashingiz mumkin.

---

## 🌐 Serverga Deploy qilish (Render & Railway)

Ushbu o'yin an'anaviy Express serveri va Socket.io (WebSocket) texnologiyasiga asoslangani sababli, uni Vercel kabi Serverless (ephemeral) platformalarda to'liq ishga tushirib bo'lmaydi. O'yinning frontend va backend qismlarini birgalikda doimiy ishlaydigan quyidagi bepul/arzon Node.js server provayderlariga osonlik bilan deploy qilishingiz mumkin:

### Option A. Render.com orqali deploy qilish (Tavsiya etiladi - Bepul)
1. **GitHub'ga yuklash**: Loyihani o'zingizning GitHub hisobingizga yuklang (push qiling).
2. **Render saytiga kiring**: [Render.com](https://render.com/) saytiga kirib, ro'yxatdan o'ting.
3. **Yangi Web Service yarating**: "New +" tugmasini bosing va **Web Service**ni tanlang.
4. **Repositoryni bog'lang**: GitHub hisobingizni ulang va ushbu loyiha repozitoriyasini tanlang.
5. **Sozlamalarni kiriting**:
   - **Name**: `sticky-fight` (yoki ixtiyoriy nom)
   - **Region**: O'zingizga yaqin regionni tanlang (masalan, Frankfurt)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. **Deploy**: Sahifa ostidagi **Create Web Service** tugmasini bosing. Render loyihani avtomatik qurib, sizga doimiy havola (`https://sticky-fight-xxx.onrender.com`) beradi. Havolaga kirganda ham single player, ham real-time multiplayer 100% to'liq ishlaydi!

### Option B. Railway.app orqali deploy qilish
1. **Railway'da ro'yxatdan o'ting**: [Railway.app](https://railway.app/) saytiga kiring.
2. **Yangi Project yarating**: "New Project" -> "Deploy from GitHub repository" tanlang va repozitoriyangizni ulang.
3. **Avtomatik sozlash**: Railway `package.json` ichidagi buyruqlarni ko'rib, loyihani avtomatik ishga tushiradi.
4. **Domain qo'shish**: Project sozlamalariga kirib (Settings), **Generate Domain** tugmasini bossangiz, o'yin havolasi taqdim etiladi.

---

## 🎮 O'yin Boshqaruvi

### Kompyuter (PC) uchun:
- **Yurish (Chapga/O'ngga)**: `A` / `D` yoki `⬅️` / `➡️`
- **Zarba (Hujum)**: `Space` (Probel) yoki `W` / `ArrowUp`
- **Himoya (Blok)**: `S` yoki `Shift` (Chap/O'ng)

### Mobil Qurilmalar uchun:
Ekran ostida virtual boshqaruv pultlari (joysticklar) paydo bo'ladi:
- `⬅️` va `➡️` — harakat qilish.
- `⚔️` — qilich bilan hujum qilish.
- `🛡️` — blok/himoya holatiga o'tish.

---

## 💡 Talabalar uchun O'quv Vazifalari (Topshiriqlar)

Ushbu kod ustida talabalarga quyidagi amaliy topshiriqlarni berish tavsiya etiladi:
1. **Yangi Qahramon Qo'shish**: Masalan, `Purple` (siyohrang) qahramonini qo'shish va unga yangi bonus berish (masalan, zarba berganida raqibni ko'proq orqaga surish — knockback bonus).
2. **Bot AI reaksiyasini sozlash**: [client/js/botAI.js](file:///home/oybek/Documents/projects/sticky-fight/client/js/botAI.js) fayliga kirib, botning hujum qilish masofasini yoki o'yinchiga qarab yurish tezligini o'zgartirish.
3. **Yangi Ovoz Effektlari**: [client/js/audio.js](file:///home/oybek/Documents/projects/sticky-fight/client/js/audio.js) ichida `playVictory()` melodiyasining notalarini o'zgartirish yoki yangi chastota qo'shib sintezlash.
4. **Orqa fonni o'zgartirish**: [client/js/battle.js](file:///home/oybek/Documents/projects/sticky-fight/client/js/battle.js) faylidagi `renderFrame` metodida osmon rangining gradientlarini yoki yer dizaynini (masalan, lava rangiga) o'zgartirish.
