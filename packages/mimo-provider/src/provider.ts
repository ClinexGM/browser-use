/**
 * MiMo Anthropic Provider - For Token Plan subscription
 * 
 * Uses Anthropic protocol with MiMo's custom endpoint
 * 
 * Your config:
 *   baseUrl: https://token-plan-ams.xiaomimimo.com/anthropic
 *   apiKey:  tp-e3aq...
 *   model:   mimo-v2-pro
 */

import Anthropic from '@anthropic-ai/sdk';

export interface MiMoConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  thinking?: boolean;
  maxTokens?: number;
}

export interface MiMoTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export class MiMoProvider {
  private client: Anthropic;
  private config: Required<MiMoConfig>;

  constructor(config: MiMoConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://token-plan-ams.xiaomimimo.com/anthropic',
      model: config.model || 'mimo-v2-pro',
      thinking: config.thinking !== false,
      maxTokens: config.maxTokens || 32000,
    };

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    });
  }

  async chat(
    system: string,
    messages: Anthropic.MessageParam[],
    tools?: MiMoTool[]
  ): Promise<{
    content: string | null;
    toolCalls: Anthropic.ToolUseBlock[];
    thinking: string | null;
    stopReason: string;
  }> {
    const params: any = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system,
      messages,
      ...(tools && { tools }),
    };

    // MiMo thinking mode (extended thinking)
    if (this.config.thinking) {
      params.thinking = { type: 'enabled', budget_tokens: 10000 };
    }

    const response = await this.client.messages.create(params);

    const toolCalls = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Extract thinking if present
    const thinkingContent = (response as any).thinking || null;

    return {
      content: textContent || null,
      toolCalls,
      thinking: thinkingContent,
      stopReason: response.stop_reason,
    };
  }

  // List available MiMo models
  static readonly MODELS = {
    PRO: 'mimo-v2-pro',
    OMNI: 'mimo-v2-omni',
    FLASH: 'mimo-v2-flash',
  };

  static modelInfo(modelId: string) {
    const info: Record<string, { contextWindow: number; maxTokens: number }> = {
      'mimo-v2-pro':   { contextWindow: 1_048_576, maxTokens: 32_000 },
      'mimo-v2-omni':  { contextWindow: 262_144,   maxTokens: 32_000 },
      'mimo-v2-flash': { contextWindow: 262_144,   maxTokens: 8_192 },
    };
    return info[modelId] || { contextWindow: 128_000, maxTokens: 32_000 };
  }
}
