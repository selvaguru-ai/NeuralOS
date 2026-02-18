// src/services/voice/voiceFeedback.ts
// NeuralOS Voice Feedback — Haptics + Audio Cues
//
// Provides tactile and audio feedback for voice interactions:
// - Haptic vibration on mic tap, command recognized, action complete, error
// - Sound cues for listening start/stop (optional)
//
// Uses React Native's built-in Vibration API (no extra dependencies).
// TTS (Text-to-Speech) for reading AI responses aloud will be added in Week 3
// when the System Agent gets full native module access.
//
// ANDROID SETUP:
//   Add to AndroidManifest.xml inside <manifest>:
//     <uses-permission android:name="android.permission.VIBRATE"/>

import { Vibration, Platform } from 'react-native';
import { isHapticsEnabled } from '../../storage/secureStore';

// ─── Haptic Patterns ───────────────────────────────────────
// Android Vibration API takes duration in ms or a pattern array.
// Pattern format: [wait, vibrate, wait, vibrate, ...]

const PATTERNS = {
  /** Light tap — mic button pressed */
  micTap: Platform.OS === 'android' ? [0, 30] : [0, 20],

  /** Short buzz — command recognized / listening started */
  recognized: Platform.OS === 'android' ? [0, 50] : [0, 40],

  /** Success pattern — action completed successfully */
  success: Platform.OS === 'android' ? [0, 40, 80, 40] : [0, 30, 60, 30],

  /** Error pattern — double buzz */
  error: Platform.OS === 'android' ? [0, 80, 100, 80] : [0, 60, 80, 60],

  /** Notification — gentle pulse */
  notification: Platform.OS === 'android' ? [0, 20, 40, 20] : [0, 15, 30, 15],
} as const;

type HapticType = keyof typeof PATTERNS;

// ─── Haptic Feedback ───────────────────────────────────────

/**
 * Trigger haptic feedback if enabled in settings.
 *
 * @param type - The haptic pattern to play
 *
 * @example
 * haptic('micTap');     // User taps mic button
 * haptic('recognized'); // Voice command recognized
 * haptic('success');    // Action completed
 * haptic('error');      // Something went wrong
 */
export function haptic(type: HapticType): void {
  if (!isHapticsEnabled()) return;

  try {
    const pattern = PATTERNS[type];
    Vibration.vibrate(pattern);
  } catch (error) {
    // Vibration not available (e.g., emulator) — silently ignore
    console.debug('[VoiceFeedback] Vibration not available:', error);
  }
}

/**
 * Cancel any ongoing vibration.
 */
export function cancelHaptic(): void {
  try {
    Vibration.cancel();
  } catch {
    // Ignore
  }
}

// ─── Convenience Functions ─────────────────────────────────
// Named exports for cleaner code at call sites.

/** Mic button tapped — light feedback */
export function hapticMicTap(): void {
  haptic('micTap');
}

/** Listening started or command recognized */
export function hapticRecognized(): void {
  haptic('recognized');
}

/** Action completed successfully */
export function hapticSuccess(): void {
  haptic('success');
}

/** Error occurred */
export function hapticError(): void {
  haptic('error');
}

/** New notification or proactive card */
export function hapticNotification(): void {
  haptic('notification');
}

// ─── Audio Cues (Placeholder) ──────────────────────────────
// TODO: Add sound effects for listening start/stop in Week 3
// when we have the native audio module. For now, haptics only.
//
// Planned sounds:
// - Soft "pop" when mic starts listening
// - Subtle "ding" when speech recognized
// - These will be short .wav files in android/app/src/main/res/raw/

export default {
  haptic,
  cancelHaptic,
  hapticMicTap,
  hapticRecognized,
  hapticSuccess,
  hapticError,
  hapticNotification,
};
