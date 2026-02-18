// src/components/WaveformVisualizer.tsx
// NeuralOS Waveform Visualizer — Animated bars during voice input
//
// Shows a row of animated bars that pulse when the user is speaking.
// Uses RN built-in Animated API (no Reanimated dependency).

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface WaveformVisualizerProps {
  isActive: boolean;
  barCount?: number;
  height?: number;
  color?: string;
}

function WaveformBar({
  isActive,
  index,
  totalBars,
  maxHeight,
  color,
}: {
  isActive: boolean;
  index: number;
  totalBars: number;
  maxHeight: number;
  color: string;
}) {
  const heightAnim = useRef(new Animated.Value(4)).current;

  // Each bar gets a slightly different animation speed and delay
  // for a natural, organic look
  const center = totalBars / 2;
  const distFromCenter = Math.abs(index - center) / center;
  const barMaxHeight = maxHeight - distFromCenter * (maxHeight * 0.6);
  const duration = 300 + Math.random() * 400;
  const delay = Math.sin(index * 0.8) * 150;

  useEffect(() => {
    if (isActive) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(heightAnim, {
            toValue: barMaxHeight,
            duration,
            delay: Math.max(0, delay),
            useNativeDriver: false, // height can't use native driver
          }),
          Animated.timing(heightAnim, {
            toValue: 6,
            duration: duration * 0.8,
            useNativeDriver: false,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      Animated.timing(heightAnim, {
        toValue: 4,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isActive, heightAnim, barMaxHeight, duration, delay]);

  return (
    <Animated.View
      style={{
        width: 3,
        height: heightAnim,
        borderRadius: 1.5,
        backgroundColor: color,
        opacity: 0.5 + (1 - distFromCenter) * 0.5,
      }}
    />
  );
}

export default function WaveformVisualizer({
  isActive,
  barCount = 20,
  height = 40,
  color = '#6C63FF',
}: WaveformVisualizerProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Fade in/out
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isActive ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isActive, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        { height, opacity: opacityAnim },
      ]}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <WaveformBar
          key={i}
          isActive={isActive}
          index={i}
          totalBars={barCount}
          maxHeight={height}
          color={color}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
});
