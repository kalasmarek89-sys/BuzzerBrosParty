// In-memory store for all active rooms
// room shape:
// {
//   pin: string,
//   hostSocketId: string,
//   players: Map<socketId, { name: string, score: number }>,
//   questions: Array<{ text, answers: [], correct: number, imageUrl?, youtubeUrl? }>,
//   currentQuestion: number | null,
//   phase: 'lobby' | 'question' | 'reveal' | 'scoreboard' | 'finished'
// }

const rooms = new Map(); // pin -> room

export function createRoom(pin, hostSocketId, mode = 'classic') {
  const room = {
    pin,
    hostSocketId,
    players: new Map(),
    questions: [],
    currentQuestion: null,
    phase: 'lobby',
    mode,
    // GoldRush fields (only used when mode === 'goldrush')
    grCategories: null,
    grBricks: {},
    grTurnOrder: [],
    grTurnIndex: 0,
    grCurrentCell: null,
    grQuestionStartTime: null,
    grPhase: 'lobby',
    grBonusWinnerId: null,
  };
  rooms.set(pin, room);
  return room;
}

export function getRoom(pin) {
  return rooms.get(pin);
}

export function deleteRoom(pin) {
  rooms.delete(pin);
}

export function getRoomByHost(socketId) {
  for (const room of rooms.values()) {
    if (room.hostSocketId === socketId) return room;
  }
  return null;
}

export function getRoomByPlayer(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}
