// src/services/ai/claudeClient.ts
// NeuralOS Claude API Client (React Native Compatible)
//
// Uses direct fetch() with non-streaming API for React Native compatibility.
// RN's Hermes engine doesn't reliably support ReadableStream / response.body.getReader(),
// so we use the synchronous Messages API and simulate word-by-word streaming in the hook layer.

import { buildSystemPrompt } from './systemPrompt';
import {
  getApiKey,
  getModel,
  getMaxTokens,
  getTemperature,
} from '../../storage/secureStore';
import type {
  ClaudeModel,
  AIRequestOptions,
  AIError,
  StreamChunk,
  Message,
} from './types';

// ─── Constants ─────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

// ─── Error Helpers ─────────────────────────────────────────

function classifyError(error: unknown): AIError {
  const raw = error instanceof Error ? error.message : String(error);

  if (error instanceof Error) {
    const msg = raw.toLowerCase();
    const name = error.name || '';

    if (name === 'AbortError' || msg.includes('aborted')) {
      return {
        type: 'timeout',
        message: 'Request was cancelled.',
        retryable: false,
        originalError: error,
      };
    }

    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('type error')) {
      return {
        type: 'network',
        message: "Can't reach the server. Check your connection.",
        retryable: true,
        retryAfterMs: 2000,
        originalError: error,
      };
    }

    if (msg.includes('http 401') || msg.includes('unauthorized') || msg.includes('invalid x-api-key')) {
      return {
        type: 'auth',
        message: 'API key is invalid or expired. Check your settings.',
        retryable: false,
        originalError: error,
      };
    }

    if (msg.includes('http 429') || msg.includes('rate limit')) {
      return {
        type: 'rate_limit',
        message: "Rate limited. Waiting before retrying.",
        retryable: true,
        retryAfterMs: 15_000,
        originalError: error,
      };
    }

    if (msg.includes('http 400')) {
      return {
        type: 'unknown',
        message: `Bad request: ${raw.slice(0, 200)}`,
        retryable: false,
        originalError: error,
      };
    }

    if (msg.includes('http 5') || msg.includes('overloaded')) {
      return {
        type: 'server',
        message: "Claude's servers are busy. Retrying...",
        retryable: true,
        retryAfterMs: 5000,
        originalError: error,
      };
    }
  }

  return {
    type: 'unknown',
    message: `Unexpected error: ${raw.slice(0, 200)}`,
    retryable: true,
    retryAfterMs: 2000,
    originalError: error instanceof Error ? error : new Error(String(error)),
  };
}

// ─── Claude Client ─────────────────────────────────────────

class ClaudeClient {
  private _apiKey: string | null = null;
  private _isInitialized = false;
  private _sessionInputTokens = 0;
  private _sessionOutputTokens = 0;
  private _sessionRequestCount = 0;

  initialize(apiKey?: string): void {
    const key = apiKey || getApiKey();
    if (!key) {
      console.error('[ClaudeClient] No API key provided');
      return;
    }
    this._apiKey = key;
    this._isInitialized = true;
    console.log('[ClaudeClient] Initialized successfully');
  }

  get isInitialized(): boolean {
    return this._isInitialized && !!this._apiKey;
  }

  get sessionStats() {
    return {
      inputTokens: this._sessionInputTokens,
      outputTokens: this._sessionOutputTokens,
      requestCount: this._sessionRequestCount,
    };
  }

  private ensureInitialized(): string {
    if (!this._apiKey || !this._isInitialized) {
      const key = getApiKey();
      if (key) {
        this.initialize(key);
        return key;
      }
      throw new Error('Claude client not initialized. Call initialize() first.');
    }
    return this._apiKey;
  }

  // ─── Core API Call (non-streaming, RN-safe) ─────────────

