/**
 * Tool definitions for AI agent integration
 * These tools map to Playwright actions that AI agents can execute
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: any;
      required?: boolean;
    }>;
    required?: string[];
  };
  execute: (params: any) => Promise<any>;
}

export const browserTools: ToolDefinition[] = [
  {
    name: 'goto',
    description: 'Navigate the browser to a URL',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to',
          required: true
        }
      },
      required: ['url']
    },
    execute: async ({ browser, url }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      await page.goto(url);
      return { success: true, url: page.url(), title: await page.title() };
    }
  },
  {
    name: 'click',
    description: 'Click on an element on the page',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or text content to click',
          required: true
        }
      },
      required: ['selector']
    },
    execute: async ({ browser, selector }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      // Try CSS selector first, then text content
      try {
        await page.click(selector);
      } catch {
        // If selector fails, try clicking by text
        const element = await page.getElements(`text=${selector}`);
        if (element.length > 0) {
          await page.click(`text=${selector}`);
        } else {
          throw new Error(`Could not find element: ${selector}`);
        }
      }
      
      return { success: true };
    }
  },
  {
    name: 'type',
    description: 'Type text into an input field',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the input field',
          required: true
        },
        text: {
          type: 'string',
          description: 'Text to type',
          required: true
        },
        delay: {
          type: 'number',
          description: 'Delay between keystrokes in milliseconds',
          default: 0
        }
      },
      required: ['selector', 'text']
    },
    execute: async ({ browser, selector, text, delay = 0 }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      // Clear existing content first
      await page.click(selector);
      await page.press('Control+a');
      await page.press('Backspace');
      
      // Type new text
      await page.type(selector, text, { delay });
      
      return { success: true, text };
    }
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current page',
    parameters: {
      type: 'object',
      properties: {
        fullPage: {
          type: 'boolean',
          description: 'Capture full page (not just viewport)',
          default: false
        },
        selector: {
          type: 'string',
          description: 'Optional: capture only specific element',
          required: false
        }
      }
    },
    execute: async ({ browser, fullPage = false, selector }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      if (selector) {
        const element = await page.page.$(selector);
        if (!element) throw new Error(`Element not found: ${selector}`);
        const buffer = await element.screenshot({ type: 'png' });
        return { success: true, screenshot: buffer.toString('base64') };
      }
      
      const buffer = await page.screenshot({ fullPage });
      return { success: true, screenshot: buffer.toString('base64') };
    }
  },
  {
    name: 'get_text',
    description: 'Get text content from the page or specific element',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Optional CSS selector. If omitted, gets text from body',
          required: false
        }
      }
    },
    execute: async ({ browser, selector }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      const text = await page.getText(selector);
      return { success: true, text };
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page up or down',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          description: 'Scroll direction',
          enum: ['up', 'down'],
          required: true
        },
        amount: {
          type: 'number',
          description: 'Scroll amount in pixels',
          default: 500
        }
      },
      required: ['direction']
    },
    execute: async ({ browser, direction, amount = 500 }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      await page.scroll(direction, amount);
      return { success: true, scrolled: direction, amount };
    }
  },
  {
    name: 'wait',
    description: 'Wait for an element to appear or for a specified time',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to wait for',
          required: false
        },
        time: {
          type: 'number',
          description: 'Time to wait in milliseconds',
          default: 1000
        },
        timeout: {
          type: 'number',
          description: 'Maximum wait time for selector',
          default: 10000
        }
      }
    },
    execute: async ({ browser, selector, time = 1000, timeout = 10000 }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      if (selector) {
        await page.waitForSelector(selector, timeout);
        return { success: true, waitedFor: selector };
      }
      
      await new Promise(resolve => setTimeout(resolve, time));
      return { success: true, waited: time };
    }
  },
  {
    name: 'get_elements',
    description: 'Get list of elements matching selector',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to find elements',
          required: true
        }
      },
      required: ['selector']
    },
    execute: async ({ browser, selector }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      const elements = await page.getElements(selector);
      return { success: true, elements, count: elements.length };
    }
  },
  {
    name: 'fill_form',
    description: 'Fill multiple form fields at once',
    parameters: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Object with selector-value pairs',
          required: true
        }
      },
      required: ['fields']
    },
    execute: async ({ browser, fields }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      await page.fillForm(fields);
      return { success: true, filled: Object.keys(fields) };
    }
  },
  {
    name: 'evaluate',
    description: 'Execute JavaScript in the page context',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'JavaScript expression to evaluate',
          required: true
        }
      },
      required: ['expression']
    },
    execute: async ({ browser, expression }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      try {
        const result = await page.evaluate(eval(`(${expression})`));
        return { success: true, result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    name: 'select',
    description: 'Select an option from a dropdown',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for select element',
          required: true
        },
        value: {
          type: 'string',
          description: 'Value to select',
          required: true
        }
      },
      required: ['selector', 'value']
    },
    execute: async ({ browser, selector, value }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      await page.select(selector, value);
      return { success: true, selected: value };
    }
  },
  {
    name: 'hover',
    description: 'Hover over an element',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for element to hover',
          required: true
        }
      },
      required: ['selector']
    },
    execute: async ({ browser, selector }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      await page.hover(selector);
      return { success: true };
    }
  },
  {
    name: 'back',
    description: 'Go back in browser history',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async ({ browser }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      await page.page.goBack();
      return { success: true, url: page.url() };
    }
  },
  {
    name: 'forward',
    description: 'Go forward in browser history',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async ({ browser }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      await page.page.goForward();
      return { success: true, url: page.url() };
    }
  },
  {
    name: 'refresh',
    description: 'Refresh the current page',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async ({ browser }) => {
      const page = browser.getActivePage();
      if (!page) throw new Error('No active page');
      
      await page.page.reload();
      return { success: true, url: page.url() };
    }
  }
];
