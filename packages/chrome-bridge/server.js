/**
 * Hermes Browser Bridge - WebSocket Server
 * 
 * This server acts as the bridge between:
 * 1. The AI agent (MiMo) — sends commands via HTTP POST
 * 2. The Chrome extension — receives commands via WebSocket
 * 
 * Flow:
 *   AI Agent → POST /action → Server → WS → Chrome Extension
 *   Chrome Extension → WS → Server → Response → AI Agent
 * 
 * Usage:
 *   node server.js
 * 
 * Then load the Chrome extension from chrome-bridge-extension/
 */

import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = 19223;
let extensionWs = null;
let messageId = 0;
const pending = new Map();

// ============================================================
// HTTP Server
// ============================================================

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      extensionConnected: extensionWs?.readyState === 1,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Execute action
  if (req.url === '/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { action, params } = JSON.parse(body);
        const result = await sendToExtension(action, params);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // List available actions
  if (req.url === '/actions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      actions: [
        'ping', 'list_tabs', 'navigate', 'get_content',
        'get_accessibility_tree', 'execute_js', 'screenshot',
        'click', 'type', 'scroll', 'back', 'forward',
        'new_tab', 'close_tab', 'switch_tab', 'create_tab_group',
        'wait', 'wait_for_selector'
      ]
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ============================================================
// WebSocket Server
// ============================================================

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('[Server] Extension connected');
  extensionWs = ws;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'hello') {
        console.log('[Server] Extension:', msg.data);
        return;
      }

      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        p.resolve(msg.error ? { error: msg.error } : msg.result);
      }
    } catch (e) {
      console.error('[Server] Parse error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[Server] Extension disconnected');
    extensionWs = null;
  });
});

// ============================================================
// Send to Extension
// ============================================================

function sendToExtension(action, params = {}) {
  return new Promise((resolve, reject) => {
    if (!extensionWs || extensionWs.readyState !== 1) {
      reject(new Error('No Chrome extension connected. Load the extension first.'));
      return;
    }

    const id = ++messageId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Action timeout (30s)'));
    }, 30000);

    pending.set(id, {
      resolve: (r) => { clearTimeout(timer); resolve(r); }
    });

    extensionWs.send(JSON.stringify({ id, action, params }));
  });
}

// ============================================================
// Start
// ============================================================

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Hermes] Browser Bridge Server running on http://127.0.0.1:${PORT}`);
  console.log(`[Hermes] WebSocket: ws://127.0.0.1:${PORT}/ws`);
  console.log(`[Hermes] API: POST http://127.0.0.1:${PORT}/action`);
  console.log(`[Hermes] Health: GET http://127.0.0.1:${PORT}/health`);
  console.log(`\n[Hermes] Waiting for Chrome extension to connect...`);
});
