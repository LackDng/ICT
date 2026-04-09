import { useLogStore } from '../store/logStore';
import { useConfigStore } from '../store/configStore';
import type { WsMessage } from '../../../shared/types';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;

export function connectWebSocket(sessionId?: string): void {
  if (ws?.readyState === WebSocket.OPEN) return;

  const wsPort = 3002;
  const host = window.location.hostname;
  const url = sessionId
    ? `ws://${host}:${wsPort}?session=${sessionId}`
    : `ws://${host}:${wsPort}`;

  useLogStore.getState().setWsStatus('connecting');

  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectDelay = 1000;
    useLogStore.getState().setWsStatus('connected');
    useLogStore.getState().addMessage({
      timestamp: new Date().toISOString(),
      message: 'WebSocket connected',
      level: 'info',
    });
  };

  ws.onmessage = (event) => {
    try {
      const msg: WsMessage = JSON.parse(event.data as string);
      handleWsMessage(msg);
    } catch { /* ignore malformed */ }
  };

  ws.onclose = () => {
    useLogStore.getState().setWsStatus('disconnected');
    scheduleReconnect(sessionId);
  };

  ws.onerror = () => {
    useLogStore.getState().setWsStatus('disconnected');
  };
}

function handleWsMessage(msg: WsMessage): void {
  const { addMessage } = useLogStore.getState();
  const { setApplyProgress } = useConfigStore.getState();

  switch (msg.type) {
    case 'log': {
      const payload = msg.payload as { message: string; level?: string };
      addMessage({
        timestamp: msg.timestamp,
        message: payload.message,
        level: (payload.level as 'info' | 'success' | 'error' | 'warning') || 'info',
      });
      break;
    }

    case 'progress': {
      const payload = msg.payload as {
        total: number;
        completed: number;
        status: 'running' | 'complete' | 'failed';
        current?: string;
      };
      setApplyProgress({
        total: payload.total,
        completed: payload.completed,
        status: payload.status,
      });
      if (payload.current) {
        addMessage({
          timestamp: msg.timestamp,
          message: `Applying: ${payload.current}`,
          level: 'info',
        });
      }
      break;
    }

    case 'command_result': {
      const payload = msg.payload as {
        result: string;
        path: string;
        action: string;
        description?: string;
      };
      addMessage({
        timestamp: msg.timestamp,
        message: `${payload.action.toUpperCase()} ${payload.path}: ${payload.result}`,
        level: payload.result === 'success' ? 'success' : 'error',
      });
      break;
    }

    case 'apply_start': {
      const payload = msg.payload as { total: number; host: string };
      addMessage({
        timestamp: msg.timestamp,
        message: `Applying ${payload.total} changes to ${payload.host}...`,
        level: 'info',
      });
      setApplyProgress({ status: 'running', total: payload.total, completed: 0 });
      break;
    }

    case 'apply_complete': {
      const payload = msg.payload as { success: number; failed: number };
      addMessage({
        timestamp: msg.timestamp,
        message: `Apply complete: ${payload.success} succeeded, ${payload.failed} failed`,
        level: payload.failed === 0 ? 'success' : 'error',
      });
      setApplyProgress({ status: payload.failed === 0 ? 'complete' : 'failed' });
      break;
    }

    case 'apply_error': {
      const payload = msg.payload as { error: string };
      addMessage({
        timestamp: msg.timestamp,
        message: `Apply error: ${payload.error}`,
        level: 'error',
      });
      setApplyProgress({ status: 'failed' });
      break;
    }
  }
}

function scheduleReconnect(sessionId?: string): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connectWebSocket(sessionId);
  }, reconnectDelay);
}

export function disconnectWebSocket(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  ws?.close();
  ws = null;
}

export function sendWsMessage(data: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
