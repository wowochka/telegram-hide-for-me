/** Data shapes shared by the store, the chat model and the interface. */

export interface Member {
  id: string;
  name: string;
  /** Name colour in group bubbles (Telegram's peer colour palette). */
  color: string;
  /** Avatar gradient, top to bottom, for people without a photo. */
  avatar: [string, string];
  /** Profile photo, if they have one. */
  photo?: string;
}

export type MessageContent =
  | { kind: 'text'; text: string }
  | { kind: 'sticker'; sticker: string }
  | { kind: 'voice'; seconds: number }
  | { kind: 'photo'; src: string; width: number; height: number; caption?: string };

export interface GroupMessage {
  id: string;
  from: string;
  sentAt: number;
  content: MessageContent;
  /** Id of the message this one replies to. */
  replyTo?: string;
  /** Ids of members mentioned with @. */
  mentions?: string[];
}

export type HideDuration = 'hour' | 'today' | 'always';

/**
 * "Hide <person> for me" in one chat. Personal and local: nobody else, the
 * hidden person included, can see that it exists.
 */
export interface HideRule {
  chatId: string;
  userId: string;
  since: number;
  /** Epoch ms when the rule lapses; `null` for "always". */
  until: number | null;
  /** Keep showing their messages that mention or reply to me. */
  showMentions: boolean;
}

export function isActive(rule: HideRule, now: number): boolean {
  return rule.until === null || now < rule.until;
}

/** When a hide chosen at `now` for `duration` should lapse. */
export function untilFor(duration: HideDuration, now: number): number | null {
  if (duration === 'always') return null;
  if (duration === 'hour') return now + 60 * 60 * 1000;
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return end.getTime();
}
