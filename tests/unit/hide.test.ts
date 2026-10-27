import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildChatItems, countUnread, shouldNotify, type ChatItem } from '../../src/hide/collapse';
import { untilFor, type GroupMessage, type HideRule } from '../../src/hide/model';
import { HideStore, type KeyValueStorage } from '../../src/hide/store';

const NOW = new Date(2026, 9, 27, 14, 0, 0).getTime();
const ME = 'me';

let seq = 0;
function msg(from: string, text: string, extra: Partial<GroupMessage> = {}): GroupMessage {
  seq++;
  return { id: `m${seq}`, from, sentAt: NOW - 1000 * (100 - seq), content: { kind: 'text', text }, ...extra };
}

function rule(userId: string, extra: Partial<HideRule> = {}): HideRule {
  return { chatId: 'g', userId, since: NOW - 1000, until: null, showMentions: true, ...extra };
}

const shape = (items: ChatItem[]) =>
  items.map((item) => (item.type === 'hidden' ? `[${item.count} from ${item.authors.join('+')}]` : `${item.message.from}:${item.message.content.kind === 'text' ? item.message.content.text : item.message.content.kind}`));

describe('collapsing hidden messages', () => {
  it('folds a run of messages from a hidden person into one row', () => {
    const messages = [msg('lena', 'who is in?'), msg('max', 'me'), msg('max', 'lol'), msg('max', 'wait'), msg('dan', 'in')];
    const items = buildChatItems(messages, { me: ME, now: NOW, rules: [rule('max')] });
    expect(shape(items)).toEqual(['lena:who is in?', '[3 from max]', 'dan:in']);
  });

  it('keeps runs separate when someone visible speaks between them', () => {
    const messages = [msg('max', 'a'), msg('lena', 'b'), msg('max', 'c'), msg('max', 'd')];
    const items = buildChatItems(messages, { me: ME, now: NOW, rules: [rule('max')] });
    expect(shape(items)).toEqual(['[1 from max]', 'lena:b', '[2 from max]']);
  });

  it('merges consecutive messages from two hidden people into one row', () => {
    const messages = [msg('max', 'a'), msg('sophie', 'b'), msg('max', 'c')];
    const items = buildChatItems(messages, { me: ME, now: NOW, rules: [rule('max'), rule('sophie')] });
    expect(shape(items)).toEqual(['[3 from max+sophie]']);
  });

  it('never hides the viewer, even with a rule naming them', () => {
    const messages = [msg(ME, 'mine')];
    expect(shape(buildChatItems(messages, { me: ME, now: NOW, rules: [rule(ME)] }))).toEqual(['me:mine']);
  });

  it('still shows messages that mention or reply to the viewer', () => {
    const mine = msg(ME, 'who brings snacks?');
    const reply = msg('max', 'I do', { replyTo: mine.id });
    const mention = msg('max', '@me look', { mentions: [ME] });
    const noise = msg('max', 'lol');
    const items = buildChatItems([mine, reply, mention, noise], { me: ME, now: NOW, rules: [rule('max')] });
    expect(shape(items)).toEqual(['me:who brings snacks?', 'max:I do', 'max:@me look', '[1 from max]']);
    const shown = items.filter((i) => i.type === 'message' && i.message.from === 'max');
    expect(shown.every((i) => i.type === 'message' && i.addressedToMe)).toBe(true);
  });

  it('hides those too when the viewer opted out of mentions', () => {
    const mine = msg(ME, 'q');
    const reply = msg('max', 'a', { replyTo: mine.id });
    const items = buildChatItems([mine, reply], { me: ME, now: NOW, rules: [rule('max', { showMentions: false })] });
    expect(shape(items)).toEqual(['me:q', '[1 from max]']);
  });

  it('marks quotes of hidden messages so replies do not leak them', () => {
    const hidden = msg('max', 'spoiler');
    const reply = msg('lena', 'haha', { replyTo: hidden.id });
    const items = buildChatItems([hidden, reply], { me: ME, now: NOW, rules: [rule('max')] });
    const item = items[1]!;
    expect(item.type === 'message' && item.quote).toEqual({ messageId: hidden.id, from: 'max', hidden: true, preview: 'spoiler' });
  });

  it('opens a hidden row to peek, with the messages marked as peeked', () => {
    const messages = [msg('max', 'a'), msg('max', 'b')];
    const closed = buildChatItems(messages, { me: ME, now: NOW, rules: [rule('max')] });
    const key = closed[0]!.key;
    const open = buildChatItems(messages, { me: ME, now: NOW, rules: [rule('max')], expanded: new Set([key]) });
    expect(shape(open)).toEqual(['[2 from max]', 'max:a', 'max:b']);
    expect(open[0]!.type === 'hidden' && open[0]!.expanded).toBe(true);
    expect(open.slice(1).every((i) => i.type === 'message' && i.peek)).toBe(true);
  });

  it('regroups bubbles around a hidden row', () => {
    const messages = [msg('lena', 'a'), msg('max', 'x'), msg('lena', 'b')];
    const items = buildChatItems(messages, { me: ME, now: NOW, rules: [rule('max')] });
    const [first, , last] = items;
    expect(first!.type === 'message' && first!.groupEnd).toBe(true);
    expect(last!.type === 'message' && last!.groupStart).toBe(true);
  });

  it('ignores a rule that has lapsed', () => {
    const messages = [msg('max', 'back')];
    const items = buildChatItems(messages, { me: ME, now: NOW, rules: [rule('max', { until: NOW - 1 })] });
    expect(shape(items)).toEqual(['max:back']);
  });

  it('keeps row keys stable as new hidden messages arrive', () => {
    const first = msg('max', 'a');
    const before = buildChatItems([first], { me: ME, now: NOW, rules: [rule('max')] });
    const after = buildChatItems([first, msg('max', 'b')], { me: ME, now: NOW, rules: [rule('max')] });
    expect(after[0]!.key).toBe(before[0]!.key);
    expect(after[0]!.type === 'hidden' && after[0]!.count).toBe(2);
  });
});

