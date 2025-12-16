/**
 * SSE Server - Server-Sent Events with HTTP POST (Browser Compatible)
 */

import http from 'http';
import { parse } from 'url';

const PORT = 9001;
const HOST = '0.0.0.0';
const HEARTBEAT_INTERVAL = 30000; // 30-second heartbeat
const CLIENT_TIMEOUT = 60000; // 60-second timeout

const clients = new Map(); // Store SSE connections

console.log(`🚀 SSE Server starting on port ${PORT}`);
console.log(`🌐 Listening address: ${HOST}:${PORT}`);
console.log(`📡 External access: http://<your-ip>:${PORT}`);

// Heartbeat timer - send keep-alive comments
const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  clients.forEach((clientInfo, res) => {
    if (now - clientInfo.lastActivity > CLIENT_TIMEOUT) {
      console.log('💀 Client timeout, closing connection');
      res.end();
      clients.delete(res);
      return;
    }

    // Send heartbeat comment
    try {
      res.write(': heartbeat\n\n');
      clientInfo.lastActivity = now;
    } catch (error) {
      console.error('❌ Heartbeat failed:', error.message);
      clients.delete(res);
    }
  });
}, HEARTBEAT_INTERVAL);

// Broadcast message to all clients
function broadcastMessage(message, excludeRes = null) {
  const messageStr = JSON.stringify(message);
  let successCount = 0;
  
  clients.forEach((clientInfo, res) => {
    if (res !== excludeRes) {
      try {
        res.write(`data: ${messageStr}\n\n`);
        clientInfo.lastActivity = Date.now();
        successCount++;
      } catch (error) {
        console.error('❌ Broadcast failed:', error.message);
        clients.delete(res);
      }
    }
  });
  
  if (successCount > 0) {
    console.log(`📤 Broadcasted to ${successCount} client(s)`);
  }
}

// HTTP Server
const server = http.createServer((req, res) => {
  const { pathname } = parse(req.url || '', true);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // SSE Endpoint: /events
  if (pathname === '/events' && req.method === 'GET') {
    console.log('✅ New SSE client connected');

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Store client
    clients.set(res, {
      connectedAt: new Date(),
      lastActivity: Date.now()
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      console.log('🔌 SSE client disconnected');
      clients.delete(res);
      console.log(`📊 Current connections: ${clients.size}`);
    });

    return;
  }

  // Message Endpoint: POST /message
  if (pathname === '/message' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const message = JSON.parse(body);
        console.log('📨 Received message:', message.type);

        // Broadcast to all SSE clients
        broadcastMessage(message);

        // Send success response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clients: clients.size }));
      } catch (error) {
        console.error('❌ Error processing message:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    return;
  }

  // Health check endpoint
  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      clients: clients.size,
      uptime: process.uptime()
    }));
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log('💡 SSE Server ready');
  console.log(`📍 SSE Endpoint: http://${HOST}:${PORT}/events`);
  console.log(`📍 POST Endpoint: http://${HOST}:${PORT}/message`);
  console.log(`⏱️  Heartbeat interval: ${HEARTBEAT_INTERVAL / 1000}s`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down SSE server...');
  clearInterval(heartbeatInterval);
  clients.forEach((_, res) => res.end());
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
