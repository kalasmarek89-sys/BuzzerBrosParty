import { io } from 'socket.io-client';

// Connect through Vite proxy (same origin) so it works in any environment.
// In production set VITE_SERVER_URL explicitly.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export const socket = io(SERVER_URL, {
  autoConnect: false,
});