  private async callAPI(
    messages: Message[],
    systemPrompt: string,
    model: ClaudeModel,
    maxTokens: number,
    temperature: number,
    abortSignal?: AbortSignal,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const apiKey = this.ensureInitialized();

    const body = {
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
    };

    console.log('[ClaudeClient] Calling API:', {
      model,
      max_tokens: maxTokens,
      messageCount: messages.length,
      url: ANTHROPIC_API_URL,
    });

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[ClaudeClient] API error:', response.status, responseText.slice(0, 500));
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('[ClaudeClient] Invalid JSON response:', responseText.slice(0, 500));
      throw new Error('Invalid JSON from Anthropic API');
    }

    const text = (data.content || [])
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    this._sessionInputTokens += inputTokens;
    this._sessionOutputTokens += outputTokens;
    this._sessionRequestCount += 1;

    console.log('[ClaudeClient] Response received:', {
      textLength: text.length,
      inputTokens,
      outputTokens,
      stopReason: data.stop_reason,
    });

    return { text, inputTokens, outputTokens };
  }

  // ─── Stream (simulated via non-streaming API) ───────────
  // Yields the full response as a single chunk.
  // The useStreamingResponse hook handles display — this keeps
  // the same AsyncGenerator interface so nothing else needs to change.

  async *stream(
    userMessage: string,
    options: AIRequestOptions = {},
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const model = options.model || (getModel() as ClaudeModel);
    const maxTokens = options.maxTokens || getMaxTokens();
    const temperature = options.temperature ?? getTemperature();
    const inputMethod = options.inputMethod || 'text';

    const messages: Message[] = [];
    if (options.conversationHistory) {
      messages.push(...options.conversationHistory);
    }
    messages.push({ role: 'user', content: userMessage });

    const systemPrompt = buildSystemPrompt(inputMethod, options.systemContext);

    let retries = 0;
    while (retries <= MAX_RETRIES) {
      try {
        const result = await this.callAPI(
          messages,
          systemPrompt,
          model,
          maxTokens,
          temperature,
          options.abortSignal,
        );

        if (options.abortSignal?.aborted) return;

        // Yield the full text, then a completion marker
        yield {
          text: result.text,
          isComplete: false,
          accumulated: result.text,
        };

        yield {
          text: '',
          isComplete: true,
          accumulated: result.text,
        };

        return;
      } catch (error) {
        console.error('[ClaudeClient] Raw error:', error);
        const classified = classifyError(error);

        if (!classified.retryable || options.abortSignal?.aborted) {
          throw classified;
        }

        retries += 1;
        if (retries > MAX_RETRIES) {
          throw classified;
        }

        const delay =
          classified.retryAfterMs ||
          BASE_RETRY_DELAY_MS * Math.pow(2, retries - 1);

        console.warn(
          `[ClaudeClient] Retry ${retries}/${MAX_RETRIES} after ${delay}ms: ${classified.message}`,
        );
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // ─── Convenience: full response at once ──────────────────

  async send(
    userMessage: string,
    options: AIRequestOptions = {},
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const model = options.model || (getModel() as ClaudeModel);
    const maxTokens = options.maxTokens || getMaxTokens();
    const temperature = options.temperature ?? getTemperature();
    const inputMethod = options.inputMethod || 'text';

    const messages: Message[] = [];
    if (options.conversationHistory) {
      messages.push(...options.conversationHistory);
    }
    messages.push({ role: 'user', content: userMessage });

    const systemPrompt = buildSystemPrompt(inputMethod, options.systemContext);

    return this.callAPI(messages, systemPrompt, model, maxTokens, temperature, options.abortSignal);
  }

  // ─── Lifecycle ──────────────────────────────────────────

  resetSessionStats(): void {
    this._sessionInputTokens = 0;
    this._sessionOutputTokens = 0;
    this._sessionRequestCount = 0;
  }

  updateApiKey(newKey: string): void {
    this._isInitialized = false;
    this._apiKey = null;
    this.initialize(newKey);
  }

  destroy(): void {
    this._apiKey = null;
    this._isInitialized = false;
    this.resetSessionStats();
    console.log('[ClaudeClient] Destroyed');
  }
}

// ─── Singleton Export ──────────────────────────────────────

export const claudeClient = new ClaudeClient();
export default claudeClient;
