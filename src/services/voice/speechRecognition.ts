// src/services/voice/speechRecognition.ts
// NeuralOS Speech Recognition Service
//
// Wraps the custom Android SpeechRecognitionModule (NativeModules.SpeechRecognition)
// with the same clean API used by the CommandScreen.
//
// The native module talks directly to Android's SpeechRecognizer — no third-party
// package required, fully compatible with New Architecture.

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ─── Types ─────────────────────────────────────────────────

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceError {
  code: string;
  message: string;
  /** Should we show a "try typing instead" suggestion? */
  suggestTyping: boolean;
}

type PartialResultCallback = (transcript: string) => void;
type FinalResultCallback = (transcript: string) => void;
type ErrorCallback = (error: VoiceError) => void;
type StateChangeCallback = (state: VoiceState) => void;

// ─── Android SpeechRecognizer error codes ──────────────────
// https://developer.android.com/reference/android/speech/SpeechRecognizer

const ANDROID_ERROR: Record<string, VoiceError> = {
  '1':  { code: 'network_timeout',        message: 'Network timed out. Try again.',                        suggestTyping: false },
  '2':  { code: 'network',                message: 'Network error. Check your connection.',                 suggestTyping: false },
  '3':  { code: 'audio',                  message: 'Microphone error. Make sure no other app is using it.', suggestTyping: false },
  '4':  { code: 'server',                 message: 'Speech service error. Try again.',                      suggestTyping: false },
  '5':  { code: 'client',                 message: 'Voice recognition error. Try again.',                   suggestTyping: false },
  '6':  { code: 'speech_timeout',         message: "Didn't catch that. Try speaking louder.",               suggestTyping: false },
  '7':  { code: 'no_match',               message: "Didn't catch that. Try speaking louder.",               suggestTyping: false },
  '8':  { code: 'recognizer_busy',        message: 'Voice recognition is busy. Try again.',                 suggestTyping: false },
  '9':  { code: 'insufficient_perms',     message: 'Microphone access denied. Enable it in Settings.',      suggestTyping: true  },
  '10': { code: 'too_many_requests',      message: 'Too many requests. Wait a moment and try again.',       suggestTyping: false },
  '11': { code: 'server_disconnected',    message: 'Speech service disconnected. Try again.',               suggestTyping: false },
  '12': { code: 'language_not_supported', message: 'Language not supported. Try again in English.',         suggestTyping: false },
  '13': { code: 'language_unavailable',   message: 'Language unavailable. Check your connection.',          suggestTyping: false },
};

function mapAndroidError(code: string): VoiceError {
  const mapped = ANDROID_ERROR[code];
  if (!mapped) {
    console.warn('[SpeechRecognition] Unmapped Android error code:', code);
  }
  return mapped ?? {
    code: 'unknown',
    message: 'Something went wrong. Try again.',
    suggestTyping: false,
  };
}

// ─── Speech Recognition Class ──────────────────────────────

class SpeechRecognition {
  private _state: VoiceState = 'idle';
  private _latestPartial = '';

  // Callbacks
  private _onPartialResult: PartialResultCallback | null = null;
  private _onFinalResult: FinalResultCallback | null = null;
  private _onError: ErrorCallback | null = null;
  private _onStateChange: StateChangeCallback | null = null;

  // Native module + event emitter (Android only)
  private _module: any = null;
  private _emitter: NativeEventEmitter | null = null;
  private _subscriptions: any[] = [];

  constructor() {
    if (Platform.OS === 'android') {
      this._module = NativeModules.SpeechRecognition;
      if (this._module) {
        this._emitter = new NativeEventEmitter(this._module);
        this._setupListeners();
      } else {
        console.error('[SpeechRecognition] Native module not found. Did you rebuild the app?');
      }
    }
  }

  // ─── Getters ──────────────────────────────────────────

  get state(): VoiceState {
    return this._state;
  }

  get isListening(): boolean {
    return this._state === 'listening';
  }

  // ─── Callback Registration ────────────────────────────

  onPartialResult(callback: PartialResultCallback): void {
    this._onPartialResult = callback;
  }

  onFinalResult(callback: FinalResultCallback): void {
    this._onFinalResult = callback;
  }

  onError(callback: ErrorCallback): void {
    this._onError = callback;
  }

  onStateChange(callback: StateChangeCallback): void {
    this._onStateChange = callback;
  }

  removeAllCallbacks(): void {
    this._onPartialResult = null;
    this._onFinalResult = null;
    this._onError = null;
    this._onStateChange = null;
  }

  // ─── Core Methods ─────────────────────────────────────

  async checkAvailability(): Promise<boolean> {
    if (!this._module) return false;
    try {
      const available = await this._module.isAvailable();
      return !!available;
    } catch {
      return false;
    }
  }

  async start(locale: string = 'en-US'): Promise<void> {
    if (!this._module) {
      this._setState('error');
      this._onError?.({
        code: 'not_available',
        message: 'Voice recognition not available. Rebuild the app.',
        suggestTyping: true,
      });
      return;
    }

    if (this._state === 'listening') {
      await this.stop();
    }

    this._latestPartial = '';
    this._setState('listening');
    this._module.startListening(locale);
  }

  async stop(): Promise<void> {
    if (this._state !== 'listening') return;
    this._setState('processing');
    this._module?.stopListening();

    // Fallback: if onResults doesn't fire within 1.5 s, use the partial
    setTimeout(() => {
      if (this._state === 'processing' && this._latestPartial) {
        this._onFinalResult?.(this._latestPartial);
        this._setState('idle');
      } else if (this._state === 'processing') {
        this._setState('idle');
      }
    }, 1500);
  }

  async cancel(): Promise<void> {
    this._module?.cancelListening();
    this._latestPartial = '';
    this._setState('idle');
  }

  async destroy(): Promise<void> {
    this._module?.destroyRecognizer();
    this._subscriptions.forEach(sub => sub.remove());
    this._subscriptions = [];
    this.removeAllCallbacks();
    this._setState('idle');
  }

  // ─── Internal ─────────────────────────────────────────

  private _setState(state: VoiceState): void {
    this._state = state;
    this._onStateChange?.(state);
  }

  private _setupListeners(): void {
    if (!this._emitter) return;

    this._subscriptions = [
      this._emitter.addListener('onSpeechStart', () => {
        this._setState('listening');
      }),

      this._emitter.addListener('onSpeechPartialResults', (event: any) => {
        const text: string = event?.value?.[0] ?? '';
        if (text) {
          this._latestPartial = text;
          this._onPartialResult?.(text);
        }
      }),

      this._emitter.addListener('onSpeechResults', (event: any) => {
        const text: string = event?.value?.[0] ?? this._latestPartial ?? '';
        if (text) {
          this._onFinalResult?.(text);
        }
        this._latestPartial = '';
        this._setState('idle');
      }),

      this._emitter.addListener('onSpeechEnd', () => {
        if (this._state === 'listening') {
          this._setState('processing');
        }
      }),

      this._emitter.addListener('onSpeechError', (event: any) => {
        const error = mapAndroidError(String(event?.error ?? ''));
        console.warn('[SpeechRecognition] Error:', error.code, error.message);
        this._setState('error');
        this._onError?.(error);

        // Auto-reset to idle so user can tap and retry
        setTimeout(() => {
          if (this._state === 'error') {
            this._setState('idle');
          }
        }, 2000);
      }),

      this._emitter.addListener('onSpeechCancel', () => {
        this._setState('idle');
      }),
    ];
  }
}

// ─── Singleton Export ──────────────────────────────────────

export const speechRecognition = new SpeechRecognition();
export default speechRecognition;
