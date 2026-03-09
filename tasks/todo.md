# BuzzerBrosParty – Task List

## Koncept
Česká verze CrowdParty – interaktivní kvízová hra pro skupiny.
- **Host** vytvoří místnost (room) s vlastními otázkami (text, obrázky, YouTube videa)
- **Hráči** se připojí přes PIN (zadá host před hrou) – funguje přes internet
- Host řídí průběh hry na sdílené obrazovce, hráči odpovídají na svých telefonech
- Podpora týmů i sólo režimu
- Celé UI v češtině

## Phase 1: Project Scaffold

### Goal
Monorepo, Express + Socket.io server, React + Vite client, fungující Socket.io spojení.

### Architecture
- **Monorepo**: npm workspaces (`client/` + `server/`)
- **Server**: Express + Socket.io + cors + multer (upload obrázků)
- **Client**: Vite + React + Tailwind + socket.io-client
- **Média**: Obrázky = upload na server (`server/uploads/`), videa = YouTube embed URL
- **Připojení hráčů**: PIN kód (host nastaví při vytvoření hry), funguje přes internet
- **Routing**: React Router – `/` (join), `/host` (hostitel), `/play` (hráč v hře)
- **State**: In-memory na serveru (rooms, players, questions, scores)
- **Deploy**: Internet-ready – `VITE_SERVER_URL` env var

### Scaffold Tasks

- [ ] Root `package.json` with npm workspaces
- [ ] `server/` – Express + Socket.io, CORS, hello-world event
- [ ] `client/` – Vite + React + Tailwind, socket.io-client, hello-world listener
- [ ] Confirm bidirectional Socket.io message
- [ ] `.env.example` + basic `README.md`

### File Structure
```
BuzzerBrosParty/
├── package.json              ← root workspaces
├── .env.example
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           ← React Router
│       ├── socket.js         ← singleton socket instance
│       └── pages/
│           ├── JoinPage.jsx  ← PIN vstup pro hráče
│           ├── HostPage.jsx  ← vytvoření + řízení hry
│           └── PlayPage.jsx  ← hráčský pohled během hry
└── server/
    ├── package.json
    └── src/
        ├── index.js          ← Express + Socket.io entry
        ├── gameState.js      ← in-memory rooms/players/questions
        └── socket/
            └── handlers.js   ← Socket.io event handlers
```

## Phase 2: Host UI – Vytvoření hry
- [ ] Nastavení PINu pro místnost
- [ ] Editor otázek: text otázky, 2–4 odpovědi, správná odpověď
- [ ] Upload obrázků k otázkám (multer)
- [ ] YouTube embed URL k otázkám
- [ ] Náhled otázky (obrázek/video + text)
- [ ] Konfigurace: počet týmů / sólo režim, časový limit na odpověď

## Phase 3: Připojení hráčů
- [ ] JoinPage: zadání PINu + jména/týmu
- [ ] Waiting lobby – host vidí připojené hráče
- [ ] QR kód pro snadné připojení (volitelně)

## Phase 4: Herní smyčka (real-time)
- [ ] Host zobrazí otázku → všichni hráči ji vidí na svém zařízení
- [ ] Hráči odpovídají (A/B/C/D) v časovém limitu
- [ ] Vyhodnocení – správná odpověď, body
- [ ] Průběžný scoreboard
- [ ] Host přepíná mezi otázkami

## Phase 5: Deploy
- [ ] Dockerfile nebo Render/Railway config
- [ ] HTTPS + WSS

---
## Review
_To be filled after each phase_
