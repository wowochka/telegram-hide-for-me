/**
 * The group chat as one person sees it, with Hide for Me wired in: the menu,
 * the folding, the rows, peeking, Undo, and timed rules lapsing on their own.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type Ref } from 'react';
import { CHAT_ID, CHAT_TITLE, ME, MEMBERS, MEMBER_COUNT, seedMessages } from '../chat/data';
import { buildChatItems, type ChatItem } from '../hide/collapse';
import type { GroupMessage, HideDuration, HideRule } from '../hide/model';
import { HideStore, type KeyValueStorage } from '../hide/store';
import { ContextMenu, type MenuAnchor } from './ContextMenu';
import { EyeIcon, EyeSlashIcon } from './icons';
import { DISSOLVE, Messages, type Motion } from './Messages';
import { Composer, Nav, StatusBar } from './parts';
import { Wallpaper } from './Wallpaper';

export interface ChatHandle {
  root: HTMLElement;
  push(message: GroupMessage): void;
  messages(): GroupMessage[];
  /** What a long press on that message does. */
  longPress(messageId: string): void;
  store: HideStore;
}

interface ChatScreenProps {
  handle?: Ref<ChatHandle>;
  /** Where the rules persist; null keeps them in memory (the video, tests). */
  storage: KeyValueStorage | null;
  /** Whose phone this is. */
  me?: string;
  /** How long the Hidden / Undo toast stays up, in ms. */
  toastMs?: number;
  /** Text being typed in the input bar. */
  draft?: string;
}

type Toast = { id: number; kind: 'hidden' | 'shown'; rule: HideRule };

const RIPPLE = 0.06;

