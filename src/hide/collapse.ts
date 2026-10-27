/**
 * Turns a chat's messages into what one person sees once some members are
 * hidden for them. Pure: the same input always gives the same rows, so the
 * interface, the unread counter and notifications cannot disagree.
 */
import { isActive, type GroupMessage, type HideRule } from './model';

export interface ViewOptions {
  /** The viewer. Their own messages are never hidden. */
  me: string;
  now: number;
  rules: readonly HideRule[];
  /** Keys of hidden rows the viewer has opened to peek at. */
  expanded?: ReadonlySet<string>;
}

export interface QuoteView {
  messageId: string;
  from: string;
  /** The quoted message belongs to someone hidden: show a placeholder. */
  hidden: boolean;
  /** One-line preview of the quoted message, for when it is not hidden. */
  preview: string;
}

export type ChatItem =
  | {
      type: 'message';
      key: string;
      message: GroupMessage;
      /** Shown inside an opened hidden row: render it dimmed. */
      peek: boolean;
      /** From a hidden person but shown because it is addressed to the viewer. */
      addressedToMe: boolean;
      groupStart: boolean;
      groupEnd: boolean;
      quote?: QuoteView;
    }
  | {
      type: 'hidden';
      key: string;
      /** Distinct authors in order of first appearance. */
      authors: string[];
      messageIds: string[];
      count: number;
      expanded: boolean;
    };

function activeRules(options: ViewOptions): Map<string, HideRule> {
  const rules = new Map<string, HideRule>();
  for (const rule of options.rules) {
    if (rule.userId !== options.me && isActive(rule, options.now)) rules.set(rule.userId, rule);
  }
  return rules;
}

/** Whether one message is hidden for the viewer. */
export function isHiddenFor(message: GroupMessage, byId: ReadonlyMap<string, GroupMessage>, options: ViewOptions): boolean {
  return hiddenBy(message, byId, activeRules(options), options.me);
}

function hiddenBy(message: GroupMessage, byId: ReadonlyMap<string, GroupMessage>, rules: Map<string, HideRule>, me: string): boolean {
  const rule = rules.get(message.from);
  if (!rule) return false;
  return !(rule.showMentions && addressedTo(message, byId, me));
}

function addressedTo(message: GroupMessage, byId: ReadonlyMap<string, GroupMessage>, me: string): boolean {
  if (message.mentions?.includes(me)) return true;
  const target = message.replyTo ? byId.get(message.replyTo) : undefined;
  return target?.from === me;
}

export function buildChatItems(messages: readonly GroupMessage[], options: ViewOptions): ChatItem[] {
  const rules = activeRules(options);
  const byId = new Map(messages.map((m) => [m.id, m]));
  const items: ChatItem[] = [];
  let stretch: { message: GroupMessage; peek: boolean }[] = [];
  let run: GroupMessage[] = [];

  // A run of consecutive hidden messages, from one or several hidden people,
  // becomes a single row; opened, it is followed by its messages, dimmed.
  const closeRun = () => {
    if (!run.length) return;
    const key = `hidden:${run[0]!.id}`;
    const expanded = !!options.expanded?.has(key);
    items.push({
      type: 'hidden',
      key,
      authors: [...new Set(run.map((m) => m.from))],
      messageIds: run.map((m) => m.id),
      count: run.length,
      expanded,
    });
    if (expanded) flushMessages(items, run.map((message) => ({ message, peek: true })), byId, rules, options.me);
    run = [];
  };

  for (const message of messages) {
    if (hiddenBy(message, byId, rules, options.me)) {
      flushMessages(items, stretch, byId, rules, options.me);
      stretch = [];
      run.push(message);
    } else {
      closeRun();
      stretch.push({ message, peek: false });
    }
  }
  flushMessages(items, stretch, byId, rules, options.me);
  closeRun();
  return items;
}

/** Emits a stretch of consecutive message bubbles with Telegram-style grouping. */
function flushMessages(
  items: ChatItem[],
  stretch: { message: GroupMessage; peek: boolean }[],
  byId: ReadonlyMap<string, GroupMessage>,
  rules: Map<string, HideRule>,
  me: string,
): void {
  stretch.forEach(({ message, peek }, index) => {
    const previous = stretch[index - 1]?.message;
    const next = stretch[index + 1]?.message;
    const target = message.replyTo ? byId.get(message.replyTo) : undefined;
    items.push({
      type: 'message',
      key: message.id,
      message,
      peek,
      addressedToMe: !peek && rules.has(message.from) && message.from !== me,
      groupStart: !previous || previous.from !== message.from,
      groupEnd: !next || next.from !== message.from,
      ...(target
        ? { quote: { messageId: target.id, from: target.from, hidden: hiddenBy(target, byId, rules, me), preview: previewOf(target) } }
        : {}),
    });
  });
}

/** Unread messages the viewer would actually see (and be notified about). */
export function countUnread(messages: readonly GroupMessage[], lastReadIndex: number, options: ViewOptions): number {
  const rules = activeRules(options);
  const byId = new Map(messages.map((m) => [m.id, m]));
  let count = 0;
  for (let i = lastReadIndex + 1; i < messages.length; i++) {
    const message = messages[i]!;
    if (message.from !== options.me && !hiddenBy(message, byId, rules, options.me)) count++;
  }
  return count;
}

/** Whether a newly arrived message should notify the viewer. */
export function shouldNotify(message: GroupMessage, messages: readonly GroupMessage[], options: ViewOptions): boolean {
  if (message.from === options.me) return false;
  const byId = new Map(messages.map((m) => [m.id, m]));
  byId.set(message.id, message);
  return !hiddenBy(message, byId, activeRules(options), options.me);
}

function previewOf(message: GroupMessage): string {
  switch (message.content.kind) {
    case 'text':
      return message.content.text;
    case 'voice':
      return 'Voice message';
    case 'photo':
      return message.content.caption ?? 'Photo';
    case 'sticker':
      return 'Sticker';
  }
}
