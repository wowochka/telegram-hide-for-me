/**
 * The viewer's hide rules, kept on this device. Nothing here is ever sent to
 * the server or to the person being hidden.
 */
import { isActive, untilFor, type HideDuration, type HideRule } from './model';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'hide-for-me/v1';

export interface HideOptions {
  showMentions?: boolean;
}

export class HideStore {
  private rules: HideRule[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly storage: KeyValueStorage | null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly clock: () => number;

  constructor(storage: KeyValueStorage | null, clock: () => number = Date.now) {
    this.storage = storage;
    this.clock = clock;
    this.rules = this.load();
    this.scheduleExpiry();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getRules = (): readonly HideRule[] => this.rules;

  rulesFor(chatId: string): HideRule[] {
    const now = this.clock();
    return this.rules.filter((r) => r.chatId === chatId && isActive(r, now));
  }

  isHidden(chatId: string, userId: string): boolean {
    return this.rulesFor(chatId).some((r) => r.userId === userId);
  }

  hide(chatId: string, userId: string, duration: HideDuration, options: HideOptions = {}): HideRule {
    const now = this.clock();
    const rule: HideRule = {
      chatId,
      userId,
      since: now,
      until: untilFor(duration, now),
      showMentions: options.showMentions ?? true,
    };
    // Hiding again replaces the earlier rule instead of stacking a second one.
    this.rules = [...this.rules.filter((r) => !(r.chatId === chatId && r.userId === userId)), rule];
    this.commit();
    return rule;
  }

  unhide(chatId: string, userId: string): void {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => !(r.chatId === chatId && r.userId === userId));
    if (this.rules.length !== before) this.commit();
  }

  /** Puts back a rule exactly as it was (the toast's Undo after unhiding). */
  restore(rule: HideRule): void {
    this.rules = [...this.rules.filter((r) => !(r.chatId === rule.chatId && r.userId === rule.userId)), rule];
    this.commit();
  }

  destroy(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.listeners.clear();
  }

  private commit(): void {
    this.prune();
    this.save();
    this.scheduleExpiry();
    for (const listener of [...this.listeners]) listener();
  }

  private prune(): void {
    const now = this.clock();
    this.rules = this.rules.filter((r) => isActive(r, now));
  }

  /** Re-renders exactly when the next timed rule lapses, so messages return on time. */
  private scheduleExpiry(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    const next = Math.min(...this.rules.map((r) => r.until ?? Infinity));
    if (!Number.isFinite(next)) return;
    const delay = Math.max(0, next - this.clock());
    // setTimeout overflows above ~24.8 days; re-check before then.
    this.expiryTimer = setTimeout(() => this.commit(), Math.min(delay + 5, 2 ** 31 - 1));
  }

  private load(): HideRule[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const now = this.clock();
      return parsed.filter(
        (r): r is HideRule =>
          !!r &&
          typeof r === 'object' &&
          typeof (r as HideRule).chatId === 'string' &&
          typeof (r as HideRule).userId === 'string' &&
          typeof (r as HideRule).since === 'number' &&
          ((r as HideRule).until === null || typeof (r as HideRule).until === 'number') &&
          typeof (r as HideRule).showMentions === 'boolean' &&
          isActive(r as HideRule, now),
      );
    } catch {
      // Unreadable storage must never break the chat; start clean.
      return [];
    }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.rules));
    } catch {
      // Storage full or blocked: the rules still apply for this session.
    }
  }
}
