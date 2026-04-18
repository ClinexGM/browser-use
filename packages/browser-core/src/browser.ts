/**
 * @browser-use - Browser automation framework for AI agents
 * 
 * Core philosophy:
 * - Reliable browser automation using Playwright
 * - Simple APIs that abstract driver complexity
 * - Support headless and headed modes seamlessly
 * - Enable AI agents to interact with web content naturally
 * - Recording and replay capabilities
 * - Cloud deployment support
 */

import { EventEmitter } from 'events';
import { chromium, firefox, webkit, Browser as PlaywrightBrowser, Page as PlaywrightPage, BrowserContext } from 'playwright';

// Core Types
export interface BrowserConfig {
  headless?: boolean;
  browser?: 'chromium' | 'firefox' | 'webkit';
  viewport?: { width: number; height: number };
  userAgent?: string;
  slowMo?: number;
  timeout?: number;
  args?: string[];
}

export interface AgentConfig {
  model?: string;
  maxSteps?: number;
  verbose?: boolean;
  tools?: Tool[];
}

export interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

export interface BrowserState {
  url: string;
  title: string;
  screenshot?: string;
  accessibility?: AccessibilityNode;
  tabs: TabInfo[];
}

export interface AccessibilityNode {
  role: string;
  name?: string;
  value?: string;
  children?: AccessibilityNode[];
  ref?: string;
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: any;
  screenshot?: string;
}

// Browser Abstraction
export class Browser extends EventEmitter {
  private browser: PlaywrightBrowser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  private activePage: Page | null = null;
  private config: BrowserConfig;
  private recording: boolean = false;
  private actions: any[] = [];

  constructor(config: BrowserConfig = {}) {
    super();
    this.config = {
      headless: true,
      browser: 'chromium',
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
      ...config
    };
  }

  async launch(): Promise<void> {
    const browserType = {
      chromium,
      firefox,
      webkit
    }[this.config.browser!];

    this.browser = await browserType.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: this.config.args
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      ignoreHTTPSErrors: true
    });

    const page = await this.context.newPage();
    const browserPage = new Page(page, this);
    this.pages.set('main', browserPage);
    this.activePage = browserPage;

    this.emit('launched');
  }

  async newPage(): Promise<Page> {
    if (!this.context) throw new Error('Browser not launched');
    
    const page = await this.context.newPage();
    const browserPage = new Page(page, this);
    const id = `page-${Date.now()}`;
    this.pages.set(id, browserPage);
    this.activePage = browserPage;
    
    this.emit('newPage', { id, page: browserPage });
    return browserPage;
  }

  async switchToPage(id: string): Promise<Page> {
    const page = this.pages.get(id);
    if (!page) throw new Error(`Page ${id} not found`);
    this.activePage = page;
    return page;
  }

  getActivePage(): Page | null {
    return this.activePage;
  }

  getState(): BrowserState {
    const tabs: TabInfo[] = [];
    this.pages.forEach((page, id) => {
      tabs.push({
        id,
        url: page.url(),
        title: page.title(),
        active: page === this.activePage
      });
    });

    return {
      url: this.activePage?.url() || '',
      title: this.activePage?.title() || '',
      tabs
    };
  }

  startRecording(): void {
    this.recording = true;
    this.actions = [];
  }

  stopRecording(): any[] {
    this.recording = false;
    return [...this.actions];
  }

  recordAction(action: any): void {
    if (this.recording) {
      this.actions.push({
        ...action,
        timestamp: Date.now()
      });
    }
  }

  async replay(actions: any[]): Promise<void> {
    for (const action of actions) {
      await this.executeAction(action);
      if (action.delay) {
        await new Promise(r => setTimeout(r, action.delay));
      }
    }
  }

  private async executeAction(action: any): Promise<void> {
    if (!this.activePage) throw new Error('No active page');

    switch (action.type) {
      case 'navigate':
        await this.activePage.goto(action.url);
        break;
      case 'click':
        await this.activePage.click(action.selector);
        break;
      case 'type':
        await this.activePage.type(action.selector, action.text);
        break;
      case 'screenshot':
        await this.activePage.screenshot();
        break;
    }
  }

  async close(): Promise<void> {
    for (const [id, page] of this.pages) {
      await page.close();
      this.pages.delete(id);
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.emit('closed');
  }
}

// Page Abstraction
export class Page extends EventEmitter {
  private page: PlaywrightPage;
  private browser: Browser;

