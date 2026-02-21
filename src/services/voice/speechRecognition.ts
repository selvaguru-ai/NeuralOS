// src/services/voice/speechRecognition.ts
// NeuralOS Speech Recognition Service
//
// Wraps @react-native-voice/voice with a clean API for the CommandScreen.
// Handles: start/stop listening, live transcription, error recovery.
//
// INSTALL:
//   npm install @react-native-voice/voice
//
// ANDROID SETUP:
//   Add to android/app/src/main/AndroidManifest.xml inside <manifest>:
//     <uses-permission android:name="android.permission.RECORD_AUDIO"/>
//
//   Then rebuild:
//     cd android && ./gradlew clean && cd ..
//     npx react-native run-android
//
// USAGE:
//   import { speechRecognition } from './speechRecognition';
//
//   speechRecognition.onPartialResult((text) => setLiveTranscript(text));
//   speechRecognition.onFinalResult((text) => sendToAI(text));
//   speechRecognition.onError((error) => showError(error));
//
//   await speechRecognition.start();
//   // ... user speaks ...
//   await speechRecognition.stop(); // or it auto-stops on silence

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
  SpeechStartEvent,
  SpeechEndEvent,
} from '@react-native-voice/voice';
import { Platform, PermissionsAndroid } from 'react-native';

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

// ─── Error Mapping ─────────────────────────────────────────
// Maps Voice library error codes to user-friendly messages

function mapVoiceError(error: SpeechErrorEvent): VoiceError {
  const code = error.error?.code || error.error?.message || 'unknown';
  const codeStr = String(code);

  // Permission denied
  if (codeStr.includes('permissions') || codeStr.includes('not_allowed') || codeStr === '9') {
    return {
      code: 'permission_denied',
      message: 'Microphone access denied. Enable it in Settings.',
      suggestTyping: true,
    };
  }

  // No speech detected (user stayed silent)
  if (codeStr.includes('no_speech') || codeStr.includes('no_match') || codeStr === '6' || codeStr === '7') {
    return {
      code: 'no_speech',
      message: "Didn't catch that. Tap to try again.",
      suggestTyping: false,
    };
  }

  // Network error (some speech recognition uses online services)
  if (codeStr.includes('network') || codeStr === '2') {
    return {
      code: 'network',
      message: 'Voice recognition needs internet. Try typing instead.',
      suggestTyping: true,
    };
  }

  // Audio recording error
  if (codeStr.includes('audio') || codeStr === '3') {
    return {
      code: 'audio_error',
      message: 'Microphone error. Make sure no other app is using it.',
      suggestTyping: true,
    };
  }

  // Recognition busy
  if (codeStr.includes('busy') || codeStr === '8') {
    return {
      code: 'busy',
      message: 'Voice recognition is busy. Try again in a moment.',
      suggestTyping: false,
    };
  }

  // Server error (Google's speech API down)
  if (codeStr.includes('server') || codeStr === '4') {
    return {
      code: 'server_error',
      message: 'Speech service unavailable. Try typing instead.',
      suggestTyping: true,
    };
  }

  // Unknown
  return {
    code: 'unknown',
    message: 'Something went wrong with voice input. Try again.',
    suggestTyping: true,
  };
}

// ─── Speech Recognition Class ──────────────────────────────

class SpeechRecognition {
  private _state: VoiceState = 'idle';
  private _isAvailable = false;
  private _hasPermission = false;

  // Callbacks
  private _onPartialResult: PartialResultCallback | null = null;
  private _onFinalResult: FinalResultCallback | null = null;
  private _onError: ErrorCallback | null = null;
  private _onStateChange: StateChangeCallback | null = null;

  // Track the latest partial result (for when stop() is called manually)
  private _latestPartial = '';

  constructor() {
    this.setupListeners();
  }

  // ─── Getters ─────────────────────────────────────────

  get state(): VoiceState {
    return this._state;
  }

