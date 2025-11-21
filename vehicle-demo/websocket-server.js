/**
 * WebSocket服务器 - 增强版（含心跳检测）
 */

import { WebSocketServer } from 'ws';

const PORT = 8080;
const HEARTBEAT_INTERVAL = 30000; // 30秒心跳检测
const HEARTBEAT_TIMEOUT = 35000;  // 35秒超时

const wss = new WebSocketServer({ port: PORT });
const clients = new Map(); // 改用 Map 存储客户端和心跳状态

console.log(`🚀 WebSocket 服务器启动在端口 ${PORT}`);

// 心跳检测定时器
const heartbeatInterval = setInterval(() => {
  clients.forEach((clientInfo, ws) => {
    if (!clientInfo.isAlive) {
      console.log('💀 客户端心跳超时，强制断开');
      ws.terminate(); // 立即终止连接
      clients.delete(ws);
      return;
    }

    // 标记为待确认，发送 ping
    clientInfo.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws) => {
  console.log('✅ 新客户端连接');
  
  // 初始化客户端状态
  clients.set(ws, { 
    isAlive: true,
    connectedAt: new Date()
  });

  // 收到 pong 响应，标记为存活
  ws.on('pong', () => {
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      clientInfo.isAlive = true;
    }
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 收到消息:', data.type);

      // 广播给所有其他存活的客户端
      clients.forEach((clientInfo, client) => {
        if (client !== ws && client.readyState === 1 && clientInfo.isAlive) {
          client.send(message);
          console.log('📤 转发消息给客户端');
        }
      });
    } catch (error) {
      console.error('❌ 处理消息错误:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 客户端正常断开连接');
    clients.delete(ws);
    console.log(`📊 当前连接数: ${clients.size}`);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error);
    clients.delete(ws);
    console.log(`📊 当前连接数: ${clients.size}`);
  });
});

// 优雅关闭
wss.on('close', () => {
  clearInterval(heartbeatInterval);
  console.log('🛑 WebSocket 服务器关闭');
});

console.log('💡 等待客户端连接...');
console.log(`⏱️  心跳检测: ${HEARTBEAT_INTERVAL / 1000}秒间隔`);