export function ChatScreen({ handle, storage, me = ME, toastMs = 5000, draft = '' }: ChatScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  const store = useMemo(() => new HideStore(storage), [storage]);
  useEffect(() => () => store.destroy(), [store]);
  useSyncExternalStore(store.subscribe, store.getRules);

  const [messages, setMessages] = useState<GroupMessage[]>(() => seedMessages());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [plan, setPlan] = useState<Motion>({ exitDelay: new Map(), enterDelay: new Map() });
  const [menu, setMenu] = useState<{ messageId: string; anchor: MenuAnchor } | null>(null);
  // How the lifted message leaves: back to its place, or dissolving (hidden).
  const [menuExit, setMenuExit] = useState<'return' | 'hide'>('return');
  const [toast, setToast] = useState<Toast | null>(null);
  // Each message you send moves the background gradient one step, as in Telegram.
  const [wallPhase, setWallPhase] = useState(1);
  const toastId = useRef(0);
  const latest = useRef(messages);
  latest.current = messages;

  const rules = store.rulesFor(CHAT_ID);
  const items = buildChatItems(messages, { me, now: Date.now(), rules, expanded });
  const hiddenPeople = rules.length;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), toastMs);
    return () => clearTimeout(timer);
  }, [toast, toastMs]);

  /**
   * Before a change, works out which rows will leave and which will arrive,
   * and staggers them outward from `origin` so the change reads as one gesture.
   */
  const choreograph = useCallback(
    (nextRules: HideRule[], nextExpanded: Set<string>, origin: string | null) => {
      const now = Date.now();
      const before = buildChatItems(latest.current, { me, now, rules: store.rulesFor(CHAT_ID), expanded });
      const after = buildChatItems(latest.current, { me, now, rules: nextRules, expanded: nextExpanded });
      const beforeKeys = new Set(before.map((i) => i.key));
      const afterKeys = new Set(after.map((i) => i.key));
      const leaving = before.filter((i) => !afterKeys.has(i.key));
      const arriving = after.filter((i) => !beforeKeys.has(i.key));
      const originIndex = Math.max(0, before.findIndex((i) => i.key === origin));
      const exitDelay = new Map<string, number>();
      leaving.forEach((item) => {
        const index = before.indexOf(item);
        exitDelay.set(item.key, Math.min(0.4, Math.abs(index - originIndex) * RIPPLE));
      });
      const enterDelay = new Map<string, number>();
      const arriveOrigin = Math.max(0, after.findIndex((i) => i.key === origin));
      arriving.forEach((item) => {
        const index = after.indexOf(item);
        // Rows that replace folded bubbles land once the folding is under way.
        const base = item.type === 'hidden' ? DISSOLVE + 0.25 : 0.04;
        enterDelay.set(item.key, base + Math.min(0.4, Math.abs(index - arriveOrigin) * RIPPLE));
      });
      setPlan({ exitDelay, enterDelay });
    },
    [expanded, me, store],
  );

  const hide = useCallback(
    (userId: string, duration: HideDuration, origin: string | null) => {
      const preview = [...store.rulesFor(CHAT_ID).filter((r) => r.userId !== userId), { chatId: CHAT_ID, userId, since: Date.now(), until: null, showMentions: true }];
      choreograph(preview, expanded, origin);
      const rule = store.hide(CHAT_ID, userId, duration);
      setToast({ id: ++toastId.current, kind: 'hidden', rule });
    },
    [choreograph, expanded, store],
  );

  const unhide = useCallback(
    (rule: HideRule) => {
      choreograph(
        store.rulesFor(CHAT_ID).filter((r) => r.userId !== rule.userId),
        expanded,
        null,
      );
      store.unhide(CHAT_ID, rule.userId);
    },
    [choreograph, expanded, store],
  );

  const toggleHidden = useCallback(
    (key: string) => {
      const next = new Set(expanded);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      choreograph(store.rulesFor(CHAT_ID), next, key);
      setExpanded(next);
      holdInPlace(root.current, key);
    },
    [choreograph, expanded, store],
  );

  const openMenu = useCallback((messageId: string, element: HTMLElement) => {
    const screen = root.current;
    if (!screen) return;
    const frame = screen.getBoundingClientRect();
    const scale = frame.width / screen.offsetWidth || 1;
    const rect = element.getBoundingClientRect();
    setMenuExit('return');
    setMenu({
      messageId,
      anchor: {
        left: (rect.left - frame.left) / scale,
        top: (rect.top - frame.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      },
    });
  }, []);

  useImperativeHandle(
    handle,
    () => ({
      root: root.current!,
      push: (message) => {
        setMessages((list) => [...list, message]);
        if (message.from === me) setWallPhase((phase) => phase + 1);
      },
      messages: () => latest.current,
      longPress: (messageId) => {
        const element = root.current?.querySelector<HTMLElement>(`[data-message-id="${messageId}"] [data-tid="bubble"]`);
        if (element) openMenu(messageId, element);
      },
      store,
    }),
    [me, openMenu, store],
  );

  const menuItem = menu ? (items.find((i) => i.type === 'message' && i.message.id === menu.messageId) as Extract<ChatItem, { type: 'message' }> | undefined) : undefined;

  const subtitle = (
    <>
      {MEMBER_COUNT} members
      {hiddenPeople > 0 && (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          · <EyeSlashIcon size={12} strokeWidth={2.1} /> {hiddenPeople} hidden
        </motion.span>
      )}
    </>
  );

  return (
    <div className="screen" ref={root} data-tid="screen" data-menu={menu ? 'open' : 'closed'}>
      <Wallpaper phase={wallPhase} />
      <Messages
        items={items}
        me={me}
        motionPlan={plan}
        lifted={menu?.messageId ?? null}
        onLongPress={openMenu}
        onToggleHidden={toggleHidden}
        dockSpace={80}
      />
      <StatusBar />
      <Nav title={CHAT_TITLE} subtitle={subtitle} unread={24} />
      <Composer draft={draft} />

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="toast"
            data-tid="toast"
            role="status"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            {toast.kind === 'hidden' ? <Countdown key={toast.id} ms={toastMs} /> : (
              <span className="toast-icon">
                <EyeIcon size={19} />
              </span>
            )}
            <span className="toast-text">
              <span className="toast-title" style={{ display: 'block' }}>
                {toast.kind === 'hidden' ? `${firstName(toast.rule.userId)} is hidden for you` : `${firstName(toast.rule.userId)} is back`}
              </span>
              <span className="toast-sub" style={{ display: 'block' }}>
                {toast.kind === 'hidden' ? untilLabel(toast.rule) : 'Their messages are visible again.'}
              </span>
            </span>
            {toast.kind === 'hidden' && (
              <button
                type="button"
                className="toast-action"
                data-tid="toast-undo"
                onClick={() => {
                  const rule = toast.rule;
                  setToast(null);
                  unhide(rule);
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence custom={menuExit}>
        {menu && menuItem && (
          <ContextMenu
            key={menu.messageId}
            item={menuItem}
            anchor={menu.anchor}
            outgoing={menuItem.message.from === me}
            screenWidth={402}
            screenHeight={874}
            onClose={() => setMenu(null)}
            onHide={(duration) => {
              const origin = menu.messageId;
              const userId = menuItem.message.from;
              setMenuExit('hide');
              setMenu(null);
              // Let the menu start to close before the chat rearranges.
              setTimeout(() => hide(userId, duration, origin), 160);
            }}
          />
        )}
      </AnimatePresence>

      <div className="home-indicator" />
    </div>
  );
}

/**
 * Keeps the tapped hidden row where it is while its messages unfold below it
 * (or fold back), as iOS anchors a list to what you touched. Without this the
 * bottom-anchored chat would push the row up and out of view.
 */
function holdInPlace(screen: HTMLElement | null, key: string, ms = 1500) {
  const chat = screen?.querySelector<HTMLElement>('[data-tid="chat"]');
  const row = () => screen?.querySelector<HTMLElement>(`[data-tid="hidden-row"][data-key="${key}"]`);
  if (!screen || !chat || !row()) return;
  const scale = () => screen.getBoundingClientRect().width / screen.offsetWidth || 1;
  const anchor = row()!.getBoundingClientRect().top;
  const started = performance.now();
  const step = () => {
    const element = row();
    if (!element) return;
    const drift = (element.getBoundingClientRect().top - anchor) / scale();
    if (Math.abs(drift) > 0.25) chat.scrollTop += drift;
    if (performance.now() - started < ms) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const firstName = (userId: string) => MEMBERS[userId]!.name.split(' ')[0]!;

function untilLabel(rule: HideRule): string {
  const name = firstName(rule.userId);
  if (rule.until === null) return `Only you. ${name} won’t know.`;
  const minutes = Math.round((rule.until - rule.since) / 60_000);
  if (minutes <= 61) return `For an hour. ${name} won’t know.`;
  return `Until tomorrow. ${name} won’t know.`;
}

/** Telegram's undo timer: a ring that runs down around the seconds left. */
function Countdown({ ms }: { ms: number }) {
  const total = Math.ceil(ms / 1000);
  const [left, setLeft] = useState(total);
  useEffect(() => {
    if (left <= 1) return;
    // The first second is partial when ms is not a whole number of seconds.
    const wait = left === total ? ms - (total - 1) * 1000 : 1000;
    const timer = setTimeout(() => setLeft((n) => n - 1), wait);
    return () => clearTimeout(timer);
  }, [left, ms, total]);
  const r = 10.5;
  const length = 2 * Math.PI * r;
  return (
    <span className="toast-timer" aria-hidden>
      <svg width="26" height="26" viewBox="0 0 26 26">
        <circle
          cx="13"
          cy="13"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={length}
          style={{ ['--ring' as string]: `${length}px`, animation: `toast-ring ${ms}ms linear both` }}
          transform="rotate(-90 13 13)"
        />
      </svg>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={left} className="toast-seconds" initial={{ y: -7, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 7, opacity: 0 }} transition={{ duration: 0.22 }}>
          {left}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