  get isListening(): boolean {
    return this._state === 'listening';
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  // ─── Callback Registration ───────────────────────────

  /**
   * Called with partial (live) transcription as the user speaks.
   * Updates in real-time — use this to show live transcript in UI.
   */
  onPartialResult(callback: PartialResultCallback): void {
    this._onPartialResult = callback;
  }

  /**
   * Called once with the final transcription when speech ends.
   * This is the text you send to the AI.
   */
  onFinalResult(callback: FinalResultCallback): void {
    this._onFinalResult = callback;
  }

  /**
   * Called when an error occurs during recognition.
   */
  onError(callback: ErrorCallback): void {
    this._onError = callback;
  }

  /**
   * Called whenever the voice state changes (idle/listening/processing/error).
   * Use for UI state (mic button animation, waveform visibility, etc.)
   */
  onStateChange(callback: StateChangeCallback): void {
    this._onStateChange = callback;
  }

  /**
   * Remove all callbacks (call on component unmount).
   */
  removeAllCallbacks(): void {
    this._onPartialResult = null;
    this._onFinalResult = null;
    this._onError = null;
    this._onStateChange = null;
  }

  // ─── Core Methods ────────────────────────────────────

  /**
   * Check if speech recognition is available on this device.
   * Call once on app start.
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const available = await Voice.isAvailable();
      this._isAvailable = !!available;
      return this._isAvailable;
    } catch {
      this._isAvailable = false;
      return false;
    }
  }

  /**
   * Request microphone permission (Android only, iOS handles it automatically).
   * Returns true if granted.
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'NeuralOS Voice Access',
            message:
              'NeuralOS needs microphone access so you can control your phone with voice commands.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        this._hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        return this._hasPermission;
      } catch {
        this._hasPermission = false;
        return false;
      }
    }

    // iOS handles permissions via the Voice framework automatically
    this._hasPermission = true;
    return true;
  }

  /**
   * Start listening for speech.
   *
   * @param locale - Language locale (default: 'en-US')
   * @throws VoiceError if permission denied or not available
   */
  async start(locale: string = 'en-US'): Promise<void> {
    // Request permission on first use (Android only; iOS is automatic)
    if (!this._hasPermission) {
      const granted = await this.requestPermission();
      console.log('[SpeechRecognition] permission result:', granted);
      if (!granted) {
        this.setState('error');
        this._onError?.({
          code: 'permission_denied',
          message: 'Microphone access denied. Enable it in Settings.',
          suggestTyping: true,
        });
        return;
      }
    }

    // If already listening, stop first
    if (this._state === 'listening') {
      await this.stop();
    }

    // Skip the isAvailable() pre-check — it returns false on some Android
    // devices/emulators even when Voice.start() works fine. Just try to start
    // and let the error handler deal with a real failure.
    try {
      this._latestPartial = '';
      this.setState('listening');
      console.log('[SpeechRecognition] calling Voice.start() with locale:', locale);
      await Voice.start(locale);
    } catch (error) {
      console.error('[SpeechRecognition] Voice.start() threw:', error);
      this.setState('error');
      this._onError?.({
        code: 'start_failed',
        message: 'Could not start voice recognition. Try again.',
        suggestTyping: false,
      });
    }
  }

  /**
   * Stop listening and get the final result.
   * If the user was mid-sentence, the partial result becomes the final.
   */
  async stop(): Promise<void> {
    if (this._state !== 'listening') return;

    try {
      this.setState('processing');
      await Voice.stop();

      // If Voice.stop() doesn't trigger onSpeechResults (happens sometimes),
      // use the latest partial result as fallback after a short delay
      setTimeout(() => {
        if (this._state === 'processing' && this._latestPartial) {
          this._onFinalResult?.(this._latestPartial);
          this.setState('idle');
        }
      }, 1000);
    } catch (error) {
      console.error('[SpeechRecognition] Failed to stop:', error);
      // If stop fails, try to use the partial result we have
      if (this._latestPartial) {
        this._onFinalResult?.(this._latestPartial);
      }
      this.setState('idle');
    }
  }

  /**
   * Cancel recognition without returning a result.
   */
  async cancel(): Promise<void> {
    try {
      await Voice.cancel();
    } catch {
      // Ignore cancel errors
    }
    this._latestPartial = '';
    this.setState('idle');
  }

  /**
   * Clean up everything. Call on app exit or when voice is disabled.
   */
  async destroy(): Promise<void> {
    try {
      await Voice.destroy();
    } catch {
      // Ignore destroy errors
    }
    this.removeAllCallbacks();
    this._latestPartial = '';
    this.setState('idle');
    console.log('[SpeechRecognition] Destroyed');
  }

  // ─── Internal Setup ──────────────────────────────────

  private setState(state: VoiceState): void {
    this._state = state;
    this._onStateChange?.(state);
  }

  private setupListeners(): void {
    // Speech recognition started
    Voice.onSpeechStart = (_event: SpeechStartEvent) => {
      this.setState('listening');
    };

    // Partial results (live transcription)
    Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
      const transcript = event.value?.[0] || '';
      if (transcript) {
        this._latestPartial = transcript;
        this._onPartialResult?.(transcript);
      }
    };

    // Final results (speech ended naturally)
    Voice.onSpeechResults = (event: SpeechResultsEvent) => {
      const transcript = event.value?.[0] || this._latestPartial || '';
      if (transcript) {
        this._onFinalResult?.(transcript);
      }
      this._latestPartial = '';
      this.setState('idle');
    };

    // Speech ended (user stopped talking)
    Voice.onSpeechEnd = (_event: SpeechEndEvent) => {
      // On Android, onSpeechEnd fires before onSpeechResults.
      // We set state to 'processing' and wait for results.
      if (this._state === 'listening') {
        this.setState('processing');
      }
    };

    // Error
    Voice.onSpeechError = (event: SpeechErrorEvent) => {
      const error = mapVoiceError(event);
      console.warn('[SpeechRecognition] Error:', error.code, error.message);
      this.setState('error');
      this._onError?.(error);

      // Auto-reset to idle after error so user can try again
      setTimeout(() => {
        if (this._state === 'error') {
          this.setState('idle');
        }
      }, 2000);
    };
  }
}

// ─── Singleton Export ──────────────────────────────────────

export const speechRecognition = new SpeechRecognition();
export default speechRecognition;
