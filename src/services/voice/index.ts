// src/services/voice/index.ts
// NeuralOS Voice Services — barrel export

export { speechRecognition, default } from './speechRecognition';
export type { VoiceState, VoiceError } from './speechRecognition';

export {
  haptic,
  cancelHaptic,
  hapticMicTap,
  hapticRecognized,
  hapticSuccess,
  hapticError,
  hapticNotification,
} from './voiceFeedback';
