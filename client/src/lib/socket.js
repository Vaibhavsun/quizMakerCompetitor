import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let current = null;

export function connectSocket({ userId, roomId }) {
  if (current) {
    current.disconnect();
    current = null;
  }

  current = io(SOCKET_URL, {
    query: { userId, ...(roomId ? { roomId } : {}) },
    transports: ["websocket"],
    autoConnect: true,
  });

  return current;
}

export function getSocket() {
  return current;
}

export function disconnectSocket() {
  if (current) {
    current.disconnect();
    current = null;
  }
}
