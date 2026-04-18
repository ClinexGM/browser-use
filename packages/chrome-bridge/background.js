/**
 * Hermes Browser Bridge - Chrome Extension
 * 
 * Architecture (learned from Claude's extension):
 * - Extension connects OUT to a local WebSocket server
 * - Server receives commands from the AI agent
 * - Server forwards commands to the extension via WebSocket
 * - Extension executes commands using chrome.scripting API
 * - Results flow back through WebSocket
 * 
 * The key insight: Chrome extensions can't be servers (no listening ports).
 * But they CAN connect OUT to a WebSocket server on localhost.
 * So the extension is a WebSocket CLIENT, not a server.
 * 
 * Usage:
 *   1. Run: node server.js (starts WS server on localhost:19223)
 *   2. Load this extension in Chrome
 *   3. Extension auto-connects to ws://127.0.0.1:19223
 *   4. AI agent sends commands through the server
 */

const SERVER_URL = 'ws://127.0.0.1:19223/ws';

let ws = null;
let reconnectTimer = null;
const RESPONSE_TIMEOUT = 30000;

function log(...args) {
  console.log('[Hermes]', ...args);
}

// ============================================================
// WebSocket Connection
// ============================================================

function connect() {
  try {
    ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
      log('Connected to local server');
      // Identify ourselves
      send({ type: 'hello', data: { name: 'hermes-bridge', version: '1.0.0' } });
    };

    ws.onmessage = async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      // Handle incoming commands
      const { id, action, params } = msg;

      try {
        const result = await executeAction(action, params || {});
        send({ id, result });
      } catch (err) {
        send({ id, error: err.message });
      }
    };

    ws.onclose = () => {
      log('Disconnected, reconnecting in 3s...');
      ws = null;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      // Don't log full errors, just reconnect
      ws = null;
    };
  } catch (e) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
  }
}

function send(data) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// ============================================================
// Action Execution (inspired by Claude's extension)
// ============================================================

async function executeAction(action, params) {
  switch (action) {
    case 'ping':
      return { ok: true, timestamp: Date.now() };

    case 'list_tabs': {
      const tabs = await chrome.tabs.query({});
      return tabs.map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        active: t.active,
        windowId: t.windowId
      }));
    }

    case 'navigate': {
      const tabId = params.tabId;
      if (tabId) {
        await chrome.tabs.update(tabId, { url: params.url });
      } else {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.update(tab.id, { url: params.url });
      }
      // Wait for load
      await waitForTabLoad(tabId);
      const tab = await chrome.tabs.get(tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
      return { ok: true, url: tab.url, title: tab.title };
    }

    case 'get_content': {
      const tabId = params.tabId || (await getActiveTabId());
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          title: document.title,
          url: window.location.href,
          text: (document.body?.innerText || '').substring(0, 80000),
          links: Array.from(document.querySelectorAll('a[href]')).slice(0, 200).map(a => ({
            text: (a.textContent || '').trim().substring(0, 200),
            href: a.href
          })),
          forms: Array.from(document.querySelectorAll('form')).map(f => ({
            action: f.action,
            method: f.method,
            inputs: Array.from(f.querySelectorAll('input, select, textarea')).map(i => ({
              name: i.name,
              type: i.type,
              id: i.id,
              placeholder: i.placeholder,
              value: i.value
            }))
          }))
        })
      });
      return results[0]?.result;
    }

    case 'get_accessibility_tree': {
      // Generate accessibility tree (like Claude's extension does)
      const tabId = params.tabId || (await getActiveTabId());
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: generateAccessibilityTree
      });
      return results[0]?.result;
    }

    case 'execute_js': {
      const tabId = params.tabId || (await getActiveTabId());
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: new Function(params.code)
      });
      return results[0]?.result;
    }

    case 'screenshot': {
      const tabId = params.tabId || (await getActiveTabId());
      const tab = await chrome.tabs.get(tabId);
      // Ensure tab is visible for screenshot
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      await sleep(500);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      return { screenshot: dataUrl };
    }

    case 'click': {
      const tabId = params.tabId || (await getActiveTabId());
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector) => {
          let el;
          // Try CSS selector
          try { el = document.querySelector(selector); } catch {}
          // Try XPath
          if (!el) {
            try {
              const xpath = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              el = xpath.singleNodeValue;
            } catch {}
          }
          // Try text content match
          if (!el) {
            const allElements = document.querySelectorAll('button, a, input, [role="button"], [onclick]');
            el = Array.from(allElements).find(e => 
              (e.textContent || '').trim().includes(selector) ||
              e.getAttribute('aria-label')?.includes(selector)
            );
          }
          if (!el) throw new Error(`Element not found: ${selector}`);
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          el.click();
          return { ok: true, text: (el.textContent || '').substring(0, 100) };
        },
        args: [params.selector]
      });
      return results[0]?.result;
    }

    case 'type': {
      const tabId = params.tabId || (await getActiveTabId());
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector, text, clear) => {
          const el = document.querySelector(selector);
          if (!el) throw new Error(`Element not found: ${selector}`);
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          el.focus();
          if (clear) {
            // Clear using native setter for React compatibility
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, 'value'
            )?.set || Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 'value'
            )?.set;
            if (nativeSetter) nativeSetter.call(el, '');
            else el.value = '';
          }
          // Set value
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set;
          if (nativeSetter) nativeSetter.call(el, clear ? text : el.value + text);
          else el.value = clear ? text : el.value + text;
          // Trigger events
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { ok: true };
        },
        args: [params.selector, params.text, params.clear !== false]
      });
      return results[0]?.result;
    }

    case 'scroll': {
      const tabId = params.tabId || (await getActiveTabId());
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (dir, amt) => {
          const y = dir === 'up' ? -amt : amt;
          window.scrollBy(0, y);
          return { scrollY: window.scrollY, scrollX: window.scrollX };
        },
        args: [params.direction || 'down', params.amount || 500]
      });
      return results[0]?.result;
    }

    case 'back': {
      const tabId = params.tabId || (await getActiveTabId());
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => history.back()
      });
      await sleep(1000);
      const tab = await chrome.tabs.get(tabId);
      return { ok: true, url: tab.url };
    }

    case 'forward': {
      const tabId = params.tabId || (await getActiveTabId());
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => history.forward()
      });
      await sleep(1000);
      const tab = await chrome.tabs.get(tabId);
      return { ok: true, url: tab.url };
    }

    case 'new_tab': {
      const tab = await chrome.tabs.create({ url: params.url || 'about:blank' });
      await waitForTabLoad(tab.id);
      return { id: tab.id, url: tab.url };
    }

    case 'close_tab': {
      await chrome.tabs.remove(params.tabId);
      return { ok: true };
    }

    case 'switch_tab': {
      const tabId = params.tabId;
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      return { id: tab.id, url: tab.url, title: tab.title };
    }

    case 'create_tab_group': {
      const groupId = await chrome.tabs.group({
        tabIds: params.tabIds
      });
      await chrome.tabGroups.update(groupId, {
        title: params.title || 'Hermes Task',
        color: 'blue'
      });
      return { groupId };
    }

    case 'wait': {
      await sleep(params.ms || 1000);
      return { ok: true };
    }

    case 'wait_for_selector': {
      const tabId = params.tabId || (await getActiveTabId());
      const timeout = params.timeout || 10000;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => !!document.querySelector(sel),
          args: [params.selector]
        });
        if (results[0]?.result) return { ok: true, selector: params.selector };
        await sleep(500);
      }
      throw new Error(`Timeout waiting for: ${params.selector}`);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ============================================================
