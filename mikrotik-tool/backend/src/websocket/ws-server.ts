import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WsMessage, WsMessageType } from '../../../shared/types';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

// Session → WebSocket mapping for targeted messages
const sessionClients = new Map<string, Set<WebSocket>>();

export function initWebSocket(server: Server): void {
  const wsPort = parseInt(process.env.WS_PORT || '3002');

  wss = new WebSocketServer({ port: wsPort });

  wss.on('connection', (ws: WebSocket, req) => {
    clients.add(ws);

    // Extract session from query string (?session=xxx)
    const url = new URL(req.url || '/', `http://localhost`);
    const sessionId = url.searchParams.get('session');
    if (sessionId) {
      if (!sessionClients.has(sessionId)) {
        sessionClients.set(sessionId, new Set());
      }
      sessionClients.get(sessionId)!.add(ws);
    }

    ws.on('close', () => {
      clients.delete(ws);
      if (sessionId) {
        sessionClients.get(sessionId)?.delete(ws);
      }
    });

    ws.on('error', () => {
      clients.delete(ws);
    });

    // Send welcome
    safeSend(ws, { type: 'log', payload: { message: 'WebSocket connected' }, timestamp: new Date().toISOString() });
  });

  console.log(`WebSocket server listening on port ${wsPort}`);
}

export function broadcast(type: WsMessageType, payload: unknown): void {
  const msg: WsMessage = { type, payload, timestamp: new Date().toISOString() };
  const json = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

export function broadcastToSession(sessionId: string, type: WsMessageType, payload: unknown): void {
  const msg: WsMessage = { type, payload, timestamp: new Date().toISOString() };
  const json = JSON.stringify(msg);
  const sessionWs = sessionClients.get(sessionId);
  if (sessionWs) {
    for (const ws of sessionWs) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(json);
      }
    }
  }
}

export function sendLogMessage(message: string, level: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  broadcast('log', { message, level });
}

function safeSend(ws: WebSocket, data: unknown): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  } catch { /* ignore */ }
}

export function getWss(): WebSocketServer | undefined {
  return wss;
}
