/**
 * Example: Using @browser-use with Xiaomi MiMo
 * 
 * MiMo is OpenAI-compatible, so we just change baseURL and model
 * 
 * Token Plan subscription (Leandro's use case):
 *   baseURL: https://token-plan-cn.xiaomimimo.com/v1
 *   apiKey: tp-xxxxx
 *   model: mimo-v2-pro
 * 
 * Pay-as-you-go:
 *   baseURL: https://api.xiaomimimo.com/v1
 *   apiKey: sk-xxxxx
 *   model: mimo-v2-pro
 */

import { Browser, BrowserAgent } from '@browser-use/core';
import { browserTools } from '@browser-use/tools';
import OpenAI from 'openai';

// ============ MiMo Configuration ============

interface MiMoConfig {
  apiKey: string;
  plan: 'subscription' | 'pay-as-you-go';
  model?: string;
  thinking?: boolean; // MiMo reasoning mode
}

function getMiMoClient(config: MiMoConfig): OpenAI {
  const baseURL = config.plan === 'subscription'
    ? 'https://token-plan-cn.xiaomimimo.com/v1'
    : 'https://api.xiaomimimo.com/v1';

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL,
  });
}

// ============ Browser Agent with MiMo ============

async function runWithMiMo(task: string, config: MiMoConfig) {
  const mimo = getMiMoClient(config);
  const browser = new Browser({ headless: false });
  await browser.launch();

  const page = browser.getActivePage();

  // Convert tools to OpenAI format for MiMo
  const toolsForMiMo = browserTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a browser automation assistant. You can control a web browser to complete tasks.
      
Available tools: ${browserTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

When you need to interact with a page, use the appropriate tool.
Always take a screenshot after significant actions to verify the result.
If an action fails, try an alternative approach.

Current page: ${page?.url() || 'about:blank'}`
    },
    {
      role: 'user',
      content: task
    }
  ];

  let iterations = 0;
  const maxIterations = 20;

  while (iterations < maxIterations) {
    iterations++;
    console.log(`\n--- Step ${iterations} ---`);

    try {
      const response = await mimo.chat.completions.create({
        model: config.model || 'mimo-v2-pro',
        messages,
        tools: toolsForMiMo,
        tool_choice: 'auto',
        temperature: 0.7,
        thinking: { type: config.thinking !== false ? 'enabled' : 'disabled' },
      });

      const assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);

      // Log reasoning if present (MiMo thinking mode)
      if ((assistantMessage as any).reasoning_content) {
        console.log('🤔 Thinking:', (assistantMessage as any).reasoning_content.substring(0, 200));
      }

      // Log content if present
      if (assistantMessage.content) {
        console.log('💬 Response:', assistantMessage.content);
      }

      // Check if MiMo wants to use tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const tool = browserTools.find(t => t.name === toolCall.function.name);

          if (tool) {
            try {
              const params = JSON.parse(toolCall.function.arguments);
              console.log(`🔧 Executing: ${tool.name}`, JSON.stringify(params).substring(0, 100));

              const result = await tool.execute({ browser, ...params });

              // Take screenshot after visual actions
              if (['click', 'type', 'goto', 'scroll'].includes(tool.name)) {
                const activePage = browser.getActivePage();
                if (activePage) {
                  const screenshot = await activePage.screenshot();
                  console.log('📸 Screenshot taken');
                }
              }

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });

              console.log(`✅ ${tool.name} succeeded`);

            } catch (error: any) {
              console.log(`❌ ${tool.name} failed:`, error.message);
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
              });
            }
          }
        }
      } else {
        // MiMo is done - no more tool calls
        console.log('\n✅ Task completed!');
        break;
      }

    } catch (error: any) {
      console.error('API Error:', error.message);
      break;
    }
  }

  // Final state
  const state = browser.getState();
  console.log('\nFinal state:', JSON.stringify(state, null, 2));

  await browser.close();
  return state;
}

// ============ Usage Examples ============

// Example 1: Simple browsing with MiMo
async function exampleSimple() {
  await runWithMiMo(
    'Navigate to news.ycombinator.com and tell me the top 5 story titles',
    {
      apiKey: process.env.MIMO_API_KEY || 'tp-your-key-here',
      plan: 'subscription',
    }
  );
}

// Example 2: Form filling with MiMo
async function exampleForm() {
  await runWithMiMo(
    'Go to example.com, find the contact form, and fill it with test data',
    {
      apiKey: process.env.MIMO_API_KEY || 'tp-your-key-here',
      plan: 'subscription',
    }
  );
}

// Example 3: Research with MiMo
async function exampleResearch() {
  await runWithMiMo(
    'Search Google for "best TypeScript frameworks 2026" and summarize the top 3 results',
    {
      apiKey: process.env.MIMO_API_KEY || 'tp-your-key-here',
      plan: 'subscription',
      thinking: true, // Enable reasoning
    }
  );
}

// ============ Main ============

export { runWithMiMo, getMiMoClient, MiMoConfig };

// Run if called directly
if (require.main === module) {
  const task = process.argv[2] || 'Navigate to example.com and describe what you see';
  
  runWithMiMo(task, {
    apiKey: process.env.MIMO_API_KEY || '',
    plan: 'subscription',
    thinking: true,
  }).catch(console.error);
}
