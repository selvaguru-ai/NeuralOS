// src/services/ai/index.ts
// NeuralOS AI Services — barrel export

export { claudeClient, default } from './claudeClient';
export { buildSystemPrompt, buildClassificationPrompt } from './systemPrompt';
export type {
  ClaudeModel,
  InputMethod,
  AgentType,
  Message,
  ClaudeClientConfig,
  AIRequestOptions,
  AIResponse,
  AIError,
  StreamChunk,
  ParsedIntent,
  ResponseAction,
  StructuredResponse,
} from './types';
