// src/services/actions/index.ts
// NeuralOS Action Executor — bridges AI response actions to real device APIs
//
// When Claude returns ACTIONS: JSON, the parsed actions land here.
// This module interprets the command string and dispatches to the
// appropriate native service (notifications, etc).

import { Linking } from 'react-native';
import {
  showNotification,
  scheduleNotification,
  cancelAllNotifications,
} from '../notifications';

export interface ActionResult {
  success: boolean;
  message: string;
}

function parseDelaySeconds(value: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0) return 10;

  const lower = value.toLowerCase();
  if (lower.includes('m')) return num * 60;
  if (lower.includes('h')) return num * 3600;
  return num;
}

export async function executeAction(
  command: string,
  params?: Record<string, string>,
): Promise<ActionResult> {
  console.log('[ActionExecutor] Executing:', command, params);

  try {
    switch (command) {
      // ─── Notifications ────────────────────────────
      case 'send_notification':
      case 'notify':
      case 'show_notification': {
        const title = params?.title || 'NeuralOS';
        const body = params?.body || params?.message || 'Reminder';
        await showNotification(title, body);
        return { success: true, message: `Notification sent: ${title}` };
      }

      case 'schedule_notification':
      case 'set_reminder':
      case 'set_timer':
      case 'remind': {
        const title = params?.title || 'NeuralOS Reminder';
        const body = params?.body || params?.message || "Here's your reminder!";
        const delay = parseDelaySeconds(params?.delay || params?.seconds || '10');
        await scheduleNotification(title, body, delay);
        return { success: true, message: `Reminder set for ${delay}s from now` };
      }

      case 'cancel_notifications': {
        await cancelAllNotifications();
        return { success: true, message: 'All notifications cancelled' };
      }

      // ─── Email ─────────────────────────────────────
      case 'send_email':
      case 'compose_email':
      case 'email': {
        const to = params?.to || '';
        const subject = encodeURIComponent(params?.subject || '');
        const body = encodeURIComponent(params?.body || '');
        const url = `mailto:${to}?subject=${subject}&body=${body}`;
        await Linking.openURL(url);
        console.log('[ActionExecutor] Opened email compose:', to);
        return { success: true, message: `Email compose opened for ${to || 'new email'}` };
      }

      // ─── Phone Call ───────────────────────────────
      case 'call':
      case 'phone_call': {
        const number = params?.number || params?.to || '';
        await Linking.openURL(`tel:${number}`);
        return { success: true, message: `Calling ${number}` };
      }

      // ─── Open URL ─────────────────────────────────
      case 'open_url':
      case 'browse': {
        const link = params?.url || '';
        if (link) await Linking.openURL(link);
        return { success: true, message: `Opened ${link}` };
      }

      // ─── Unhandled ────────────────────────────────
      default:
        console.warn('[ActionExecutor] Unknown command:', command);
        return { success: false, message: `Command "${command}" not yet supported` };
    }
  } catch (error) {
    console.error('[ActionExecutor] Failed:', error);
    return {
      success: false,
      message: `Failed to execute: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
