# BuzzerBros Party 🎉

Česká kvízová party hra inspirovaná CrowdParty. Hostitel vytvoří místnost s PINem, hráči se připojí z jakéhokoliv zařízení přes internet a odpovídají na otázky obohacené o obrázky nebo YouTube videa.

## Rychlý start (lokálně)

```bash
# 1. Nainstaluj závislosti
npm install

# 2. Zkopíruj env soubory
cp .env.example server/.env
cp .env.example client/.env

# 3. Spusť server i klienta najednou
npm run dev
```

- **Klient**: http://localhost:5173
- **Server**: http://localhost:3001

## Struktura projektu

```
BuzzerBrosParty/
├── client/          # Vite + React + Tailwind
└── server/          # Express + Socket.io
```

## Jak to funguje

1. Hostitel jde na `/host`, zadá PIN a připraví otázky (text, obrázky, YouTube)
2. Hráči jdou na `/`, zadají PIN a jméno
3. Hostitel spustí hru – otázky se zobrazují v reálném čase na telefonech hráčů
4. Hráči odpovídají tlačítky A/B/C/D, body se počítají automaticky
5. Na konci se zobrazí výsledková tabule

## Deploy (internet)

1. Nasaď server (Render / Railway / Fly.io) – nastav `PORT` a `CLIENT_URL`
2. Nasaď klienta (Vercel / Netlify) – nastav `VITE_SERVER_URL` na URL serveru
