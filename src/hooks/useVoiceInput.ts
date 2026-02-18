// src/hooks/useVoiceInput.ts
// NeuralOS Voice Input Hook
//
// React hook that wraps speechRecognition + haptics into a clean API
// for the CommandScreen component.
//
// USAGE:
//   const {
//     isListening,
//     voiceState,
//     transcript,
//     error,
//     startListening,
//     stopListening,
//     cancelListening,
//   } = useVoiceInput({
//     onFinalResult: (text) => sendToAI(text),
//   });

import { useState, useCallback } from 'react';
import type { VoiceState, VoiceError } from '../services/voice/speechRecognition';
import {
  hapticMicTap,
} from '../services/voice/voiceFeedback';

interface UseVoiceInputOptions {
  /** Called with the final transcription when the user finishes speaking */
  onFinalResult?: (transcript: string) => void;
  /** Called with live partial transcription as user speaks */
  onPartialResult?: (transcript: string) => void;
  /** Called when a voice error occurs */
  onError?: (error: VoiceError) => void;
  /** Language locale (default: 'en-US') */
  locale?: string;
  /** Auto-initialize on mount (default: true) */
  autoInit?: boolean;
}

interface UseVoiceInputReturn {
  /** Current voice state: idle, listening, processing, error */
  voiceState: VoiceState;
  /** Whether actively listening right now */
  isListening: boolean;
  /** Whether processing speech (between end of speech and final result) */
  isProcessing: boolean;
  /** Live transcript text (updates as user speaks) */
  transcript: string;
  /** Current error, if any */
  error: VoiceError | null;
  /** Whether voice recognition is available on this device */
  isAvailable: boolean;
  /** Start listening — tap mic to call this */
  startListening: () => Promise<void>;
  /** Stop listening and get result — call this or let it auto-stop */
  stopListening: () => Promise<void>;
  /** Cancel without result — user taps cancel */
  cancelListening: () => Promise<void>;
  /** Toggle listening on/off — convenience for single mic button */
  toggleListening: () => Promise<void>;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  // STUB VERSION - Voice package removed
  // This provides a non-functional interface so CommandScreen doesn't crash
  const [voiceState] = useState<VoiceState>('idle');
  const [transcript] = useState('');
  const [error] = useState<VoiceError | null>({
    code: 'not_available',
    message: 'Voice input not available. Voice package was removed.',
    suggestTyping: true,
  });
  const [isAvailable] = useState(false);

  // ─── Actions ───────────────────────────────────────────

  const startListening = useCallback(async () => {
    hapticMicTap();
    // Voice package removed - no action
    console.log('[useVoiceInput] Voice package not available');
  }, []);

  const stopListening = useCallback(async () => {
    // Voice package removed - no action
  }, []);

  const cancelListening = useCallback(async () => {
    // Voice package removed - no action
  }, []);

  const toggleListening = useCallback(async () => {
    await startListening();
  }, [startListening]);

  // ─── Return ────────────────────────────────────────────

  return {
    voiceState,
    isListening: voiceState === 'listening',
    isProcessing: voiceState === 'processing',
    transcript,
    error,
    isAvailable,
    startListening,
    stopListening,
    cancelListening,
    toggleListening,
  };
}

export default useVoiceInput;
