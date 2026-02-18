// src/hooks/useStreamingResponse.ts
// NeuralOS Streaming Response Hook
//
// Manages the full lifecycle of an AI request:
// idle → sending → streaming → complete | error
//
// Handles streaming text, parsing action buttons from responses,
// conversation history, and cancellation.
//
// USAGE:
//   const {
//     response,
//     isStreaming,
//     isComplete,
//     error,
//     actions,
//     cardHeader,
//     sendMessage,
//     cancelStream,
//     clearResponse,
//   } = useStreamingResponse();
//
//   // From voice input:
//   sendMessage('Turn on flashlight', 'voice');
//
//   // From text input:
//   sendMessage('Find best laptop under $1000', 'text');
//
//   // In JSX:
//   <Text>{response}</Text>
//   {isStreaming && <TypingIndicator />}
//   {actions.map(a => <ActionButton key={a.command} {...a} />)}

import { useState, useCallback, useRef } from 'react';
import { claudeClient } from '../services/ai/claudeClient';
import type {
  InputMethod,
  Message,
  AIError,
  ResponseAction,
} from '../services/ai/types';

// ─── Types ─────────────────────────────────────────────────

export type StreamState = 'idle' | 'sending' | 'streaming' | 'complete' | 'error';

interface CardHeader {
  title: string;
  icon?: string;
  accentColor?: string;
}

interface UseStreamingResponseReturn {
  /** Current state of the stream */
  streamState: StreamState;
  /** Accumulated response text (updates word-by-word during streaming) */
  response: string;
  /** Whether currently streaming (show typing indicator) */
  isStreaming: boolean;
  /** Whether the response is complete */
  isComplete: boolean;
  /** Error object if something went wrong */
  error: AIError | null;
  /** Action buttons parsed from the AI response */
  actions: ResponseAction[];
  /** Card header parsed from the AI response (title, icon, color) */
  cardHeader: CardHeader | null;
  /** Clean response text (without ACTIONS: and CARD: lines) */
  displayText: string;
  /** Send a message to Claude and start streaming the response */
  sendMessage: (text: string, inputMethod?: InputMethod) => Promise<void>;
  /** Cancel the current stream */
  cancelStream: () => void;
  /** Reset everything back to idle */
  clearResponse: () => void;
  /** Full conversation history (for context in follow-up messages) */
  conversationHistory: Message[];
  /** Clear conversation history (new conversation) */
  clearHistory: () => void;
}

// ─── Response Parsing ──────────────────────────────────────

/**
 * Parse ACTIONS: JSON line from AI response.
 * Format: ACTIONS: [{"label": "Turn Off", "command": "flashlight_off", "variant": "warning"}]
 */
function parseActions(text: string): ResponseAction[] {
  const match = text.match(/^ACTIONS:\s*(\[.*\])\s*$/m);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (a: any) =>
        typeof a.label === 'string' &&
        typeof a.command === 'string',
    ).map((a: any) => ({
      label: a.label,
      command: a.command,
      variant: a.variant || 'default',
      icon: a.icon,
      params: a.params,
    }));
  } catch {
    return [];
  }
}

/**
 * Parse CARD: JSON line from AI response.
 * Format: CARD: {"title": "System Control", "icon": "🔦", "accentColor": "#FF9800"}
 */
function parseCardHeader(text: string): CardHeader | null {
  const match = text.match(/^CARD:\s*(\{.*\})\s*$/m);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (typeof parsed.title !== 'string') return null;

    return {
      title: parsed.title,
      icon: parsed.icon,
      accentColor: parsed.accentColor,
    };
  } catch {
    return null;
  }
}

/**
 * Remove ACTIONS: and CARD: lines from the response text
 * so the UI shows clean text only.
 */
function getDisplayText(text: string): string {
  return text
    .replace(/^CARD:\s*\{.*\}\s*$/m, '')
    .replace(/^ACTIONS:\s*\[.*\]\s*$/m, '')
    .trim();
}

// ─── Hook ──────────────────────────────────────────────────

export function useStreamingResponse(): UseStreamingResponseReturn {
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<AIError | null>(null);
  const [actions, setActions] = useState<ResponseAction[]>([]);
  const [cardHeader, setCardHeader] = useState<CardHeader | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);

  // AbortController ref for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track if component is still mounted
  const mountedRef = useRef(true);

  /**
   * Send a message and stream the response.
   */
  const sendMessage = useCallback(
    async (text: string, inputMethod: InputMethod = 'text') => {
      if (!text.trim()) return;

      // Cancel any in-progress stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Reset state
      setStreamState('sending');
      setResponse('');
      setError(null);
      setActions([]);
      setCardHeader(null);

      // Add user message to history
      const updatedHistory: Message[] = [
        ...conversationHistory,
        { role: 'user' as const, content: text },
      ];

      try {
        // Check if client is initialized
        if (!claudeClient.isInitialized) {
          claudeClient.initialize();
        }

        setStreamState('streaming');

        let fullResponse = '';

        for await (const chunk of claudeClient.stream(text, {
          inputMethod,
          conversationHistory: updatedHistory.slice(-10), // Keep last 10 messages for context
          abortSignal: abortController.signal,
        })) {
          // Check if cancelled or unmounted
          if (abortController.signal.aborted || !mountedRef.current) {
            return;
          }

          fullResponse = chunk.accumulated;
          setResponse(fullResponse);

          // Parse card header early (it's at the start of response)
          if (!cardHeader) {
            const card = parseCardHeader(fullResponse);
            if (card) setCardHeader(card);
          }

          if (chunk.isComplete) {
            // Parse actions from complete response
            const parsedActions = parseActions(fullResponse);
            setActions(parsedActions);

            // Parse card header from complete response (in case we missed it)
            const parsedCard = parseCardHeader(fullResponse);
            if (parsedCard) setCardHeader(parsedCard);

            // Add assistant response to history
            setConversationHistory([
              ...updatedHistory,
              { role: 'assistant' as const, content: fullResponse },
            ]);

            setStreamState('complete');
          }
        }
      } catch (err) {
        // Don't show error if we cancelled intentionally
        if (abortController.signal.aborted) {
          setStreamState('idle');
          return;
        }

        const aiError = err as AIError;
        setError(
          aiError.type
            ? aiError
            : {
                type: 'unknown',
                message: 'Something went wrong. Try again.',
                retryable: true,
                originalError: err instanceof Error ? err : new Error(String(err)),
              },
        );
        setStreamState('error');
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [conversationHistory, cardHeader],
  );

  /**
   * Cancel the current stream.
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamState('idle');
  }, []);

  /**
   * Reset everything back to idle (but keep conversation history).
   */
  const clearResponse = useCallback(() => {
    cancelStream();
    setResponse('');
    setError(null);
    setActions([]);
    setCardHeader(null);
    setStreamState('idle');
  }, [cancelStream]);

  /**
   * Clear conversation history (start fresh conversation).
   */
  const clearHistory = useCallback(() => {
    clearResponse();
    setConversationHistory([]);
  }, [clearResponse]);

  return {
    streamState,
    response,
    isStreaming: streamState === 'sending' || streamState === 'streaming',
    isComplete: streamState === 'complete',
    error,
    actions,
    cardHeader,
    displayText: getDisplayText(response),
    sendMessage,
    cancelStream,
    clearResponse,
    conversationHistory,
    clearHistory,
  };
}

export default useStreamingResponse;
