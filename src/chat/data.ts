/**
 * The demo group: who is in it and what they said. Everyone except the viewer
 * is scripted; the hiding itself is the real feature code in src/hide.
 */
import type { GroupMessage, Member } from '../hide/model';

export const ME = 'alex';
export const CHAT_ID = 'lisbon-trip';
export const CHAT_TITLE = 'Lisbon Trip';

/** Telegram's peer colours, tuned for the dark theme. */
export const MEMBERS: Record<string, Member> = {
  alex: { id: 'alex', name: 'Alex', color: '#5eb5ff', avatar: ['#6ec6ff', '#3d8ef0'] },
  lena: { id: 'lena', name: 'Lena Park', color: '#ff9a62', avatar: ['#ffbe7a', '#ff7f5a'] },
  max: { id: 'max', name: 'Max', color: '#b394ff', avatar: ['#b8a2ff', '#7c64f5'], photo: '/photos/max.jpg' },
  dan: { id: 'dan', name: 'Dan Wu', color: '#5fd37a', avatar: ['#8fe49a', '#3cbf63'], photo: '/photos/dan.jpg' },
  sophie: { id: 'sophie', name: 'Sophie', color: '#ff7aa8', avatar: ['#ff9dc0', '#f2608f'], photo: '/photos/sophie.jpg' },
};

export const MEMBER_COUNT = 5;

/** 09:41 on the demo day. */
export const BASE_TIME = new Date(2026, 9, 24, 9, 41, 0).getTime();

let counter = 0;
const at = (minutesAgo: number) => BASE_TIME - minutesAgo * 60_000;
const text = (from: string, body: string, minutesAgo: number, extra: Partial<GroupMessage> = {}): GroupMessage => ({
  id: `s${++counter}`,
  from,
  sentAt: at(minutesAgo),
  content: { kind: 'text', text: body },
  ...extra,
});

/** What is already in the chat when it opens. */
export function seedMessages(): GroupMessage[] {
  counter = 0;
  const list: GroupMessage[] = [
    text('lena', 'Okay, final plan for Saturday', 18),
    text('lena', 'Train leaves at 9:40 from platform 4. Tickets are pinned.', 18),
    text('max', 'guys', 17),
    text('max', 'GUYS', 17),
    text('max', 'has anyone seen the new season', 17),
    { id: `s${++counter}`, from: 'max', sentAt: at(16), content: { kind: 'voice', seconds: 47 } },
    text('dan', 'Max, focus. Who is bringing the speaker?', 15),
    text('max', 'not me lol', 15),
    text('max', 'wait what time again', 14),
    text('sophie', '9:40. It is literally pinned.', 13),
    text('max', 'ok ok', 13),
    {
      id: `s${++counter}`,
      from: 'max',
      sentAt: at(12),
      content: { kind: 'photo', src: '/photos/nata.jpg', width: 1280, height: 1707, caption: 'we HAVE to try these' },
    },
  ];
  const speaker = text('alex', 'I’ll bring the speaker', 11);
  list.push(speaker);
  list.push(text('max', 'legend', 10));
  return list;
}

/**
 * What arrives while the chat is open, in order, with the pause before each.
 * Used by the demo page and the video take.
 */
export interface ScriptedMessage {
  delay: number;
  build(history: GroupMessage[]): GroupMessage;
}

let live = 0;
const liveText = (from: string, body: string, extra: Partial<GroupMessage> = {}) => (): GroupMessage => ({
  id: `l${++live}`,
  from,
  sentAt: BASE_TIME,
  content: { kind: 'text', text: body },
  ...extra,
});

export const FLOOD: ScriptedMessage[] = [
  { delay: 700, build: liveText('max', 'lol') },
  { delay: 650, build: liveText('max', 'guys did you see this') },
  { delay: 600, build: () => ({ id: `l${++live}`, from: 'max', sentAt: BASE_TIME, content: { kind: 'voice', seconds: 12 } }) },
  { delay: 650, build: liveText('max', 'which platform again') },
  { delay: 700, build: liveText('max', 'brb') },
];

export const AFTER_HIDE: ScriptedMessage[] = [
  { delay: 900, build: liveText('max', 'ok im back') },
  { delay: 800, build: liveText('max', 'what did i miss') },
  { delay: 1100, build: liveText('lena', '@alex can you grab croissants on the way?', { mentions: ['alex'] }) },
  {
    delay: 1200,
    build: (history) => {
      const speaker = history.find((m) => m.from === 'alex' && m.content.kind === 'text');
      return { id: `l${++live}`, from: 'max', sentAt: BASE_TIME, content: { kind: 'text', text: 'Alex you’re the best' }, ...(speaker ? { replyTo: speaker.id } : {}) };
    },
  },
  { delay: 700, build: liveText('max', 'also lol') },
];

export function resetScript(): void {
  live = 0;
}
