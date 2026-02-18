// src/components/LiveTranscript.tsx
// NeuralOS Live Transcript — Shows real-time speech-to-text
//
// Displays the partial transcription as the user speaks.
// Has a pulsing border to indicate "still listening" and a blinking cursor.

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface LiveTranscriptProps {
  text: string;
  isListening: boolean;
}

export default function LiveTranscript({
  text,
  isListening,
}: LiveTranscriptProps) {
  const borderAnim = useRef(new Animated.Value(0.3)).current;
  const cursorAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Show/hide animation
  const visible = isListening && text.length > 0;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  // Pulsing border
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(borderAnim, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(borderAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isListening, borderAnim]);

  // Blinking cursor
  useEffect(() => {
    if (isListening) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      blink.start();
      return () => blink.stop();
    }
  }, [isListening, cursorAnim]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0.3, 0.8],
    outputRange: ['rgba(108, 99, 255, 0.2)', 'rgba(108, 99, 255, 0.6)'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          borderColor,
        },
      ]}
    >
      <Text style={styles.quoteOpen}>"</Text>
      <Text style={styles.text}>{text}</Text>
      <Animated.View style={[styles.cursor, { opacity: cursorAnim }]} />
      <Text style={styles.quoteClose}>"</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#12122A',
    borderWidth: 1,
  },
  text: {
    color: '#E8E8F0',
    fontSize: 15,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  quoteOpen: {
    color: '#6C63FF',
    fontSize: 18,
    fontStyle: 'italic',
    marginRight: 2,
  },
  quoteClose: {
    color: '#6C63FF',
    fontSize: 18,
    fontStyle: 'italic',
    marginLeft: 2,
  },
  cursor: {
    width: 2,
    height: 16,
    backgroundColor: '#6C63FF',
    marginLeft: 2,
    borderRadius: 1,
  },
});