// Helpers
// ============================================================

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  return tab.id;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    if (!tabId) { resolve(); return; }
    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 15000); // Timeout fallback
  });
}

// Generate accessibility tree (like Claude's content script)
function generateAccessibilityTree() {
  const elementMap = {};
  let refCounter = 0;

  function getRole(el) {
    const role = el.getAttribute('role');
    if (role) return role;
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type');
    const roles = {
      a: 'link', button: 'button', select: 'combobox',
      textarea: 'textbox', h1: 'heading', h2: 'heading',
      h3: 'heading', img: 'image', nav: 'navigation',
      main: 'main', form: 'form', table: 'table',
      ul: 'list', ol: 'list', li: 'listitem',
    };
    if (tag === 'input') {
      const inputRoles = {
        submit: 'button', button: 'button', checkbox: 'checkbox',
        radio: 'radio', file: 'button', image: 'button',
      };
      return inputRoles[type] || 'textbox';
    }
    return roles[tag] || 'generic';
  }

  function getName(el) {
    return el.getAttribute('aria-label') ||
           el.getAttribute('name') ||
           el.getAttribute('placeholder') ||
           el.getAttribute('title') ||
           el.getAttribute('alt') ||
           (el.labels?.[0]?.textContent?.trim()) ||
           el.textContent?.trim().substring(0, 100) ||
           '';
  }

  function isInteractive(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    return ['a', 'button', 'input', 'select', 'textarea'].includes(tag) ||
           ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(role || '') ||
           el.hasAttribute('onclick') ||
           el.hasAttribute('tabindex');
  }

  function buildTree(el, depth = 0) {
    if (depth > 15) return null;
    if (el.nodeType !== 1) return null; // Element nodes only
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') return null;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed' && !isInteractive(el)) return null;

    const ref = `ref_${++refCounter}`;
    const role = getRole(el);
    const name = getName(el);
    const interactive = isInteractive(el);

    const node = { ref, role, name, interactive };

    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      node.value = el.value;
    }

    elementMap[ref] = el;

    const children = [];
    for (const child of el.children) {
      const childNode = buildTree(child, depth + 1);
      if (childNode) children.push(childNode);
    }
    if (children.length > 0) {
      node.children = children;
    }

    return node;
  }

  return buildTree(document.body);
}

// ============================================================
// Init
// ============================================================

connect();
log('Service worker started');
