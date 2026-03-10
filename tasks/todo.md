# BuzzerBrosParty – Task List

## Koncept
Česká verze CrowdParty – interaktivní kvízová hra pro skupiny.
- **Host** vytvoří místnost (room) s vlastními otázkami (text, obrázky, YouTube videa)
- **Hráči** se připojí přes PIN (zadá host před hrou) – funguje přes internet
- Host řídí průběh hry na sdílené obrazovce, hráči odpovídají na svých telefonech
- Podpora týmů i sólo režimu
- Celé UI v češtině

---

# GoldRush Mode – Implementation Plan

## Přehled
Nový herní mód inspirovaný Riskuj / Jeopardy. Grid 6×6 + bonus řádek.

## Architektura

### Game State (server)
```
room.mode = 'goldrush'
room.grCategories = [
  {
    name: string,
    color: string,         // one of 6 colors
    questions: [
      { text, answers[4], correct(0-3), points(100-600), answered: false },  // 6x
      { text, answers[4], correct(0-3), bonus: true, answered: false }        // 1x bonus
    ]
  }
]  // 6 categories

room.grBricks = {
  '0-2': 'gold',    // 'catIdx-qIdx' -> 'gold'|'silver'|'bronze'
  '3-4': 'silver',
  '5-0': 'bronze',
}
room.grTurnOrder = [socketId, ...]   // round-robin pole týmů
room.grTurnIndex = 0                  // kdo vybírá
room.grCurrentCell = null            // { catIdx, qIdx } | null
room.grQuestionStartTime = null       // Date.now() při otevření otázky
room.grPhase = 'lobby' | 'grid' | 'question' | 'reveal' | 'bonus_steal' | 'finished'
```

### Bodování
- Timer: 25 sekund
- Body = `Math.max(0, Math.round(basePoints * (timeRemaining / 25)))`
- Cihličky: Gold +200, Silver +100, Bronze +50 → dostane tým co vybral otázku
- Bonus (správná odpověď): vyber cílový tým → ukradni 50 bodů, sám +50

### Socket Events – nové (prefix `gr:`)
**Host → Server:**
- `gr:setCategories({ pin, categories })`
- `gr:startGame({ pin })`
- `gr:selectQuestion({ pin, catIdx, qIdx })`
- `gr:reveal({ pin })`
- `gr:stealTarget({ pin, targetSocketId })`
- `gr:backToGrid({ pin })`

**Server → Client:**
- `gr:started`
- `gr:gridState({ categories, bricks, turnTeam, scores })`
- `gr:questionOpen({ catIdx, qIdx, text, answers, timeLimit:25, brickType|null })`
- `gr:reveal({ correct, scores, teamAnswers })`
- `gr:bonusSteal({ scores })`
- `gr:finished({ scores })`

## Soubory ke změně / vytvoření

### Nové soubory
- `client/src/pages/GoldRushHostPage.jsx`
- `client/src/pages/GoldRushPlayPage.jsx`
- `server/src/socket/grHandlers.js`

### Upravené soubory
- `client/src/App.jsx` – přidat `/host/goldrush`, `/play/goldrush` routes
- `client/src/pages/HostPage.jsx` – landing: výběr módu (Classic / GoldRush)
- `server/src/gameState.js` – přidat `mode` field + GR helpers
- `server/src/socket/handlers.js` – importovat a registrovat grHandlers

---

## Checklist

### Fáze 1 – Server: GoldRush state & handlers
- [ ] Upravit `gameState.js`: `createRoom(pin, hostSocketId, mode)` + GR fields
- [ ] Vytvořit `grHandlers.js` se všemi gr: events
  - [ ] `gr:setCategories` – uložit kategorie, náhodně rozmístit 3 cihličky
  - [ ] `gr:startGame` – přejít na 'grid', broadcastovat `gr:gridState`
  - [ ] `gr:selectQuestion` – ověřit turn + dostupnost, odhalit cihličku, timer start
  - [ ] `gr:reveal` – vypočítat body (time-based), broadcastovat výsledky
  - [ ] `gr:stealTarget` – bonus krádež 50 bodů
  - [ ] `gr:backToGrid` – reset cell, posunout turn, broadcastovat grid
  - [ ] Disconnect handling pro GR
- [ ] Zaregistrovat grHandlers v `handlers.js`

### Fáze 2 – Mode Selection
- [ ] Upravit `HostPage.jsx` landing: dvě karty Classic / GoldRush
- [ ] GoldRush volba přesměruje na `/host/goldrush`
- [ ] Přidat route `/host/goldrush` a `/play/goldrush` do `App.jsx`

### Fáze 3 – GoldRushHostPage
- [ ] Setup fáze: zadání PIN + vytvoření GR místnosti
- [ ] Editor kategorií: 6 kategorií, 6 otázek (100-600) + 1 bonus
- [ ] Lobby fáze: čekání na hráče (max 6)
- [ ] Grid fáze: 6×6 mřížka + bonus buňky, barevné sloupce, indikátor tahu
- [ ] Question overlay: otázka, timer, počet odpovědí, cihlička animace
- [ ] Reveal fáze: správná odpověď, body, bonus steal UI
- [ ] Finished fáze: finální skóre

### Fáze 4 – GoldRushPlayPage
- [ ] Čekání na výběr otázky
- [ ] Otázka: 4 tlačítka + vizuální timer (body klesají)
- [ ] Reveal: správná/špatná + body z tohoto kola
- [ ] Finished: finální leaderboard

### Fáze 5 – Verifikace
- [ ] Classic mód stále funguje beze změny
- [ ] Manuální test: host vytvoří GR hru, 3 hráči se připojí
- [ ] Ověřit bodování (time-based)
- [ ] Ověřit cihličky (náhodné rozmístění, reward)
- [ ] Ověřit bonus otázku (odemknutí, krádež)
- [ ] Ověřit turn rotation

---

## Review
_Doplnit po dokončení_
