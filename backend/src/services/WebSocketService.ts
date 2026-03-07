import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export class WebSocketService {
  private static wss: WebSocketServer | null = null;
  private static clients: Set<WebSocket> = new Set();

  static initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection');
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial connection success message
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
    });

    console.log('WebSocket server initialized');
  }

  static broadcast(type: string, data: any): void {
    if (!this.wss) return;

    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  static sendToClient(client: WebSocket, type: string, data: any): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    }
  }
}
