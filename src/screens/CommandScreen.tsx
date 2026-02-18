// src/screens/CommandScreen.tsx
// NeuralOS Command Screen — Voice-First Chat Interface
//
// This is the main interaction screen. User arrives here by tapping
// the command bar on the HomeScreen.
//
// Layout:
// ┌──────────────────────────┐
// │ ← NeuralOS    Online   ⋯│  ← Nav header
// ├──────────────────────────┤
// │                          │
// │  [User bubble]           │  ← Message list (FlatList)
// │       [AI response card] │
// │  [User bubble]           │
// │       [AI streaming...]  │
// │                          │
// ├──────────────────────────┤
// │  🎤 Voice / ⌨️ Type     │  ← Input area (voice-first)
// └──────────────────────────┘

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  BackHandler,
} from 'react-native';

// Hooks
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useStreamingResponse } from '../hooks/useStreamingResponse';

// Components
import VoiceMicButton from '../components/VoiceMicButton';
import WaveformVisualizer from '../components/WaveformVisualizer';
import LiveTranscript from '../components/LiveTranscript';
import { UserBubble, AIBubble, AIText, TypingIndicator } from '../components/MessageBubble';
import ResponseCard from '../components/ResponseCard';
import ActionButton, { ActionButtonRow } from '../components/ActionButton';

// Types
import type { InputMethod, ResponseAction } from '../services/ai/types';

// ─── Message Types ─────────────────────────────────────────

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  text: string;
  inputMethod?: InputMethod;
  actions?: ResponseAction[];
  cardTitle?: string;
  cardIcon?: string;
  cardColor?: string;
  timestamp: string;
  isStreaming?: boolean;
}

// ─── Navigation Props ──────────────────────────────────────
// If using React Navigation, accept navigation prop.
// If not using navigation yet, this screen can be shown/hidden via state.

interface CommandScreenProps {
  onBack?: () => void;
}

// ─── Helper ────────────────────────────────────────────────

function getTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}-${Date.now()}`;
}

// ─── Command Screen ────────────────────────────────────────

export default function CommandScreen({ onBack }: CommandScreenProps) {
  // Input mode: voice (default) or text
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);

  // Streaming hook
  const {
    isStreaming,
    isComplete,
    displayText,
    error: streamError,
    actions,
    cardHeader,
    sendMessage: streamSendMessage,
    cancelStream,
  } = useStreamingResponse();

  // Voice hook
  const voice = useVoiceInput({
    onFinalResult: (transcript) => {
      handleSendMessage(transcript, 'voice');
    },
    onError: (err) => {
      if (err.suggestTyping) {
        setInputMode('text');
      }
    },
  });

  // ─── Handle sending a message ──────────────────────────

  const handleSendMessage = useCallback(
    async (text: string, method: InputMethod) => {
      if (!text.trim()) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: nextId(),
        type: 'user',
        text: text.trim(),
        inputMethod: method,
        timestamp: getTimestamp(),
      };

      // Add placeholder AI message (will be updated during streaming)
      const aiMsg: ChatMessage = {
        id: nextId(),
        type: 'ai',
        text: '',
        timestamp: getTimestamp(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);

      // Clear text input
      setTextInput('');

      // Send to Claude
      await streamSendMessage(text, method);
    },
    [streamSendMessage],
  );

  // ─── Update AI message during streaming ────────────────

  useEffect(() => {
    if (displayText || isComplete || streamError) {
      setMessages((prev) => {
        const updated = [...prev];
        // Find the last AI message (the one being streamed)
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'ai' && updated[i].isStreaming) {
            updated[i] = {
              ...updated[i],
              text: displayText,
              isStreaming: !isComplete && !streamError,
              actions: isComplete ? actions : undefined,
              cardTitle: cardHeader?.title,
              cardIcon: cardHeader?.icon,
              cardColor: cardHeader?.accentColor,
            };
            break;
          }
        }
        return updated;
      });
    }
  }, [displayText, isComplete, streamError, actions, cardHeader]);

  // ─── Update AI message on error ────────────────────────

  useEffect(() => {
    if (streamError) {
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'ai' && updated[i].isStreaming) {
            updated[i] = {
              ...updated[i],
              text: streamError.message,
              isStreaming: false,
            };
            break;
          }
        }
        return updated;
      });
    }
  }, [streamError]);

  // ─── Scroll to bottom on new messages ──────────────────

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, displayText]);

  // ─── Handle text submit ────────────────────────────────

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      handleSendMessage(textInput, 'text');
    }
  };

  // ─── Handle action button press ────────────────────────

  const handleAction = useCallback(
    (command: string) => {
      // Send the action command as a new message
      handleSendMessage(command, 'text');
    },
    [handleSendMessage],
  );

  // ─── Hardware back button ──────────────────────────────

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isStreaming) {
        cancelStream();
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [isStreaming, cancelStream, onBack]);

  // ─── Render message item ───────────────────────────────

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.type === 'user') {
      return (
        <UserBubble
          text={item.text}
          inputMethod={item.inputMethod}
          timestamp={item.timestamp}
        />
      );
    }

    // AI message
    return (
      <AIBubble isStreaming={item.isStreaming} timestamp={item.timestamp}>
        {/* Typing indicator when waiting for first token */}
        {item.isStreaming && !item.text && <TypingIndicator />}

        {/* Response content */}
        {item.text ? (
          item.cardTitle ? (
            // Structured card response
            <ResponseCard
              title={item.cardTitle}
              icon={item.cardIcon}
              accentColor={item.cardColor}
            >
              <AIText text={item.text} isStreaming={item.isStreaming} />
              {item.actions && (
                <ActionButtonRow actions={item.actions} onAction={handleAction} />
              )}
            </ResponseCard>
          ) : (
            // Plain text response
            <View>
              <AIText text={item.text} isStreaming={item.isStreaming} />
              {item.actions && (
                <ActionButtonRow actions={item.actions} onAction={handleAction} />
              )}
            </View>
          )
        ) : null}
      </AIBubble>
    );
  };

  // ─── Render ────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" translucent />

      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerText}>NeuralOS</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online · Ready</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 28 }}>✦</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {inputMode === 'voice' ? 'Tap the mic to speak' : 'Type a command'}
            </Text>
            <Text style={styles.emptySubtitle}>
              Try "Turn on flashlight" or "What can you do?"
            </Text>
          </View>
        }
      />

      {/* Input Area */}
      <View style={styles.inputArea}>
        {inputMode === 'voice' ? (
          // ─── Voice Input Mode ──────────────────────────
          <View style={styles.voiceInputContainer}>
            {/* Live transcript */}
            <LiveTranscript
              text={voice.transcript}
              isListening={voice.isListening}
            />

            {/* Waveform */}
            <WaveformVisualizer isActive={voice.isListening} />

            {/* Controls row */}
            <View style={styles.voiceControls}>
              {/* Type button */}
              <TouchableOpacity
                onPress={() => {
                  voice.cancelListening();
                  setInputMode('text');
                  setTimeout(() => textInputRef.current?.focus(), 100);
                }}
                style={styles.modeButton}
              >
                <Text style={styles.modeButtonIcon}>⌨</Text>
                <Text style={styles.modeButtonLabel}>Type</Text>
              </TouchableOpacity>

              {/* Mic button */}
              <VoiceMicButton
                voiceState={voice.voiceState}
                onPress={voice.toggleListening}
              />

              {/* Send / Cancel button */}
              <TouchableOpacity
                onPress={() => {
                  if (voice.isListening && voice.transcript) {
                    voice.stopListening();
                  } else if (voice.isListening) {
                    voice.cancelListening();
                  }
                }}
                style={styles.modeButton}
              >
                <Text style={styles.modeButtonIcon}>
                  {voice.isListening && voice.transcript ? '↑' : '✕'}
                </Text>
                <Text style={styles.modeButtonLabel}>
                  {voice.isListening && voice.transcript ? 'Send' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Voice error */}
            {voice.error && (
              <Text style={styles.voiceError}>{voice.error.message}</Text>
            )}

            {/* Hint text */}
            {!voice.isListening && !voice.isProcessing && (
              <Text style={styles.voiceHint}>Tap mic to speak</Text>
            )}
          </View>
        ) : (
          // ─── Text Input Mode ───────────────────────────
          <View style={styles.textInputContainer}>
            <View style={styles.textInputRow}>
              <TextInput
                ref={textInputRef}
                value={textInput}
                onChangeText={setTextInput}
                onSubmitEditing={handleTextSubmit}
                placeholder="Type a complex command..."
                placeholderTextColor="#555577"
                style={styles.textInput}
                returnKeyType="send"
                autoFocus
              />
              {/* Mic toggle */}
              <TouchableOpacity
                onPress={() => setInputMode('voice')}
                style={styles.inputIconButton}
              >
                <Text style={styles.inputIcon}>🎤</Text>
              </TouchableOpacity>
              {/* Send */}
              <TouchableOpacity
                onPress={handleTextSubmit}
                style={[
                  styles.sendButton,
                  { opacity: textInput.trim() ? 1 : 0.4 },
                ]}
                disabled={!textInput.trim()}
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Home indicator bar */}
      <View style={styles.homeIndicator} />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 40 : 50,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#12122A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#8888AA',
    fontSize: 18,
  },
  headerTitle: {
    flex: 1,
  },
  headerText: {
    color: '#E8E8F0',
    fontSize: 17,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 12,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#12122A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    color: '#8888AA',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    marginHorizontal: 16,
  },

  // Message list
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#E8E8F0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#555577',
    fontSize: 14,
    textAlign: 'center',
  },

  // Input area
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(108, 99, 255, 0.15)',
    backgroundColor: '#0A0A1A',
  },

  // Voice input
  voiceInputContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  voiceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 4,
  },
  modeButton: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  modeButtonIcon: {
    fontSize: 20,
    color: '#8888AA',
    width: 44,
    height: 44,
    textAlign: 'center',
    lineHeight: 44,
    backgroundColor: '#12122A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
    overflow: 'hidden',
  },
  modeButtonLabel: {
    fontSize: 10,
    color: '#555577',
  },
  voiceError: {
    color: '#FF5252',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  voiceHint: {
    color: '#555577',
    fontSize: 13,
  },

  // Text input
  textInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12122A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
    paddingLeft: 16,
    paddingRight: 6,
    gap: 8,
  },
  textInput: {
    flex: 1,
    color: '#E8E8F0',
    fontSize: 15,
    paddingVertical: 12,
  },
  inputIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1A1A3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputIcon: {
    fontSize: 16,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // Home indicator
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#555577',
    alignSelf: 'center',
    marginBottom: 8,
    opacity: 0.5,
  },
});
