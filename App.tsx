import React, { useState, useEffect } from 'react';
import { claudeClient } from './src/services/ai';
import { hasApiKey } from './src/storage/secureStore';
import CommandScreen from './src/screens/CommandScreen';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'command'>('home');
  const [commandBarFocused, setCommandBarFocused] = useState(false);
  const [commandText, setCommandText] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      if (hasApiKey()) {
        claudeClient.initialize();
        setIsReady(true);
        console.log('[App] Claude client initialized successfully');
      }
    } catch (err) {
      console.error('[App] Init failed:', err);
    }
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      );
      setCurrentDate(
        now.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show CommandScreen if active
  if (currentScreen === 'command') {
    return <CommandScreen onBack={() => setCurrentScreen('home')} />;
  }

  // Show HomeScreen
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Status Bar Area */}
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>{currentTime}</Text>
        <Text style={styles.statusText}>5G · 78%</Text>
      </View>

      <ScrollView
        style={styles.main}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Time & Avatar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.time}>{currentTime}</Text>
            <Text style={styles.date}>{currentDate}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>S</Text>
          </View>
        </View>

        {/* AI Insight Card */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={styles.insightLabelRow}>
              <View style={styles.pulse} />
              <Text style={styles.insightLabel}>NEURAL</Text>
            </View>
            <Text style={styles.insightTime}>2m ago</Text>
          </View>
          <Text style={styles.insightBody}>
            <Text style={styles.insightEm}>NVDA up 3.2%</Text> pre-market after
            earnings beat. Your trailing stop is 4% away — want to tighten it?
          </Text>
          <View style={styles.insightActions}>
            <TouchableOpacity style={styles.insightBtnPri}>
              <Text style={styles.insightBtnPriText}>Adjust stop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.insightBtnSec}>
              <Text style={styles.insightBtnSecText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Portfolio</Text>
            <Text style={styles.statValue}>$12.4k</Text>
            <Text style={styles.statChangeUp}>↑ 2.1% today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tasks</Text>
            <Text style={styles.statValue}>
              3<Text style={styles.statUnit}> active</Text>
            </Text>
            <Text style={styles.statChangeDown}>1 overdue</Text>
          </View>
        </View>

        {/* Agents Grid */}
        <View style={styles.agentsGrid}>
          {[
            { icon: '🌐', name: 'Browse' },
            { icon: '📈', name: 'Markets' },
            { icon: '⚡', name: 'Dev' },
            { icon: '🗂', name: 'Memory' },
          ].map((agent, index) => (
            <TouchableOpacity key={index} style={styles.agentCard}>
              <Text style={styles.agentIcon}>{agent.icon}</Text>
              <Text style={styles.agentName}>{agent.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.activityLabel}>RECENT</Text>
          {[
            {
              color: 'rgba(110, 200, 140, 0.5)',
              title: 'Portfolio rebalanced — 3 trades',
              sub: 'Markets agent',
              time: '2m',
            },
            {
              color: 'rgba(100, 150, 255, 0.5)',
              title: 'Tax doc from BMO downloaded',
              sub: 'Files agent',
              time: '1h',
            },
            {
              color: 'rgba(240, 180, 100, 0.5)',
              title: 'AAPL hit $195 price alert',
              sub: 'Markets agent',
              time: '3h',
            },
            {
              color: 'rgba(180, 140, 255, 0.5)',
              title: 'Weekly backup completed',
              sub: 'System',
              time: '5h',
            },
          ].map((item, index) => (
            <TouchableOpacity key={index} style={styles.activityItem}>
              <View
                style={[styles.activityDot, { backgroundColor: item.color }]}
              />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.activitySub}>{item.sub}</Text>
              </View>
              <Text style={styles.activityMeta}>{item.time}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Command Bar - Fixed at bottom */}
      <View style={styles.commandArea}>
        <TouchableOpacity
          style={[
            styles.commandBar,
            commandBarFocused && styles.commandBarFocused,
          ]}
          activeOpacity={1}
          onPress={() => setCurrentScreen('command')}
        >
          <View style={styles.cmdDot} />
          {commandBarFocused ? (
            <TextInput
              style={styles.cmdInput}
              placeholder="Ask anything..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={commandText}
              onChangeText={setCommandText}
              autoFocus
              onBlur={() => setCommandBarFocused(false)}
            />
          ) : (
            <Text style={styles.cmdText}>Ask anything...</Text>
          )}
          <View style={styles.cmdMic}>
            <Text style={styles.cmdMicIcon}>🎤</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.homeBar} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Status bar row
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 50,
    paddingBottom: 0,
  },
  statusText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.3)',
  },

  // Main scrollable area
  main: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
    marginBottom: 28,
  },
  time: {
    fontSize: 52,
    fontWeight: '200',
    letterSpacing: -2,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 56,
  },
  date: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.25)',
    marginTop: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },

  // AI Insight Card
  insightCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  insightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulse: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  insightLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.2)',
  },
  insightTime: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: 'rgba(255,255,255,0.12)',
  },
  insightBody: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 23,
  },
  insightEm: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '400',
  },
  insightActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  insightBtnPri: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  insightBtnPriText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  insightBtnSec: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  insightBtnSecText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '400',
  },
  statChangeUp: {
    fontSize: 11,
    color: 'rgba(110, 200, 140, 0.6)',
    marginTop: 4,
  },
  statChangeDown: {
    fontSize: 11,
    color: 'rgba(240, 120, 120, 0.6)',
    marginTop: 4,
  },

  // Agents Grid
  agentsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  agentCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  agentIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  agentName: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.2,
  },

  // Activity Section
  activitySection: {
    marginBottom: 16,
  },
  activityLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
  },
  activitySub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 2,
  },
  activityMeta: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: 'rgba(255,255,255,0.12)',
  },

  // Command Bar
  commandArea: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
  commandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  commandBarFocused: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cmdDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cmdText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.2)',
  },
  cmdInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.9)',
    padding: 0,
  },
  cmdMic: {
    opacity: 0.2,
  },
  cmdMicIcon: {
    fontSize: 16,
  },
  homeBar: {
    width: 134,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    alignSelf: 'center',
    marginTop: 12,
  },
});

export default App;
