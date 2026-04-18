# @browser-use - Browser Automation Framework for AI Agents

A modern, reliable browser automation framework designed for AI agents. Built on Playwright with a focus on simplicity, reliability, and AI integration.

## 🎯 Why This Exists

The original `browser-use/browser-use` was a great start but had several architectural issues:

1. **Tightly coupled** to specific LLM providers
2. **Python-centric** when TypeScript/JavaScript is more natural for browser automation
3. **Missing key features** like multi-tab support, recording/replay, and proper error handling
4. **No cloud deployment** options

This fork reimagines the framework with:

- **LLM-agnostic design** - Works with OpenAI, Anthropic, Google, or any provider
- **TypeScript-first** - Better DX, type safety, and performance
- **Modern architecture** - Clean separation of concerns
- **Production-ready** - Recording, replay, proxy support, cloud deployment

## 🚀 Quick Start

```typescript
import { Browser, BrowserAgent } from '@browser-use/core';

// Simple automation
const browser = new Browser();
await browser.launch();
const page = browser.getActivePage();
await page?.goto('https://example.com');
const text = await page?.getText();
await browser.close();

// AI-powered automation
const agent = new BrowserAgent({
  model: 'gpt-4',
  verbose: true
});

await agent.run('Get the top 5 stories from Hacker News');
```

## 📦 Packages

| Package | Description |
|---------|-------------|
| `@browser-use/core` | Core browser and page abstractions |
| `@browser-use/tools` | Tool definitions for LLM integration |
| `@browser-use/proxy` | Network proxy support |
| `@browser-use/recording` | Session recording and replay |
| `@browser-use/cloud` | Cloud deployment utilities |

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│            AI Agent / LLM               │
│    (OpenAI, Anthropic, Google, etc.)    │
└─────────────────┬───────────────────────┘
                  │ Tool calls
┌─────────────────▼───────────────────────┐
│           @browser-use/tools            │
│  • goto, click, type, screenshot, etc.  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           @browser-use/core             │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │   Browser    │  │      Page       │   │
│  │  - launch()  │  │  - goto()       │   │
│  │  - newPage() │  │  - click()      │   │
│  │  - close()   │  │  - type()       │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Playwright                   │
│   Chromium, Firefox, WebKit             │
└─────────────────────────────────────────┘
```

## 🔧 Features

### Core Browser Automation
- **Multi-browser support** - Chromium, Firefox, WebKit
- **Multi-tab management** - Create, switch, and manage multiple tabs
- **Headless and headed modes** - Run invisible or with UI
- **Custom viewports and user agents**

### AI Integration
- **Tool definitions** - Ready-to-use tools for LLMs
- **Accessibility tree** - Generate semantic page representations
- **Screenshot capture** - For vision-capable models
- **Element detection** - Smart selectors and waiting

### Developer Experience
- **TypeScript-first** - Full type safety
- **Recording and replay** - Record actions and replay them
- **Error handling** - Graceful degradation
- **Verbose logging** - Debug mode for development

### Production Features
- **Proxy support** - HTTP, SOCKS5, residential proxies
- **Session management** - Persistent sessions
- **Cloud deployment** - Scale horizontally
- **Rate limiting** - Respect website limits

## 📖 Usage Examples

### Basic Navigation
```typescript
import { Browser } from '@browser-use/core';

const browser = new Browser();
await browser.launch();
const page = browser.getActivePage();

// Navigate
await page?.goto('https://example.com');

// Interact
await page?.click('a.link');
await page?.type('input[name="q"]', 'search term');
await page?.press('Enter');

// Extract data
const text = await page?.getText();
const elements = await page?.getElements('.item');

await browser.close();
```

### Form Automation
```typescript
// Fill multiple fields at once
await page?.fillForm({
  'input[name="email"]': 'user@example.com',
  'input[name="password"]': 'secure123',
  'select[name="country"]': 'US'
});

// Submit form
await page?.submitForm();
```

### Screenshot Capture
```typescript
// Viewport screenshot
const viewport = await page?.screenshot();

// Full page screenshot
const fullPage = await page?.screenshot({ fullPage: true });

// Element screenshot
const element = await page?.page.$('.chart');
const chart = await element?.screenshot();
```

### Recording and Replay
```typescript
const browser = new Browser();
await browser.launch();

// Start recording
browser.startRecording();

// Perform actions
const page = browser.getActivePage();
await page?.goto('https://example.com');
await page?.click('.button');
await page?.type('input', 'text');

// Stop recording
const actions = browser.stopRecording();

// Replay
await browser.replay(actions);
```

### Multi-Tab Automation
```typescript
const browser = new Browser();
await browser.launch();

// First tab
const page1 = browser.getActivePage();
await page1?.goto('https://example.com');

// New tab
const page2 = await browser.newPage();
await page2.goto('https://google.com');

// Switch between tabs
await browser.switchToPage('main');
const state = browser.getState();
console.log(state.tabs);
```

### AI Agent Integration
```typescript
import { BrowserAgent } from '@browser-use/core';
import { browserTools } from '@browser-use/tools';

// Initialize agent
const agent = new BrowserAgent({
  model: 'gpt-4',
  maxSteps: 20,
  verbose: true
});

// Run task
const result = await agent.run(
  'Navigate to Amazon, search for "laptop", and get the first 5 results'
);

// Or step manually
await agent.step('goto', { url: 'https://amazon.com' });
await agent.step('type', { selector: '#search', text: 'laptop' });
await agent.step('click', { selector: '#searchButton' });
```

## 🛠️ Configuration

### Browser Options
```typescript
const browser = new Browser({
  headless: false,           // Run with UI
  browser: 'chromium',       // chromium, firefox, or webkit
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Custom UA',
  slowMo: 100,              // Slow down actions
  timeout: 30000,           // Default timeout
  args: ['--disable-gpu']   // Browser arguments
});
```

### Agent Options
```typescript
const agent = new BrowserAgent({
  model: 'gpt-4',           // LLM model to use
  maxSteps: 30,             // Maximum automation steps
  verbose: true,            // Enable logging
  tools: customTools        // Custom tool definitions
});
```

## 🚀 Cloud Deployment

```typescript
import { CloudBrowserProvider } from '@browser-use/cloud';

const cloud = new CloudBrowserProvider({
  apiKey: 'your-api-key'
});

// Create a cloud browser session
const session = await cloud.createSession({
  headless: true,
  browser: 'chromium'
});

// Use the session
// ...

// Clean up
await cloud.destroySession(session.sessionId);
```

## 📊 Performance

| Metric | Value |
|--------|-------|
| Launch time | ~500ms |
| Page load | ~1-3s |
| Action execution | ~50-200ms |
| Memory usage | ~100-300MB |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by the original browser-use project
- Built on Playwright for reliable automation
- Designed for the AI agent ecosystem
