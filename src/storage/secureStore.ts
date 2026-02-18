// src/storage/secureStore.ts
// NeuralOS Secure Storage — MMKV wrapper for API keys and settings
//
// INSTALL: npm install react-native-mmkv
// NOTE: MMKV requires native linking. After install:
//   cd android && ./gradlew clean && cd ..
//   npx react-native run-android

import { createMMKV } from 'react-native-mmkv';

// ─── Storage Instance ──────────────────────────────────────
// MMKV is encrypted by default on Android (uses Android Keystore).
// This is safer than AsyncStorage for sensitive data like API keys.

const storage = createMMKV({
  id: 'neuralos-secure',
  // Encryption key adds an extra layer. In production, derive this
  // from a user PIN or biometric. For dev, a static key is fine.
  encryptionKey: 'neuralos-dev-key-2026',
});

// ─── Storage Keys ──────────────────────────────────────────

const KEYS = {
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  CLAUDE_MODEL: 'claude_model',
  MAX_TOKENS: 'max_tokens',
  TEMPERATURE: 'temperature',
  VOICE_ENABLED: 'voice_enabled',
  TTS_ENABLED: 'tts_enabled',
  HAPTICS_ENABLED: 'haptics_enabled',
  ONBOARDING_COMPLETE: 'onboarding_complete',
} as const;

// ─── API Key Management ────────────────────────────────────

/**
 * Store the Anthropic API key securely.
 * Call this from the onboarding/settings screen.
 */
export function setApiKey(key: string): void {
  if (!key || !key.startsWith('sk-ant-')) {
    throw new Error(
      'Invalid API key format. Anthropic keys start with "sk-ant-".',
    );
  }
  storage.set(KEYS.ANTHROPIC_API_KEY, key);
}

/**
 * Retrieve the stored API key.
 * Returns undefined if no key has been set.
 */
export function getApiKey(): string | undefined {
  return storage.getString(KEYS.ANTHROPIC_API_KEY);
}

/**
 * Check if an API key has been configured.
 */
export function hasApiKey(): boolean {
  const key = storage.getString(KEYS.ANTHROPIC_API_KEY);
  return !!key && key.length > 0;
}

/**
 * Remove the stored API key (for logout or reset).
 */
export function clearApiKey(): void {
  storage.remove(KEYS.ANTHROPIC_API_KEY);
}

// ─── AI Settings ───────────────────────────────────────────

export type ClaudeModelSetting =
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'claude-haiku-4-5-20251001';

const DEFAULTS = {
  model: 'claude-sonnet-4-20250514' as ClaudeModelSetting,
  maxTokens: 1024,
  temperature: 0.7,
  voiceEnabled: true,
  ttsEnabled: true,
  hapticsEnabled: true,
};

export function getModel(): ClaudeModelSetting {
  return (
    (storage.getString(KEYS.CLAUDE_MODEL) as ClaudeModelSetting) ??
    DEFAULTS.model
  );
}

export function setModel(model: ClaudeModelSetting): void {
  storage.set(KEYS.CLAUDE_MODEL, model);
}

export function getMaxTokens(): number {
  return storage.getNumber(KEYS.MAX_TOKENS) ?? DEFAULTS.maxTokens;
}

export function setMaxTokens(tokens: number): void {
  storage.set(KEYS.MAX_TOKENS, Math.min(Math.max(tokens, 256), 4096));
}

export function getTemperature(): number {
  return storage.getNumber(KEYS.TEMPERATURE) ?? DEFAULTS.temperature;
}

export function setTemperature(temp: number): void {
  storage.set(KEYS.TEMPERATURE, Math.min(Math.max(temp, 0), 1));
}

// ─── Feature Flags ─────────────────────────────────────────

export function isVoiceEnabled(): boolean {
  return storage.getBoolean(KEYS.VOICE_ENABLED) ?? DEFAULTS.voiceEnabled;
}

export function setVoiceEnabled(enabled: boolean): void {
  storage.set(KEYS.VOICE_ENABLED, enabled);
}

export function isTTSEnabled(): boolean {
  return storage.getBoolean(KEYS.TTS_ENABLED) ?? DEFAULTS.ttsEnabled;
}

export function setTTSEnabled(enabled: boolean): void {
  storage.set(KEYS.TTS_ENABLED, enabled);
}

export function isHapticsEnabled(): boolean {
  return storage.getBoolean(KEYS.HAPTICS_ENABLED) ?? DEFAULTS.hapticsEnabled;
}

export function setHapticsEnabled(enabled: boolean): void {
  storage.set(KEYS.HAPTICS_ENABLED, enabled);
}

// ─── Onboarding ────────────────────────────────────────────

export function isOnboardingComplete(): boolean {
  return storage.getBoolean(KEYS.ONBOARDING_COMPLETE) ?? false;
}

export function setOnboardingComplete(complete: boolean): void {
  storage.set(KEYS.ONBOARDING_COMPLETE, complete);
}

// ─── Utilities ─────────────────────────────────────────────

/**
 * Get all current settings as a plain object.
 * Useful for debugging or the settings screen.
 */
export function getAllSettings() {
  return {
    hasApiKey: hasApiKey(),
    model: getModel(),
    maxTokens: getMaxTokens(),
    temperature: getTemperature(),
    voiceEnabled: isVoiceEnabled(),
    ttsEnabled: isTTSEnabled(),
    hapticsEnabled: isHapticsEnabled(),
    onboardingComplete: isOnboardingComplete(),
  };
}

/**
 * Reset all settings to defaults. Does NOT clear the API key.
 */
export function resetSettings(): void {
  storage.remove(KEYS.CLAUDE_MODEL);
  storage.remove(KEYS.MAX_TOKENS);
  storage.remove(KEYS.TEMPERATURE);
  storage.remove(KEYS.VOICE_ENABLED);
  storage.remove(KEYS.TTS_ENABLED);
  storage.remove(KEYS.HAPTICS_ENABLED);
}

/**
 * Nuclear option — clear everything including API key.
 */
export function clearAllData(): void {
  storage.clearAll();
}

export default storage;