  constructor(page: PlaywrightPage, browser: Browser) {
    super();
    this.page = page;
    this.browser = browser;
  }

  async goto(url: string): Promise<void> {
    this.browser.recordAction({ type: 'navigate', url });
    await this.page.goto(url, { waitUntil: 'networkidle' });
    this.emit('navigated', { url });
  }

  url(): string {
    return this.page.url();
  }

  title(): Promise<string> {
    return this.page.title();
  }

  async screenshot(options?: { fullPage?: boolean }): Promise<Buffer> {
    const buffer = await this.page.screenshot({ 
      fullPage: options?.fullPage,
      type: 'png'
    });
    this.browser.recordAction({ type: 'screenshot' });
    this.emit('screenshot', { buffer });
    return buffer;
  }

  async click(selector: string): Promise<void> {
    this.browser.recordAction({ type: 'click', selector });
    await this.page.click(selector);
    this.emit('clicked', { selector });
  }

  async type(selector: string, text: string, options?: { delay?: number }): Promise<void> {
    this.browser.recordAction({ type: 'type', selector, text });
    await this.page.fill(selector, text);
    this.emit('typed', { selector, text });
  }

  async press(key: string): Promise<void> {
    this.browser.recordAction({ type: 'press', key });
    await this.page.keyboard.press(key);
  }

  async scroll(direction: 'up' | 'down', amount: number = 500): Promise<void> {
    this.browser.recordAction({ type: 'scroll', direction, amount });
    await this.page.mouse.wheel(0, direction === 'down' ? amount : -amount);
  }

  async hover(selector: string): Promise<void> {
    this.browser.recordAction({ type: 'hover', selector });
    await this.page.hover(selector);
  }

  async select(selector: string, value: string): Promise<void> {
    this.browser.recordAction({ type: 'select', selector, value });
    await this.page.selectOption(selector, value);
  }

  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
  }

  async getElements(selector: string): Promise<any[]> {
    const elements = await this.page.$$(selector);
    return Promise.all(elements.map(async (el) => ({
      text: await el.textContent(),
      tag: await el.evaluate(e => e.tagName),
      href: await el.getAttribute('href'),
      visible: await el.isVisible()
    })));
  }

  async getText(selector?: string): Promise<string> {
    if (selector) {
      return this.page.textContent(selector) || '';
    }
    return this.page.evaluate(() => document.body.innerText);
  }

  async evaluate(fn: Function, ...args: any[]): Promise<any> {
    return this.page.evaluate(fn, ...args);
  }

  async getAccessibilityTree(): Promise<AccessibilityNode> {
    return this.page.evaluate(() => {
      function generateNode(element: Element, depth: number = 0): any {
        if (depth > 10) return null;
        
        const node: any = {
          role: element.getAttribute('role') || element.tagName.toLowerCase(),
          name: element.getAttribute('aria-label') || 
                element.getAttribute('name') ||
                element.getAttribute('placeholder') ||
                element.getAttribute('title')
        };

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          node.value = element.value;
        }

        const children: any[] = [];
        for (const child of element.children) {
          const childNode = generateNode(child, depth + 1);
          if (childNode) children.push(childNode);
        }
        if (children.length > 0) {
          node.children = children;
        }

        return node;
      }

      return generateNode(document.body);
    });
  }

  async fillForm(fields: Record<string, string>): Promise<void> {
    for (const [selector, value] of Object.entries(fields)) {
      await this.page.fill(selector, value);
    }
    this.browser.recordAction({ type: 'fillForm', fields });
  }

  async submitForm(selector?: string): Promise<void> {
    if (selector) {
      await this.page.click(`${selector} [type="submit"]`);
    } else {
      await this.page.click('[type="submit"]');
    }
    this.browser.recordAction({ type: 'submitForm', selector });
  }

  async close(): Promise<void> {
    await this.page.close();
    this.emit('closed');
  }
}

// AI Agent Integration
export class BrowserAgent {
  private browser: Browser;
  private config: AgentConfig;
  private history: any[] = [];
  private tools: Tool[] = [];

  constructor(config: AgentConfig = {}) {
    this.config = {
      maxSteps: 30,
      verbose: false,
      ...config
    };
    this.browser = new Browser();
    this.tools = this.registerDefaultTools();
  }

