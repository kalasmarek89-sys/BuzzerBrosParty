import {
  createRoom,
  getRoom,
  deleteRoom,
  getRoomByHost,
  getRoomByPlayer,
} from '../gameState.js';

export function registerHandlers(io, socket) {
  // ── HOST: create room ──────────────────────────────────────────────────────
  socket.on('host:create', ({ pin }) => {
    if (!pin || pin.length < 3) {
      return socket.emit('error', { message: 'PIN musí mít alespoň 3 znaky.' });
    }
    if (getRoom(pin)) {
      return socket.emit('error', { message: 'Místnost s tímto PINem již existuje.' });
    }
    const room = createRoom(pin, socket.id);
    socket.join(`room:${pin}`);
    socket.emit('host:created', { pin });
    console.log(`[host:create] PIN=${pin}`);
  });

  // ── HOST: update questions ─────────────────────────────────────────────────
  socket.on('host:setQuestions', ({ pin, questions }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.questions = questions;
    socket.emit('host:questionsSet', { count: questions.length });
  });

  // ── HOST: start game ───────────────────────────────────────────────────────
  socket.on('host:startGame', ({ pin }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'question';
    room.currentQuestion = 0;
    io.to(`room:${pin}`).emit('game:started', { total: room.questions.length });
    emitQuestion(io, room);
  });

  // ── HOST: next question ────────────────────────────────────────────────────
  socket.on('host:nextQuestion', ({ pin }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.currentQuestion += 1;
    if (room.currentQuestion >= room.questions.length) {
      room.phase = 'finished';
      io.to(`room:${pin}`).emit('game:finished', { scores: serializeScores(room) });
    } else {
      room.phase = 'question';
      emitQuestion(io, room);
    }
  });

  // ── HOST: reveal answer ────────────────────────────────────────────────────
  socket.on('host:reveal', ({ pin }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'reveal';
    const q = room.questions[room.currentQuestion];
    io.to(`room:${pin}`).emit('game:reveal', {
      correct: q.correct,
      scores: serializeScores(room),
    });
  });

  // ── PLAYER: join room ──────────────────────────────────────────────────────
  socket.on('player:join', ({ pin, name }) => {
    const room = getRoom(pin);
    if (!room) {
      return socket.emit('error', { message: 'Místnost nenalezena. Zkontroluj PIN.' });
    }
    if (room.phase !== 'lobby') {
      return socket.emit('error', { message: 'Hra již probíhá.' });
    }
    room.players.set(socket.id, { name, score: 0, answer: null });
    socket.join(`room:${pin}`);
    socket.emit('player:joined', { pin, name });
    // notify host
    io.to(room.hostSocketId).emit('host:playerJoined', {
      players: serializePlayers(room),
    });
    console.log(`[player:join] ${name} → PIN=${pin}`);
  });

  // ── PLAYER: submit answer ──────────────────────────────────────────────────
  socket.on('player:answer', ({ pin, answer }) => {
    const room = getRoom(pin);
    if (!room || room.phase !== 'question') return;
    const player = room.players.get(socket.id);
    if (!player || player.answer !== null) return; // already answered

    const q = room.questions[room.currentQuestion];
    player.answer = answer;
    if (answer === q.correct) {
      player.score += 100;
    }

    socket.emit('player:answerAck', { answer });
    // notify host of updated answer count
    const answered = [...room.players.values()].filter((p) => p.answer !== null).length;
    io.to(room.hostSocketId).emit('host:answerUpdate', {
      answered,
      total: room.players.size,
    });
  });

  // ── DISCONNECT ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    // host disconnected → close room
    const hostedRoom = getRoomByHost(socket.id);
    if (hostedRoom) {
      io.to(`room:${hostedRoom.pin}`).emit('game:hostLeft');
      deleteRoom(hostedRoom.pin);
      console.log(`[disconnect] Host left, room PIN=${hostedRoom.pin} deleted`);
      return;
    }
    // player disconnected
    const playerRoom = getRoomByPlayer(socket.id);
    if (playerRoom) {
      const player = playerRoom.players.get(socket.id);
      playerRoom.players.delete(socket.id);
      io.to(playerRoom.hostSocketId).emit('host:playerLeft', {
        players: serializePlayers(playerRoom),
      });
      console.log(`[disconnect] Player ${player?.name} left PIN=${playerRoom.pin}`);
    }
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function emitQuestion(io, room) {
  const q = room.questions[room.currentQuestion];
  // reset answers
  for (const p of room.players.values()) p.answer = null;

  const payload = {
    index: room.currentQuestion,
    total: room.questions.length,
    text: q.text,
    answers: q.answers,
    imageUrl: q.imageUrl ?? null,
    youtubeUrl: q.youtubeUrl ?? null,
    timeLimit: q.timeLimit ?? 30,
  };
  io.to(`room:${room.pin}`).emit('game:question', payload);
}

function serializeScores(room) {
  return [...room.players.values()]
    .map(({ name, score }) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

function serializePlayers(room) {
  return [...room.players.values()].map(({ name, score }) => ({ name, score }));
}
