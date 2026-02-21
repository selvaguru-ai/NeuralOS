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

import { useState, useCallback, useEffect, useRef } from 'react';
import speechRecognition from '../services/voice/speechRecognition';
import type { VoiceState, VoiceError } from '../services/voice/speechRecognition';
import { hapticMicTap } from '../services/voice/voiceFeedback';

interface UseVoiceInputOptions {
  /** Called with the final transcription when the user finishes speaking */
  onFinalResult?: (transcript: string) => void;
  /** Called with live partial transcription as user speaks */
  onPartialResult?: (transcript: string) => void;
  /** Called when a voice error occurs */
  onError?: (error: VoiceError) => void;
  /** Language locale (default: 'en-US') */
  locale?: string;
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
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Keep options in a ref so callbacks don't cause re-renders
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    // Check availability on mount
    speechRecognition.checkAvailability().then(available => {
      setIsAvailable(available);
    });

    // Wire up callbacks
    speechRecognition.onStateChange(state => {
      setVoiceState(state);
      if (state === 'idle' || state === 'listening') {
        setError(null);
      }
    });

    speechRecognition.onPartialResult(text => {
      setTranscript(text);
      optionsRef.current.onPartialResult?.(text);
    });

    speechRecognition.onFinalResult(text => {
      setTranscript(text);
      optionsRef.current.onFinalResult?.(text);
    });

    speechRecognition.onError(err => {
      setError(err);
      optionsRef.current.onError?.(err);
    });

    return () => {
      speechRecognition.removeAllCallbacks();
    };
  }, []);

  // ─── Actions ───────────────────────────────────────────

  const startListening = useCallback(async () => {
    hapticMicTap();
    setTranscript('');
    setError(null);
    await speechRecognition.start(optionsRef.current.locale ?? 'en-US');
  }, []);

  const stopListening = useCallback(async () => {
    await speechRecognition.stop();
  }, []);

  const cancelListening = useCallback(async () => {
    setTranscript('');
    await speechRecognition.cancel();
  }, []);

  const toggleListening = useCallback(async () => {
    if (speechRecognition.isListening) {
      await speechRecognition.stop();
    } else {
      await startListening();
    }
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
