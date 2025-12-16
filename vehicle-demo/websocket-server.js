/**
 * WebSocket Server - Enhanced Version (with Heartbeat Detection)
 */

import { WebSocketServer } from 'ws';

const PORT = 9001;
const HOST = '0.0.0.0'; // Listen on all network interfaces, allow external access
const HEARTBEAT_INTERVAL = 30000; // 30-second heartbeat detection
const HEARTBEAT_TIMEOUT = 35000;  // 35-second timeout

const wss = new WebSocketServer({ 
  port: PORT,
  host: HOST  // Expose externally
});
const clients = new Map(); // Use Map to store clients and heartbeat status

console.log(`🚀 WebSocket server started on port ${PORT}`);
console.log(`🌐 Listening address: ${HOST}:${PORT}`);
console.log(`📡 External access: ws://<your-ip>:${PORT}`);

// Heartbeat detection timer
const heartbeatInterval = setInterval(() => {
  clients.forEach((clientInfo, ws) => {
    if (!clientInfo.isAlive) {
      console.log('💀 Client heartbeat timeout, force disconnect');
      ws.terminate(); // Immediately terminate connection
      clients.delete(ws);
      return;
    }

    // Mark as pending confirmation, send ping
    clientInfo.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws) => {
  console.log('✅ New client connected');
  
  // Initialize client state
  clients.set(ws, { 
    isAlive: true,
    connectedAt: new Date()
  });

  // Received pong response, mark as alive
  ws.on('pong', () => {
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      clientInfo.isAlive = true;
    }
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Received message:', data.type);

      // Broadcast to all other alive clients
      clients.forEach((clientInfo, client) => {
        if (client !== ws && client.readyState === 1 && clientInfo.isAlive) {
          client.send(message);
          console.log('📤 Forward message to client');
        }
      });
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected normally');
    clients.delete(ws);
    console.log(`📊 Current connections: ${clients.size}`);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    clients.delete(ws);
    console.log(`📊 Current connections: ${clients.size}`);
  });
});

// Graceful shutdown
wss.on('close', () => {
  clearInterval(heartbeatInterval);
  console.log('🛑 WebSocket server closed');
});

console.log('💡 Waiting for client connections...');
console.log(`⏱️  Heartbeat detection: ${HEARTBEAT_INTERVAL / 1000} second interval`);
