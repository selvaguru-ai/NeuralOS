// src/components/VoiceMicButton.tsx
// NeuralOS Mic Button — Three states: idle, listening, processing
//
// Idle: dark circle with mic icon
// Listening: pulsing accent circle with ripple rings
// Processing: subtle pulse while waiting for final result

import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Animated,
  StyleSheet,
} from 'react-native';
import type { VoiceState } from '../services/voice/speechRecognition';

interface VoiceMicButtonProps {
  voiceState: VoiceState;
  onPress: () => void;
  size?: number;
}

// Mic SVG as a simple View-based icon (no SVG dependency needed)
function MicIcon({ color, size }: { color: string; size: number }) {
  const scale = size / 24;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Mic body */}
      <View
        style={{
          width: 8 * scale,
          height: 14 * scale,
          borderRadius: 4 * scale,
          backgroundColor: color,
          position: 'absolute',
          top: 2 * scale,
        }}
      />
      {/* Mic base arc */}
      <View
        style={{
          width: 16 * scale,
          height: 10 * scale,
          borderRadius: 8 * scale,
          borderWidth: 2 * scale,
          borderColor: color,
          borderTopWidth: 0,
          position: 'absolute',
          top: 10 * scale,
        }}
      />
      {/* Mic stand */}
      <View
        style={{
          width: 2 * scale,
          height: 4 * scale,
          backgroundColor: color,
          position: 'absolute',
          top: 18 * scale,
        }}
      />
      {/* Mic base */}
      <View
        style={{
          width: 8 * scale,
          height: 2 * scale,
          borderRadius: 1 * scale,
          backgroundColor: color,
          position: 'absolute',
          top: 21 * scale,
        }}
      />
    </View>
  );
}

export default function VoiceMicButton({
  voiceState,
  onPress,
  size = 72,
}: VoiceMicButtonProps) {
  const isListening = voiceState === 'listening';
  const isProcessing = voiceState === 'processing';
  const isActive = isListening || isProcessing;

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ripple1Anim = useRef(new Animated.Value(0)).current;
  const ripple2Anim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the mic button
  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, pulseAnim]);

  // Ripple animations (listening only)
  useEffect(() => {
    if (isListening) {
      const ripple1 = Animated.loop(
        Animated.timing(ripple1Anim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      );

      const ripple2 = Animated.loop(
        Animated.sequence([
          Animated.delay(700),
          Animated.timing(ripple2Anim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );

      ripple1.start();
      ripple2.start();

      return () => {
        ripple1.stop();
        ripple2.stop();
        ripple1Anim.setValue(0);
        ripple2Anim.setValue(0);
      };
    } else {
      ripple1Anim.setValue(0);
      ripple2Anim.setValue(0);
    }
  }, [isListening, ripple1Anim, ripple2Anim]);

  // Processing opacity pulse
  useEffect(() => {
    if (isProcessing) {
      const opacity = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      opacity.start();
      return () => opacity.stop();
    } else {
      opacityAnim.setValue(1);
    }
  }, [isProcessing, opacityAnim]);

  const rippleSize = size + 40;

  const rippleStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: rippleSize,
    height: rippleSize,
    borderRadius: rippleSize / 2,
    borderWidth: 2,
    borderColor: '#6C63FF',
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 0],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.2],
        }),
      },
    ],
  });

  return (
    <View style={[styles.container, { width: rippleSize * 2.5, height: rippleSize * 2.5 }]}>
      {/* Ripple rings */}
      {isListening && (
        <>
          <Animated.View style={rippleStyle(ripple1Anim)} />
          <Animated.View style={rippleStyle(ripple2Anim)} />
        </>
      )}

      {/* Main button */}
      <Animated.View
        style={{
          transform: [{ scale: pulseAnim }],
          opacity: isProcessing ? opacityAnim : 1,
        }}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: isActive ? '#6C63FF' : '#12122A',
              borderColor: isActive ? '#6C63FF' : 'rgba(108, 99, 255, 0.2)',
            },
          ]}
        >
          <MicIcon
            color={isActive ? '#FFFFFF' : '#8888AA'}
            size={size * 0.36}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
});
