// src/services/ws.ts
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './auth'; // ton helper pour lire le JWT

let socket: Socket | null = null;

export function connectWS() {
  if (socket?.connected) return socket;

  socket = io(import.meta.env.VITE_API_BASE as string, {
    transports: ['websocket'],
    autoConnect: true,
    auth: (cb) => {
      const token = getAccessToken?.();
      cb({ token }); // côté serveur: socket.handshake.auth.token
    },
  });

  socket.on('connect', () => {
    console.log('[WS] connected', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[WS] disconnected', reason);
  });

  // C’est l’event que tu broadcastes: wsToUser(userId, 'notify', body);
  socket.on('notify', (body: any) => {
    // body = { type, ...payload }
    const title = body?.title || 'Duumini';
    const text = body?.body || '';
    // @ts-ignore util maison Toast
    window?.duuminiToast?.({ title, message: text });

    // ICI: tu peux router selon body.type (ex: ORDER_STATUS_CHANGED), rafraîchir un store, etc.
  });

  return socket;
}

export function disconnectWS() {
  socket?.disconnect();
  socket = null;
}
