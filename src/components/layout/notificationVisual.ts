import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, type LucideIcon } from 'lucide-react';
import { Notification } from '../../types';

// One icon + tint per notification, shared by the bell panel and the corner toast. Tone comes from
// the notification's own type (warning = amber, success = green, info = brand orange, reusing the
// on-hold/completed status pill pairs from statusMeta.ts); meeting notifications swap in a calendar
// icon so they read apart from task ones at a glance. Icon colors are the darker shade of each
// pair so the glyph keeps ≥3:1 against its tint.
export function getNotificationVisual(n: Notification): { Icon: LucideIcon; bg: string; fg: string } {
  const isMeeting = n.title.includes('ประชุม');
  if (n.type === 'warning') return { Icon: isMeeting ? CalendarClock : AlertTriangle, bg: '#FEF3C7', fg: '#B45309' };
  if (n.type === 'success') return { Icon: CheckCircle2, bg: '#DCFCE7', fg: '#197A4B' };
  return { Icon: isMeeting ? CalendarClock : ClipboardList, bg: '#FFF1EC', fg: '#E04D1D' };
}
