// src/components/ResponseCard.tsx
// NeuralOS Response Card — Styled container for structured AI responses
//
// Used for system control confirmations, search results, message drafts, etc.
// Features: accent-colored top bar, icon + title header, content slot.

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface ResponseCardProps {
  title?: string;
  icon?: string;
  accentColor?: string;
  children: React.ReactNode;
}

export default function ResponseCard({
  title,
  icon,
  accentColor = '#6C63FF',
  children,
}: ResponseCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Accent top bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Header */}
      {title && (
        <View style={styles.header}>
          {icon && (
            <View style={[styles.iconContainer, { backgroundColor: accentColor + '20' }]}>
              <Text style={styles.icon}>{icon}</Text>
            </View>
          )}
          <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12122A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
    overflow: 'hidden',
    marginVertical: 4,
  },
  accentBar: {
    height: 2,
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 14,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
});
