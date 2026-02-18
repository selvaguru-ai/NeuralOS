// src/services/ai/types.ts
// NeuralOS AI Service Type Definitions

/**
 * Supported Claude models.
 * Default to Sonnet for speed + cost balance on mobile.
 */
export type ClaudeModel =
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'claude-haiku-4-5-20251001';

/**
 * Input method tracking — voice commands get shorter, more action-oriented responses.
 */
export type InputMethod = 'voice' | 'text';

/**
 * Agent categories for intent routing.
 */
export type AgentType = 'system' | 'browse' | 'comms' | 'general';

/**
 * A single message in the conversation history.
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Configuration for the Claude API client.
 */
export interface ClaudeClientConfig {
  apiKey: string;
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Options passed to each AI request.
 */
export interface AIRequestOptions {
  /** Override model for this request */
  model?: ClaudeModel;
  /** Override max tokens for this request */
  maxTokens?: number;
  /** Override temperature for this request */
  temperature?: number;
  /** How the user provided this input */
  inputMethod?: InputMethod;
  /** Conversation history for context */
  conversationHistory?: Message[];
  /** Additional system prompt context (e.g., user memory, current state) */
  systemContext?: string;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * A chunk of streamed response text.
 */
export interface StreamChunk {
  /** The text content of this chunk */
  text: string;
  /** Whether this is the final chunk */
  isComplete: boolean;
  /** Cumulative text so far */
  accumulated: string;
}

/**
 * Complete AI response (non-streaming).
 */
export interface AIResponse {
  /** The full response text */
  text: string;
  /** Model used for this response */
  model: ClaudeModel;
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** How the user provided the original input */
  inputMethod: InputMethod;
  /** Response time in milliseconds */
  responseTimeMs: number;
}

/**
 * Structured error from the AI service.
 */
export interface AIError {
  /** Error category for UI handling */
  type: 'network' | 'auth' | 'rate_limit' | 'timeout' | 'server' | 'unknown';
  /** Human-readable message (safe to show user) */
  message: string;
  /** Whether the request can be retried */
  retryable: boolean;
  /** Suggested wait time before retry (ms), if retryable */
  retryAfterMs?: number;
  /** Original error for debugging */
  originalError?: Error;
}

/**
 * Parsed intent from user input.
 */
export interface ParsedIntent {
  agent: AgentType;
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
  isMultiStep: boolean;
  steps?: ParsedIntent[];
  inputMethod: InputMethod;
  rawInput: string;
}

/**
 * Action button that the AI can include in responses.
 */
export interface ResponseAction {
  label: string;
  command: string;
  variant: 'primary' | 'success' | 'warning' | 'danger' | 'default';
  icon?: string;
  params?: Record<string, string>;
}

/**
 * Structured AI response that includes actions.
 */
export interface StructuredResponse {
  text: string;
  actions?: ResponseAction[];
  card?: {
    title: string;
    icon?: string;
    accentColor?: string;
  };
}
