// src/components/ActionButton.tsx
// NeuralOS Action Button — Tappable actions in AI responses
//
// Variants: primary (accent), success (green), warning (orange), danger (red), default (outline)
// Used for: Turn Off, Undo, Send, Edit, Compare, etc.

import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import type { ResponseAction } from '../services/ai/types';

interface ActionButtonProps {
  label: string;
  command: string;
  variant?: ResponseAction['variant'];
  icon?: string;
  onPress: (command: string) => void;
  disabled?: boolean;
}

const VARIANT_COLORS = {
  default: {
    bg: 'transparent',
    bgActive: '#1A1A3E',
    border: 'rgba(108, 99, 255, 0.15)',
    text: '#E8E8F0',
  },
  primary: {
    bg: 'rgba(108, 99, 255, 0.12)',
    bgActive: '#6C63FF',
    border: 'rgba(108, 99, 255, 0.4)',
    text: '#6C63FF',
  },
  success: {
    bg: 'rgba(76, 175, 80, 0.12)',
    bgActive: '#4CAF50',
    border: 'rgba(76, 175, 80, 0.3)',
    text: '#4CAF50',
  },
  warning: {
    bg: 'rgba(255, 152, 0, 0.12)',
    bgActive: '#FF9800',
    border: 'rgba(255, 152, 0, 0.3)',
    text: '#FF9800',
  },
  danger: {
    bg: 'rgba(255, 82, 82, 0.1)',
    bgActive: '#FF5252',
    border: 'rgba(255, 82, 82, 0.3)',
    text: '#FF5252',
  },
};

export default function ActionButton({
  label,
  command,
  variant = 'default',
  icon,
  onPress,
  disabled = false,
}: ActionButtonProps) {
  const [pressed, setPressed] = useState(false);
  const colors = VARIANT_COLORS[variant];

  return (
    <TouchableOpacity
      onPress={() => onPress(command)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      activeOpacity={0.7}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: pressed ? colors.bgActive : colors.bg,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text
        style={[
          styles.label,
          { color: pressed ? '#FFFFFF' : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Action Button Row ─────────────────────────────────────
// Renders a row of action buttons from parsed AI response

interface ActionButtonRowProps {
  actions: ResponseAction[];
  onAction: (command: string) => void;
}

export function ActionButtonRow({ actions, onAction }: ActionButtonRowProps) {
  if (actions.length === 0) return null;

  return (
    <View style={styles.row}>
      {actions.map((action, index) => (
        <ActionButton
          key={`${action.command}-${index}`}
          label={action.label}
          command={action.command}
          variant={action.variant}
          icon={action.icon}
          onPress={onAction}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  icon: {
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
});
