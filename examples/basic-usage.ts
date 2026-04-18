/**
 * Example: Using @browser-use with OpenAI
 * 
 * This shows how to use the browser automation framework
 * with any LLM provider (OpenAI, Anthropic, Google, etc.)
 */

import { Browser, BrowserAgent, browserTools } from '@browser-use/core';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Example 1: Simple browser automation
async function simpleExample() {
  const browser = new Browser({ headless: false });
  
  await browser.launch();
  const page = browser.getActivePage();
  
  // Navigate to a site
  await page?.goto('https://example.com');
  
  // Get page text
  const text = await page?.getText();
  console.log('Page text:', text);
  
  // Take screenshot
  const screenshot = await page?.screenshot();
  console.log('Screenshot taken');
  
  await browser.close();
}

// Example 2: AI-powered browser automation
async function aiAgentExample() {
  const browser = new Browser({ headless: false });
  await browser.launch();
  
  const page = browser.getActivePage();
  await page?.goto('https://news.ycombinator.com');
  
  // Convert tools to OpenAI format
  const toolsForLLM = browserTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
  
  // Main loop: AI decides what actions to take
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'You are a helpful browser automation assistant. Use the available tools to interact with web pages.'
    },
    {
      role: 'user',
      content: 'Get the top 5 stories from Hacker News and their links'
    }
  ];
  
  let iterations = 0;
  const maxIterations = 10;
  
  while (iterations < maxIterations) {
    iterations++;
    
    // Call OpenAI with tools
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      tools: toolsForLLM,
      tool_choice: 'auto'
    });
    
    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);
    
    // Check if AI wants to use tools
    if (assistantMessage.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        const tool = browserTools.find(t => t.name === toolCall.function.name);
        
        if (tool) {
          try {
            const params = JSON.parse(toolCall.function.arguments);
            const result = await tool.execute({ browser, ...params });
            
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
          } catch (error: any) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error.message })
            });
          }
        }
      }
    } else {
      // AI is done, print final response
      console.log('Final answer:', assistantMessage.content);
      break;
    }
  }
  
  await browser.close();
}

// Example 3: Recording and replay
async function recordingExample() {
  const browser = new Browser({ headless: false });
  await browser.launch();
  
  // Start recording
  browser.startRecording();
  
  const page = browser.getActivePage();
  await page?.goto('https://example.com');
  await page?.click('a');
  await page?.screenshot();
  
  // Stop recording and get actions
  const actions = browser.stopRecording();
  console.log('Recorded actions:', actions);
  
  // Replay the actions
  await browser.replay(actions);
  
  await browser.close();
}

// Example 4: Multi-tab automation
async function multiTabExample() {
  const browser = new Browser({ headless: false });
  await browser.launch();
  
  // First tab
  const page1 = browser.getActivePage();
  await page1?.goto('https://example.com');
  
  // New tab
  const page2 = await browser.newPage();
  await page2.goto('https://google.com');
  
  // Switch back to first tab
  await browser.switchToPage('main');
  
  // Get state of all tabs
  const state = browser.getState();
  console.log('Browser state:', state);
  
  await browser.close();
}

// Run examples
async function main() {
  console.log('Running simple example...');
  await simpleExample();
  
  console.log('\nRunning recording example...');
  await recordingExample();
  
  console.log('\nRunning multi-tab example...');
  await multiTabExample();
  
  // Uncomment to run AI agent example (requires OPENAI_API_KEY)
  // console.log('\nRunning AI agent example...');
  // await aiAgentExample();
}

main().catch(console.error);
