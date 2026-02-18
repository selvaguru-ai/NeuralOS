// src/components/MessageBubble.tsx
// NeuralOS Message Bubble — User and AI message display
//
// User bubble: right-aligned, purple gradient, optional 🎤 Voice badge
// AI bubble: left-aligned, with ✦ avatar, supports streaming cursor

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import type { InputMethod } from '../services/ai/types';

// ─── User Bubble ───────────────────────────────────────────

interface UserBubbleProps {
  text: string;
  inputMethod?: InputMethod;
  timestamp?: string;
}

export function UserBubble({
  text,
  inputMethod = 'text',
  timestamp,
}: UserBubbleProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.userContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.userBubble}>
        {inputMethod === 'voice' && (
          <View style={styles.voiceBadge}>
            <Text style={styles.voiceBadgeIcon}>🎤</Text>
            <Text style={styles.voiceBadgeText}>Voice</Text>
          </View>
        )}
        <Text style={styles.userText}>{text}</Text>
      </View>
      {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
    </Animated.View>
  );
}

// ─── AI Bubble ─────────────────────────────────────────────

interface AIBubbleProps {
  children: React.ReactNode;
  isStreaming?: boolean;
  timestamp?: string;
}

export function AIBubble({
  children,
  isStreaming = false,
  timestamp,
}: AIBubbleProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Avatar glow when streaming
  useEffect(() => {
    if (isStreaming) {
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      glow.start();
      return () => glow.stop();
    } else {
      glowAnim.setValue(0.3);
    }
  }, [isStreaming, glowAnim]);

  return (
    <Animated.View
      style={[
        styles.aiContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* AI Avatar */}
      <Animated.View style={[styles.aiAvatar, { opacity: glowAnim }]}>
        <View style={styles.aiAvatarInner}>
          <Text style={styles.aiAvatarIcon}>✦</Text>
        </View>
      </Animated.View>

      {/* Content */}
      <View style={styles.aiContent}>
        {children}
        {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
      </View>
    </Animated.View>
  );
}

// ─── AI Text (with optional streaming cursor) ──────────────

interface AITextProps {
  text: string;
  isStreaming?: boolean;
}

export function AIText({ text, isStreaming = false }: AITextProps) {
  const cursorAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isStreaming) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(cursorAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );
      blink.start();
      return () => blink.stop();
    }
  }, [isStreaming, cursorAnim]);

  return (
    <View style={styles.aiTextContainer}>
      <Text style={styles.aiText}>
        {text}
        {isStreaming && (
          <Text> </Text>
        )}
      </Text>
      {isStreaming && (
        <Animated.View
          style={[styles.streamingCursor, { opacity: cursorAnim }]}
        />
      )}
    </View>
  );
}

// ─── Typing Indicator ──────────────────────────────────────

export function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingContainer}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { opacity: dot }]}
        />
      ))}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  // User bubble
  userContainer: {
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: '#6C63FF',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    opacity: 0.7,
  },
  voiceBadgeIcon: {
    fontSize: 10,
  },
  voiceBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
  },

  // AI bubble
  aiContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginVertical: 4,
  },
  aiAvatar: {
    marginTop: 2,
  },
  aiAvatarInner: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatarIcon: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  aiContent: {
    flex: 1,
    maxWidth: '85%',
  },
  aiTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  aiText: {
    color: '#E8E8F0',
    fontSize: 15,
    lineHeight: 22,
  },
  streamingCursor: {
    width: 2,
    height: 16,
    backgroundColor: '#6C63FF',
    borderRadius: 1,
    marginLeft: 2,
  },

  // Shared
  timestamp: {
    color: '#555577',
    fontSize: 11,
    marginTop: 4,
  },

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6C63FF',
  },
});
