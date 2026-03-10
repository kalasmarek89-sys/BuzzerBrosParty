import { getRoom } from '../gameState.js';

const BRICK_POINTS = { gold: 200, silver: 100, bronze: 50 };
const BRICK_TYPES = ['gold', 'silver', 'bronze'];

export function registerGRHandlers(io, socket) {
  // ── gr:setCategories ───────────────────────────────────────────────────────
  socket.on('gr:setCategories', ({ pin, categories }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id || room.mode !== 'goldrush') return;
    room.grCategories = categories.map((cat) => ({
      ...cat,
      questions: cat.questions.map((q) => ({ ...q, answered: false })),
    }));
    room.grBricks = placeBricks(room.grCategories);
    socket.emit('gr:categoriesSet');
  });

  // ── gr:startGame ───────────────────────────────────────────────────────────
  socket.on('gr:startGame', ({ pin }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id || room.mode !== 'goldrush') return;
    if (!room.grCategories) return socket.emit('error', { message: 'Kategorie nejsou nastaveny.' });
    if (room.players.size === 0) return socket.emit('error', { message: 'Žádní hráči nejsou připojeni.' });

    room.grTurnOrder = [...room.players.keys()];
    room.grTurnIndex = 0;
    room.grPhase = 'grid';

    io.to(`room:${pin}`).emit('gr:started');
    emitGridState(io, room);
  });

  // ── gr:selectQuestion ──────────────────────────────────────────────────────
  socket.on('gr:selectQuestion', ({ pin, catIdx, qIdx }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id || room.mode !== 'goldrush') return;
    if (room.grPhase !== 'grid') return;

    const cat = room.grCategories?.[catIdx];
    if (!cat) return;
    const q = cat.questions[qIdx];
    if (!q || q.answered) return;

    // Bonus question: all regular questions in category must be answered first
    if (q.bonus) {
      const allRegularDone = cat.questions.slice(0, 6).every((rq) => rq.answered);
      if (!allRegularDone) {
        return socket.emit('error', { message: 'Nejprve zodpovězte všechny otázky v této kategorii.' });
      }
    }

    room.grCurrentCell = { catIdx, qIdx };
    room.grQuestionStartTime = Date.now();
    room.grPhase = 'question';

    // Reset player GR answers
    for (const p of room.players.values()) {
      p.grAnswer = null;
      p.grAnswerTime = null;
    }

    // Brick check: award to the selecting team immediately
    const brickKey = `${catIdx}-${qIdx}`;
    const brickType = room.grBricks[brickKey] ?? null;
    if (brickType) {
      const selectingTeamId = room.grTurnOrder[room.grTurnIndex % room.grTurnOrder.length];
      const selectingTeam = room.players.get(selectingTeamId);
      if (selectingTeam) {
        selectingTeam.score += BRICK_POINTS[brickType] ?? 0;
      }
    }

    io.to(`room:${pin}`).emit('gr:questionOpen', {
      catIdx,
      qIdx,
      text: q.text,
      answers: q.answers,
      timeLimit: 25,
      brickType,
      isBonus: q.bonus ?? false,
      basePoints: q.points ?? 0,
    });

    io.to(room.hostSocketId).emit('gr:answerUpdate', { answered: 0, total: room.players.size });
    console.log(`[gr:selectQuestion] cat=${catIdx} q=${qIdx} PIN=${pin}`);
  });

  // ── gr:answer (from players) ───────────────────────────────────────────────
  socket.on('gr:answer', ({ pin, answer }) => {
    const room = getRoom(pin);
    if (!room || room.grPhase !== 'question' || room.mode !== 'goldrush') return;
    const player = room.players.get(socket.id);
    if (!player || player.grAnswer !== null) return; // already answered

    player.grAnswer = answer;
    player.grAnswerTime = Date.now();

    socket.emit('gr:answerAck', { answer });

    const answered = [...room.players.values()].filter((p) => p.grAnswer !== null).length;
    io.to(room.hostSocketId).emit('gr:answerUpdate', { answered, total: room.players.size });
  });

  // ── gr:reveal ──────────────────────────────────────────────────────────────
  socket.on('gr:reveal', ({ pin }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id || room.mode !== 'goldrush') return;
    if (room.grPhase !== 'question') return;

    const { catIdx, qIdx } = room.grCurrentCell;
    const q = room.grCategories[catIdx].questions[qIdx];
    q.answered = true;
    room.grPhase = 'reveal';

    const teamAnswers = [];
    let bonusWinner = null;

    for (const [socketId, player] of room.players) {
      const correct = player.grAnswer === q.correct;
      let pointsEarned = 0;

      if (correct && player.grAnswerTime !== null && !q.bonus) {
        const elapsed = (player.grAnswerTime - room.grQuestionStartTime) / 1000;
        pointsEarned = Math.max(0, Math.round(q.points * (1 - elapsed / 25)));
        player.score += pointsEarned;
      }

      const entry = { socketId, name: player.name, answer: player.grAnswer, correct, pointsEarned };
      teamAnswers.push(entry);

      // For bonus: pick first correct answerer by answer time
      if (q.bonus && correct && player.grAnswerTime !== null) {
        if (!bonusWinner || player.grAnswerTime < (room.players.get(bonusWinner.socketId)?.grAnswerTime ?? Infinity)) {
          bonusWinner = entry;
        }
      }
    }

    if (q.bonus && bonusWinner) {
      room.grBonusWinnerId = bonusWinner.socketId;
      room.grPhase = 'bonus_steal';
      io.to(`room:${pin}`).emit('gr:reveal', {
        correct: q.correct,
        scores: serializeScores(room),
        teamAnswers,
        needsSteal: true,
        stealTeamName: bonusWinner.name,
        stealTeamSocketId: bonusWinner.socketId,
      });
    } else {
      room.grBonusWinnerId = null;
      io.to(`room:${pin}`).emit('gr:reveal', {
        correct: q.correct,
        scores: serializeScores(room),
        teamAnswers,
        needsSteal: false,
      });
    }
  });

  // ── gr:stealTarget ─────────────────────────────────────────────────────────
  socket.on('gr:stealTarget', ({ pin, targetSocketId }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id || room.mode !== 'goldrush') return;

    const stealerId = room.grBonusWinnerId;
    if (!stealerId || stealerId === targetSocketId) return;

    const stealer = room.players.get(stealerId);
    const target = room.players.get(targetSocketId);
    if (!stealer || !target) return;

    const amount = 50;
    stealer.score += amount;
    target.score = Math.max(0, target.score - amount);
    room.grPhase = 'reveal';
    room.grBonusWinnerId = null;

    io.to(`room:${pin}`).emit('gr:bonusSteal', {
      stealerName: stealer.name,
      targetName: target.name,
      amount,
      scores: serializeScores(room),
    });
  });

  // ── gr:backToGrid ──────────────────────────────────────────────────────────
  socket.on('gr:backToGrid', ({ pin }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id || room.mode !== 'goldrush') return;

    // Advance turn
    if (room.grTurnOrder.length > 0) {
      room.grTurnIndex = (room.grTurnIndex + 1) % room.grTurnOrder.length;
    }
    room.grCurrentCell = null;
    room.grBonusWinnerId = null;

    // Check if all questions are answered
    const allDone = room.grCategories.every((cat) => cat.questions.every((q) => q.answered));
    if (allDone) {
      room.grPhase = 'finished';
      io.to(`room:${pin}`).emit('gr:finished', { scores: serializeScores(room) });
    } else {
      room.grPhase = 'grid';
      emitGridState(io, room);
    }
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function placeBricks(categories) {
  const positions = [];
  for (let ci = 0; ci < categories.length; ci++) {
    for (let qi = 0; qi < 6; qi++) { // only regular questions (not bonus)
      positions.push(`${ci}-${qi}`);
    }
  }
  // Fisher-Yates shuffle
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const bricks = {};
  for (let i = 0; i < BRICK_TYPES.length; i++) {
    bricks[positions[i]] = BRICK_TYPES[i];
  }
  return bricks;
}

function emitGridState(io, room) {
  const currentTeamId = room.grTurnOrder.length > 0
    ? room.grTurnOrder[room.grTurnIndex % room.grTurnOrder.length]
    : null;
  const currentTeam = currentTeamId ? room.players.get(currentTeamId) : null;

  const gridData = room.grCategories.map((cat) => ({
    name: cat.name,
    color: cat.color,
    questions: cat.questions.map((q) => ({
      points: q.bonus ? null : q.points,
      bonus: q.bonus ?? false,
      answered: q.answered,
    })),
  }));

  io.to(`room:${room.pin}`).emit('gr:gridState', {
    categories: gridData,
    turnTeamName: currentTeam?.name ?? '',
    turnTeamSocketId: currentTeamId,
    scores: serializeScores(room),
  });
}

function serializeScores(room) {
  return [...room.players.entries()]
    .map(([socketId, { name, score }]) => ({ socketId, name, score }))
    .sort((a, b) => b.score - a.score);
}
