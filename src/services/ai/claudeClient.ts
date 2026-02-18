// src/services/ai/claudeClient.ts
// NeuralOS Claude API Client
//
// Core wrapper around the Anthropic SDK with:
// - Streaming responses (word-by-word)
// - Sync responses (full text)
// - Exponential backoff retry logic
// - Structured error handling
// - Token usage tracking
// - Request cancellation via AbortController
//
// INSTALL:
//   npm install @anthropic-ai/sdk
//
// USAGE:
//   import { claudeClient } from './claudeClient';
//
//   // Initialize once (e.g., on app start after onboarding)
//   claudeClient.initialize('sk-ant-...');
//
//   // Streaming (preferred for UI)
//   for await (const chunk of claudeClient.stream('Turn on flashlight')) {
//     updateUI(chunk.accumulated);
//   }
//
//   // Sync (for intent classification, background tasks)
//   const response = await claudeClient.send('What time is it?');

import Anthropic from '@anthropic-ai/sdk';
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
  AIResponse,
  AIError,
  StreamChunk,
  Message,
} from './types';

// ─── Constants ─────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff
const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

// ─── Error Helpers ─────────────────────────────────────────

function classifyError(error: unknown): AIError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name || '';

    // Aborted by user
    if (name === 'AbortError' || msg.includes('aborted')) {
      return {
        type: 'timeout',
        message: 'Request was cancelled.',
        retryable: false,
        originalError: error,
      };
    }

    // Network errors
    if (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    ) {
      return {
        type: 'network',
        message: "Can't reach the server. Check your connection and try again.",
        retryable: true,
        retryAfterMs: 2000,
        originalError: error,
      };
    }

    // Auth errors (401)
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('authentication')) {
      return {
        type: 'auth',
        message: 'API key is invalid or expired. Check your settings.',
        retryable: false,
        originalError: error,
      };
    }

    // Rate limit (429)
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many')) {
      // Try to extract retry-after header value
      const retryMatch = msg.match(/retry.?after[:\s]*(\d+)/i);
      const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 10_000;
      return {
        type: 'rate_limit',
        message: 'Too many requests. Waiting a moment before trying again.',
        retryable: true,
        retryAfterMs: retryAfter,
        originalError: error,
      };
    }

    // Server errors (500, 502, 503, 529)
    if (
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('529') ||
      msg.includes('overloaded')
    ) {
      return {
        type: 'server',
        message: 'Server is temporarily busy. Retrying...',
        retryable: true,
        retryAfterMs: 3000,
        originalError: error,
      };
    }

    // Timeout
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        type: 'timeout',
        message: 'Request timed out. Try a shorter question or check your connection.',
        retryable: true,
        retryAfterMs: 2000,
        originalError: error,
      };
    }
  }

  // Unknown
  return {
    type: 'unknown',
    message: 'Something went wrong. Try again.',
    retryable: true,
    retryAfterMs: 2000,
    originalError: error instanceof Error ? error : new Error(String(error)),
  };
}