  private registerDefaultTools(): Tool[] {
    return [
      {
        name: 'goto',
        description: 'Navigate to a URL',
        parameters: { url: { type: 'string', description: 'The URL to navigate to' } },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          await page.goto(params.url);
          return { success: true, url: params.url };
        }
      },
      {
        name: 'click',
        description: 'Click on an element',
        parameters: { selector: { type: 'string', description: 'CSS selector or text' } },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          await page.click(params.selector);
          return { success: true };
        }
      },
      {
        name: 'type',
        description: 'Type text into an input field',
        parameters: {
          selector: { type: 'string', description: 'Input selector' },
          text: { type: 'string', description: 'Text to type' }
        },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          await page.type(params.selector, params.text);
          return { success: true };
        }
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot of the current page',
        parameters: {
          fullPage: { type: 'boolean', description: 'Capture full page', default: false }
        },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          const buffer = await page.screenshot({ fullPage: params.fullPage });
          return { success: true, screenshot: buffer.toString('base64') };
        }
      },
      {
        name: 'get_text',
        description: 'Get text content from the page or element',
        parameters: {
          selector: { type: 'string', description: 'Optional selector', required: false }
        },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          const text = await page.getText(params.selector);
          return { success: true, text };
        }
      },
      {
        name: 'scroll',
        description: 'Scroll the page',
        parameters: {
          direction: { type: 'string', enum: ['up', 'down'] },
          amount: { type: 'number', default: 500 }
        },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          await page.scroll(params.direction, params.amount);
          return { success: true };
        }
      },
      {
        name: 'wait',
        description: 'Wait for a selector to appear',
        parameters: {
          selector: { type: 'string', description: 'Selector to wait for' },
          timeout: { type: 'number', default: 10000 }
        },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          await page.waitForSelector(params.selector, params.timeout);
          return { success: true };
        }
      },
      {
        name: 'get_elements',
        description: 'Get list of elements matching selector',
        parameters: { selector: { type: 'string', description: 'CSS selector' } },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          const elements = await page.getElements(params.selector);
          return { success: true, elements };
        }
      },
      {
        name: 'fill_form',
        description: 'Fill multiple form fields at once',
        parameters: {
          fields: { type: 'object', description: 'Selector-value pairs' }
        },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          await page.fillForm(params.fields);
          return { success: true };
        }
      },
      {
        name: 'evaluate',
        description: 'Execute JavaScript in the page context',
        parameters: {
          expression: { type: 'string', description: 'JavaScript expression' }
        },
        execute: async (params) => {
          const page = this.browser.getActivePage();
          if (!page) throw new Error('No active page');
          const result = await page.evaluate(eval(`(${params.expression})`));
          return { success: true, result };
        }
      }
    ];
  }

  async run(task: string): Promise<any> {
    await this.browser.launch();
    this.history = [];

    if (this.config.verbose) {
      console.log(`Starting task: ${task}`);
    }

    const state = this.browser.getState();

    return {
      task,
      tools: this.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      })),
      state
    };
  }

  async step(action: string, params: any): Promise<ActionResult> {
    const tool = this.tools.find(t => t.name === action);
    if (!tool) {
      return { success: false, message: `Unknown action: ${action}` };
    }

    try {
      const result = await tool.execute(params);
      this.history.push({ action, params, result });

      if (this.config.verbose) {
        console.log(`Executed: ${action}`, params);
      }

      const page = this.browser.getActivePage();
      const screenshot = page ? await page.screenshot() : undefined;

      return {
        ...result,
        screenshot: screenshot?.toString('base64')
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  getHistory(): any[] {
    return [...this.history];
  }

  async stop(): Promise<void> {
    await this.browser.close();
  }
}

// Cloud Browser Provider
export class CloudBrowserProvider {
  private apiKey: string;
  private endpoint: string;

  constructor(config: { apiKey: string; endpoint?: string }) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || 'https://api.browser-use.dev';
  }

  async createSession(options?: BrowserConfig): Promise<{ sessionId: string; wsUrl: string }> {
    const response = await fetch(`${this.endpoint}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    return response.json() as Promise<{ sessionId: string; wsUrl: string }>;
  }

  async destroySession(sessionId: string): Promise<void> {
    await fetch(`${this.endpoint}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  async listSessions(): Promise<any[]> {
    const response = await fetch(`${this.endpoint}/sessions`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    return response.json() as Promise<any[]>;
  }
}