describe('unread and notifications', () => {
  it('counts only what the viewer will see', () => {
    const mine = msg(ME, 'q');
    const messages = [mine, msg('max', 'x'), msg('lena', 'y'), msg('max', 'z', { replyTo: mine.id })];
    expect(countUnread(messages, 0, { me: ME, now: NOW, rules: [rule('max')] })).toBe(2);
    expect(countUnread(messages, 0, { me: ME, now: NOW, rules: [] })).toBe(3);
  });

  it('does not notify for a hidden person, except when addressed', () => {
    const history = [msg(ME, 'q')];
    const options = { me: ME, now: NOW, rules: [rule('max')] };
    expect(shouldNotify(msg('max', 'noise'), history, options)).toBe(false);
    expect(shouldNotify(msg('max', '@me', { mentions: [ME] }), history, options)).toBe(true);
    expect(shouldNotify(msg('lena', 'hi'), history, options)).toBe(true);
    expect(shouldNotify(msg(ME, 'mine'), history, options)).toBe(false);
  });
});

describe('durations', () => {
  it('lasts an hour, until midnight, or until undone', () => {
    expect(untilFor('hour', NOW)).toBe(NOW + 3_600_000);
    expect(untilFor('today', NOW)).toBe(new Date(2026, 9, 28, 0, 0, 0).getTime());
    expect(untilFor('always', NOW)).toBeNull();
  });
});

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('HideStore', () => {
  afterEach(() => vi.useRealTimers());

  it('hides, unhides and restores, and tells subscribers each time', () => {
    const store = new HideStore(new MemoryStorage(), () => NOW);
    const listener = vi.fn();
    store.subscribe(listener);
    const rule = store.hide('g', 'max', 'always');
    expect(store.isHidden('g', 'max')).toBe(true);
    expect(store.isHidden('other', 'max')).toBe(false);
    store.unhide('g', 'max');
    expect(store.isHidden('g', 'max')).toBe(false);
    store.restore(rule);
    expect(store.isHidden('g', 'max')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('replaces an earlier rule for the same person instead of stacking', () => {
    const store = new HideStore(null, () => NOW);
    store.hide('g', 'max', 'hour');
    store.hide('g', 'max', 'always');
    expect(store.rulesFor('g')).toHaveLength(1);
    expect(store.rulesFor('g')[0]!.until).toBeNull();
  });

  it('survives a reload, and drops rules that lapsed in between', () => {
    const storage = new MemoryStorage();
    const first = new HideStore(storage, () => NOW);
    first.hide('g', 'max', 'always');
    first.hide('g', 'lena', 'hour');
    const later = new HideStore(storage, () => NOW + 2 * 3_600_000);
    expect(later.isHidden('g', 'max')).toBe(true);
    expect(later.isHidden('g', 'lena')).toBe(false);
  });

  it('starts clean from unreadable storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('hide-for-me/v1', '{not json');
    expect(new HideStore(storage, () => NOW).getRules()).toEqual([]);
    storage.setItem('hide-for-me/v1', JSON.stringify([{ chatId: 1 }, null, 'x']));
    expect(new HideStore(storage, () => NOW).getRules()).toEqual([]);
  });

  it('brings messages back by itself when a timed hide lapses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const store = new HideStore(null);
    const listener = vi.fn();
    store.subscribe(listener);
    store.hide('g', 'max', 'hour');
    listener.mockClear();
    vi.advanceTimersByTime(3_600_000 + 10);
    expect(listener).toHaveBeenCalled();
    expect(store.isHidden('g', 'max')).toBe(false);
    store.destroy();
  });
});
