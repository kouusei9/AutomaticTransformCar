/**
 * 简单的WebSocket服务器
 * 用于 CityRun 和 CyberpunkCityDemo 之间的消息转发
 * 
 * 运行方式：node websocket-server.js
 */

import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const clients = new Set();

console.log(`🚀 WebSocket 服务器启动在端口 ${PORT}`);

wss.on('connection', (ws) => {
  console.log('✅ 新客户端连接');
  clients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 收到消息:', data.type);

      // 广播给所有其他客户端
      clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) { // 1 = WebSocket.OPEN
          client.send(message);
          console.log('📤 转发消息给客户端');
        }
      });
    } catch (error) {
      console.error('❌ 处理消息错误:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 客户端断开连接');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error);
    clients.delete(ws);
  });
});

console.log('💡 等待客户端连接...');