/**
 * Sleep helper for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Claude Client Class ───────────────────────────────────

class ClaudeClient {
  private client: Anthropic | null = null;
  private _isInitialized = false;

  // Token usage tracking for the current session
  private _sessionInputTokens = 0;
  private _sessionOutputTokens = 0;
  private _sessionRequestCount = 0;

  /**
   * Initialize the client with an API key.
   * Call this once on app start (after onboarding sets the key).
   *
   * @param apiKey - Optional override. If not provided, reads from MMKV.
   * @throws Error if no API key is available.
   */
  initialize(apiKey?: string): void {
    const key = apiKey || getApiKey();
    if (!key) {
      throw new Error(
        'No API key available. Set one in Settings or pass it to initialize().',
      );
    }

    this.client = new Anthropic({
      apiKey: key,
      // React Native doesn't use Node.js http, so the SDK will use fetch.
      // No additional configuration needed for RN.
    });

    this._isInitialized = true;
    console.log('[ClaudeClient] Initialized successfully');
  }

  /**
   * Check if the client is ready to make requests.
   */
  get isInitialized(): boolean {
    return this._isInitialized && this.client !== null;
  }

  /**
   * Get session token usage stats.
   */
  get sessionStats() {
    return {
      inputTokens: this._sessionInputTokens,
      outputTokens: this._sessionOutputTokens,
      requestCount: this._sessionRequestCount,
    };
  }

  /**
   * Ensure client is initialized before making requests.
   */
  private ensureInitialized(): Anthropic {
    if (!this.client || !this._isInitialized) {
      // Try auto-initializing from stored key
      const key = getApiKey();
      if (key) {
        this.initialize(key);
        return this.client!;
      }
      throw new Error('Claude client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  // ─── Streaming Response ────────────────────────────────

  /**
   * Send a message and receive the response as a stream.
   * This is the preferred method for the UI — shows words as they arrive.
   *
   * @param userMessage - The user's input text (from voice or keyboard)
   * @param options - Request configuration overrides
   * @yields StreamChunk objects with incremental and accumulated text
   *
   * @example
   * ```ts
   * for await (const chunk of claudeClient.stream('Turn on flashlight', {
   *   inputMethod: 'voice'
   * })) {
   *   setResponseText(chunk.accumulated);
   *   if (chunk.isComplete) {
   *     parseActionsFromResponse(chunk.accumulated);
   *   }
   * }
   * ```
   */
  async *stream(
    userMessage: string,
    options: AIRequestOptions = {},
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.ensureInitialized();

    const model = options.model || (getModel() as ClaudeModel);
    const maxTokens = options.maxTokens || getMaxTokens();
    const temperature = options.temperature ?? getTemperature();
    const inputMethod = options.inputMethod || 'text';

    // Build messages array with conversation history
    const messages: Message[] = [];
    if (options.conversationHistory) {
      messages.push(...options.conversationHistory);
    }
    messages.push({ role: 'user', content: userMessage });

    const systemPrompt = buildSystemPrompt(inputMethod, options.systemContext);

    let retries = 0;
    while (retries <= MAX_RETRIES) {
      try {
        const stream = client.messages.stream({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages,
        });

        let accumulated = '';

        // The SDK's stream helper emits 'text' events for each chunk
        for await (const event of stream) {
          if (options.abortSignal?.aborted) {
            stream.controller.abort();
            return;
          }

          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const text = event.delta.text;
            accumulated += text;

            yield {
              text,
              isComplete: false,
              accumulated,
            };
          }
        }

        // Get final message for token usage
        const finalMessage = await stream.finalMessage();

        this._sessionInputTokens += finalMessage.usage.input_tokens;
        this._sessionOutputTokens += finalMessage.usage.output_tokens;
        this._sessionRequestCount++;

        // Yield final complete chunk
        yield {
          text: '',
          isComplete: true,
          accumulated,
        };

        return; // Success — exit retry loop
      } catch (error) {
        const aiError = classifyError(error);

        if (!aiError.retryable || retries >= MAX_RETRIES) {
          throw aiError;
        }

        retries++;
        const delay =
          aiError.retryAfterMs ||
          BASE_RETRY_DELAY_MS * Math.pow(2, retries - 1);

        console.warn(
          `[ClaudeClient] Retry ${retries}/${MAX_RETRIES} after ${delay}ms: ${aiError.message}`,
        );
        await sleep(delay);
      }
    }
  }

  // ─── Synchronous Response ──────────────────────────────

  /**
   * Send a message and receive the complete response at once.
   * Use for intent classification, background tasks, or when you
   * don't need streaming.
   *
   * @param userMessage - The user's input text
   * @param options - Request configuration overrides
   * @returns Complete AIResponse with text, token usage, and timing
   *
   * @example
   * ```ts
   * const response = await claudeClient.send('What is the weather?', {
   *   inputMethod: 'voice',
   *   maxTokens: 512,
   * });
   * console.log(response.text);
   * ```
   */
  async send(
    userMessage: string,
    options: AIRequestOptions = {},
  ): Promise<AIResponse> {
    const client = this.ensureInitialized();
    const startTime = Date.now();

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
        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages,
        });

        const text = response.content
          .filter(block => block.type === 'text')
          .map(block => (block as { type: 'text'; text: string }).text)
          .join('');

        this._sessionInputTokens += response.usage.input_tokens;
        this._sessionOutputTokens += response.usage.output_tokens;
        this._sessionRequestCount++;

        return {
          text,
          model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          inputMethod,
          responseTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        const aiError = classifyError(error);

        if (!aiError.retryable || retries >= MAX_RETRIES) {
          throw aiError;
        }

        retries++;
        const delay =
          aiError.retryAfterMs ||
          BASE_RETRY_DELAY_MS * Math.pow(2, retries - 1);

        console.warn(
          `[ClaudeClient] Retry ${retries}/${MAX_RETRIES} after ${delay}ms: ${aiError.message}`,
        );
        await sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs this
    throw classifyError(new Error('Max retries exceeded'));
  }

  // ─── Lightweight Classification ────────────────────────

  /**
   * Fast intent classification. Uses a minimal prompt and lower max_tokens
   * to save cost and latency.
   *
   * @param userMessage - The raw user input
   * @param inputMethod - How the user provided input
   * @returns Raw JSON string from Claude (parse externally)
   */
  async classify(
    userMessage: string,
    inputMethod: 'voice' | 'text' = 'text',
  ): Promise<string> {
    const { buildClassificationPrompt } = require('./systemPrompt');

    const response = await this.send(userMessage, {
      model: 'claude-haiku-4-5-20251001', // Use Haiku for fast, cheap classification
      maxTokens: 512,
      temperature: 0.1, // Low temp for consistent JSON output
      systemContext: buildClassificationPrompt(),
      inputMethod,
    });

    return response.text;
  }

  // ─── Lifecycle ─────────────────────────────────────────

  /**
   * Reset session stats (e.g., on app restart or new conversation).
   */
  resetSessionStats(): void {
    this._sessionInputTokens = 0;
    this._sessionOutputTokens = 0;
    this._sessionRequestCount = 0;
  }

  /**
   * Re-initialize with a new API key (e.g., user changed it in settings).
   */
  updateApiKey(newKey: string): void {
    this._isInitialized = false;
    this.client = null;
    this.initialize(newKey);
  }

  /**
   * Tear down the client (e.g., on logout).
   */
  destroy(): void {
    this.client = null;
    this._isInitialized = false;
    this.resetSessionStats();
    console.log('[ClaudeClient] Destroyed');
  }
}

// ─── Singleton Export ──────────────────────────────────────
// One client instance shared across the app.

export const claudeClient = new ClaudeClient();

export default claudeClient;
