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

import { useState, useEffect, useCallback, useRef } from 'react';
import { speechRecognition, VoiceState, VoiceError } from '../services/voice/speechRecognition';
import {
  hapticMicTap,
  hapticRecognized,
  hapticError as hapticErrorFeedback,
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
  const {
    onFinalResult,
    onPartialResult,
    onError,
    locale = 'en-US',
    autoInit = true,
  } = options;

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Use refs for callbacks to avoid stale closures
  const onFinalResultRef = useRef(onFinalResult);
  const onPartialResultRef = useRef(onPartialResult);
  const onErrorRef = useRef(onError);

  onFinalResultRef.current = onFinalResult;
  onPartialResultRef.current = onPartialResult;
  onErrorRef.current = onError;

  // ─── Initialize ────────────────────────────────────────

  useEffect(() => {
    if (!autoInit) return;

    async function init() {
      const available = await speechRecognition.checkAvailability();
      setIsAvailable(available);

      if (available) {
        await speechRecognition.requestPermission();
      }
    }

    // Register callbacks
    speechRecognition.onPartialResult((text) => {
      setTranscript(text);
      onPartialResultRef.current?.(text);
    });

    speechRecognition.onFinalResult((text) => {
      setTranscript(text);
      hapticRecognized();
      onFinalResultRef.current?.(text);
    });

    speechRecognition.onError((err) => {
      setError(err);
      hapticErrorFeedback();
      onErrorRef.current?.(err);
    });

    speechRecognition.onStateChange((state) => {
      setVoiceState(state);
      if (state === 'idle') {
        setError(null);
      }
    });

    init();

    // Cleanup on unmount
    return () => {
      speechRecognition.removeAllCallbacks();
      // Don't destroy — other screens might use voice too
    };
  }, [autoInit]);

  // ─── Actions ───────────────────────────────────────────

  const startListening = useCallback(async () => {
    setTranscript('');
    setError(null);
    hapticMicTap();
    await speechRecognition.start(locale);
  }, [locale]);

  const stopListening = useCallback(async () => {
    await speechRecognition.stop();
  }, []);

  const cancelListening = useCallback(async () => {
    setTranscript('');
    await speechRecognition.cancel();
  }, []);

  const toggleListening = useCallback(async () => {
    if (speechRecognition.isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [startListening, stopListening]);

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
