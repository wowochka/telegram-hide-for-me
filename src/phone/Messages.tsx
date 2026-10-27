import { AnimatePresence, motion, useAnimate, useIsPresent, usePresenceData } from 'motion/react';
import { forwardRef, memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref, type RefObject } from 'react';
import { MEMBERS } from '../chat/data';
import type { ChatItem } from '../hide/collapse';
import type { GroupMessage } from '../hide/model';
import { Dust } from './Dust';
import { Avatar, Tail } from './parts';
import { ChevronDown, Checks, EyeSlashIcon, PlayIcon } from './icons';

export interface Motion {
  /** Seconds to wait before each listed row leaves (staggered folding). */
  exitDelay: Map<string, number>;
  /** Seconds to wait before each listed row arrives (staggered reveal). */
  enterDelay: Map<string, number>;
}

interface MessagesProps {
  items: ChatItem[];
  me: string;
  motionPlan: Motion;
  lifted: string | null;
  onLongPress(messageId: string, element: HTMLElement): void;
  onToggleHidden(key: string): void;
  dockSpace: number;
}

const FOLD = [0.32, 0.72, 0, 1] as const;
/** A hidden message first dissolves into dust, then folds away. */
export const DISSOLVE = 0.28;
/** Folding and unfolding: a soft start and a long, gentle landing. */
const SMOOTH = [0.45, 0, 0.15, 1] as const;
const UNFOLD = 0.6;
/** A new message: the list rises and it comes up from under the input bar. */
const ARRIVE = { duration: 0.34, ease: [0.22, 0.9, 0.3, 1] as const };

/**
 * The height a row opens to, measured from layout. Motion's own "auto" is
 * measured on screen, which comes out scaled whenever the phone is (the demo
 * page fits it to the window, the video's camera zooms in), so rows would
 * overshoot and leave gaps before snapping back.
 */
function useOpenHeight(element: RefObject<HTMLElement | null>, animateIn: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (animateIn && element.current) setHeight(element.current.scrollHeight);
  }, [animateIn, element]);
  return height;
}

/** Once open, a row goes back to its natural height so later changes fit. */
const settle = (element: HTMLElement | null) => {
  if (element) element.style.height = 'auto';
};

function useMergedRef<T>(forwarded: Ref<T>) {
  const local = useRef<T | null>(null);
  const set = (value: T | null) => {
    local.current = value;
    if (typeof forwarded === 'function') forwarded(value);
    else if (forwarded) (forwarded as { current: T | null }).current = value;
  };
  return [local, set] as const;
}
const time = (sentAt: number) => {
  const d = new Date(sentAt);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function Messages({ items, me, motionPlan, lifted, onLongPress, onToggleHidden, dockSpace }: MessagesProps) {
  // Rows on screen when the chat opens simply appear. Every row that comes
  // later animates in: new messages, and hidden ones shown again by a peek or Undo.
  const opened = useRef(false);
  useEffect(() => {
    opened.current = true;
  }, []);
  return (
    <div className="chat" data-tid="chat">
      <div className="chat-inner" style={{ ['--dock-space' as string]: `${dockSpace}px` }}>
        <div className="service">Today</div>
        <AnimatePresence initial={false} custom={motionPlan}>
          {items.map((item) =>
            item.type === 'hidden' ? (
              <HiddenRow
                key={item.key}
                item={item}
                animateIn={opened.current}
                enterDelay={motionPlan.enterDelay.get(item.key) ?? 0}
                onToggle={() => onToggleHidden(item.key)}
              />
            ) : (
              <MessageRow
                key={item.key}
                item={item}
                outgoing={item.message.from === me}
                animateIn={opened.current}
                enterDelay={motionPlan.enterDelay.get(item.key) ?? 0}
                revealed={motionPlan.enterDelay.has(item.key)}
                lifted={lifted === item.message.id}
                onLongPress={onLongPress}
              />
            ),
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface MessageRowProps {
  item: Extract<ChatItem, { type: 'message' }>;
  outgoing: boolean;
  /** Whether this row animates in; fixed when the row mounts. */
  animateIn: boolean;
  enterDelay: number;
  /** Arrived because it stopped being hidden (peek, Undo), not as a new message. */
  revealed: boolean;
  lifted: boolean;
  onLongPress(messageId: string, element: HTMLElement): void;
}

const MessageRow = memo(
  forwardRef<HTMLDivElement, MessageRowProps>(function MessageRow({ item, outgoing, animateIn: entering, enterDelay, revealed, lifted, onLongPress }, ref) {
    const [animateIn] = useState(entering);
    const bubble = useRef<HTMLDivElement>(null);
    const [row, setRow] = useMergedRef<HTMLDivElement>(ref);
    const open = useOpenHeight(row, animateIn);
    // A new message rides up with the list from under the input bar, so it must
    // not be clipped; a revealed one unfolds in place inside its row.
    const arriving = animateIn && !revealed;
    const present = useIsPresent();
    const plan = usePresenceData() as Motion | undefined;
    const leaveDelay = plan?.exitDelay.get(item.message.id) ?? 0;
    const emerging = animateIn && revealed;
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const start = useRef<{ x: number; y: number } | null>(null);
    const { message } = item;
    const author = MEMBERS[message.from]!;
    const showAvatar = !outgoing && item.groupEnd;

    const cancel = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      start.current = null;
    };
    const down = (event: ReactPointerEvent) => {
      if (event.button !== 0) return;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        if (bubble.current) onLongPress(message.id, bubble.current);
      }, 420);
    };
    const move = (event: ReactPointerEvent) => {
      if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 8) cancel();
    };

    return (
      <motion.div
        ref={setRow}
        className="row"
        data-side={outgoing ? 'out' : 'in'}
        data-group-start={item.groupStart}
        data-group-end={item.groupEnd}
        data-peek={item.peek}
        data-tid="message"
        data-message-id={message.id}
        data-from={message.from}
        variants={{
          // Rows that fold away wait their turn, so a hide ripples outward.
          exit: (plan: Motion | undefined) => {
            const delay = (plan?.exitDelay.get(message.id) ?? 0) + DISSOLVE;
            return {
              height: 0,
              opacity: 0,
              scale: 0.96,
              transition: { duration: UNFOLD, ease: SMOOTH, delay, opacity: { duration: 0.45, ease: 'easeIn', delay: delay + 0.15 } },
            };
          },
        }}
        initial={animateIn ? { height: 0, opacity: 0 } : false}
        animate={{
          height: animateIn ? (open ?? 0) : 'auto',
          opacity: 1,
          scale: 1,
          transition: arriving ? { ...ARRIVE, opacity: { duration: 0.2 } } : { duration: UNFOLD, ease: SMOOTH, delay: enterDelay },
        }}
        onAnimationComplete={() => present && open !== null && settle(row.current)}
        data-leaving={!present}
        exit="exit"
        style={{ overflow: arriving && present ? 'visible' : 'hidden', transformOrigin: outgoing ? '100% 50%' : '0% 50%' }}
      >
        <div className="row-inner">
          {!outgoing && (showAvatar ? <Avatar member={author} className="row-avatar" /> : <div className="row-avatar-spacer" />)}
          <div
            ref={bubble}
            className="bubble"
            data-tid="bubble"
            style={{ visibility: lifted ? 'hidden' : undefined }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={cancel}
            onPointerLeave={cancel}
            onContextMenu={(event) => {
              event.preventDefault();
              cancel();
              if (bubble.current) onLongPress(message.id, bubble.current);
            }}
          >
            <div
              className="bubble-content"
              style={
                !present
                  ? { opacity: 0, transition: `opacity ${DISSOLVE * 0.8}s ease ${leaveDelay}s` }
                  : emerging
                    ? { animation: `content-in 0.55s ease ${enterDelay + 0.2}s both` }
                    : undefined
              }
            >
              <BubbleContent item={item} outgoing={outgoing} />
            </div>
            {!present && <Dust mode="cover" delay={leaveDelay} seed={message.id} />}
            {emerging && present && <Dust mode="reveal" delay={enterDelay + 0.15} seed={message.id} />}
            {item.groupEnd && <Tail />}
          </div>
        </div>
      </motion.div>
    );
  }),
);

/** The inside of a bubble; also rendered, unchanged, in the context menu. */
export function BubbleContent({ item, outgoing }: { item: Extract<ChatItem, { type: 'message' }>; outgoing: boolean }) {
  const { message } = item;
  const author = MEMBERS[message.from]!;
  const name =
    !outgoing && item.groupStart ? (
      <div className="bubble-name" style={{ color: author.color }}>
        {author.name}
        {item.addressedToMe && <EyeSlashIcon size={13} strokeWidth={2} aria-label="Hidden for you, shown because it is addressed to you" />}
      </div>
    ) : null;
  const meta = (
    <>
      <span>{time(message.sentAt)}</span>
      {outgoing && <Checks />}
    </>
  );
  const quote = item.quote ? <Quote quote={item.quote} /> : null;

  if (message.content.kind === 'voice') {
    return (
      <div className="bubble-body" style={{ padding: 0 }}>
        {name && <div style={{ padding: '6px 12px 0' }}>{name}</div>}
        <Voice seconds={message.content.seconds} color={outgoing ? '#fff' : '#3e88f7'} />
        <span className="meta">{meta}</span>
      </div>
    );
  }
  if (message.content.kind === 'photo') {
    return (
      <div style={{ paddingBottom: message.content.caption ? 0 : 3 }}>
        {name && <div style={{ padding: '6px 12px 2px' }}>{name}</div>}
        <Photo content={message.content} />
        {message.content.caption && (
          <div className="photo-caption bubble-body" style={{ paddingTop: 2 }}>
            <span className="bubble-text">{message.content.caption}</span>
            <span className="meta meta-ghost">{meta}</span>
            <span className="meta">{meta}</span>
          </div>
        )}
      </div>
    );
  }
  const text = message.content.kind === 'text' ? message.content.text : '';
  return (
    <div className="bubble-body">
      {name}
      {quote}
      <span className="bubble-text">{renderMentions(text)}</span>
      <span className="meta meta-ghost">{meta}</span>
      <span className="meta">{meta}</span>
    </div>
  );
}

function renderMentions(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} style={{ color: '#62adff' }}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function Quote({ quote }: { quote: NonNullable<Extract<ChatItem, { type: 'message' }>['quote']> }) {
  const author = MEMBERS[quote.from]!;
  return (
    <div className="quote" data-hidden={quote.hidden} style={{ ['--c' as string]: author.color }} data-tid="quote">
      <div className="quote-name">{author.name}</div>
      <div className="quote-text">{quote.hidden ? 'Hidden message' : quote.preview}</div>
    </div>
  );
}

function Voice({ seconds, color }: { seconds: number; color: string }) {
  // A fixed, natural-looking waveform.
  const bars = [4, 8, 12, 7, 15, 20, 11, 17, 24, 14, 9, 18, 22, 13, 8, 16, 21, 12, 7, 11, 18, 14, 9, 6, 12, 17, 10, 6, 9, 5];
  const length = `0:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <div className="voice" style={{ ['--c' as string]: color, position: 'relative' }}>
      <span className="voice-play" style={{ color: color === '#fff' ? '#2b77f0' : '#fff' }}>
        <PlayIcon size={20} />
      </span>
      <span className="voice-wave">
        {bars.map((h, i) => (
          <i key={i} style={{ height: h, opacity: 0.85 }} />
        ))}
      </span>
      <span className="voice-length">{length}</span>
    </div>
  );
}

/** A photo as Telegram lays it out: fitted to the bubble, never taller than wide by much. */
function Photo({ content }: { content: Extract<GroupMessage['content'], { kind: 'photo' }> }) {
  const width = 254;
  const height = Math.round(Math.min(width * 1.18, (width * content.height) / content.width));
  return (
    <div className="photo" style={{ width, height }}>
      <img src={content.src} alt="" draggable={false} />
    </div>
  );
}

interface HiddenRowProps {
  item: Extract<ChatItem, { type: 'hidden' }>;
  animateIn: boolean;
  enterDelay: number;
  onToggle(): void;
}

function HiddenRow({ item, animateIn: entering, enterDelay, onToggle }: HiddenRowProps) {
  const [animateIn] = useState(entering);
  const row = useRef<HTMLDivElement>(null);
  const open = useOpenHeight(row, animateIn);
  const [scope, animate] = useAnimate();
  const count = useRef(item.count);
  useEffect(() => {
    // Another message folded in: the pill gives a small, quiet nudge.
    if (item.count > count.current && scope.current) animate(scope.current, { scale: [1, 1.07, 1] }, { duration: 0.38, ease: 'easeOut' });
    count.current = item.count;
  }, [animate, item.count, scope]);
  const faces = item.authors.slice(0, 3).map((id) => MEMBERS[id]!);
  const names = item.authors.map((id) => MEMBERS[id]!.name.split(' ')[0]).join(' and ');
  return (
    <motion.div
      className="hidden-row"
      data-tid="hidden-row"
      data-key={item.key}
      data-count={item.count}
      ref={row}
      initial={animateIn ? { height: 0, opacity: 0 } : false}
      animate={{ height: animateIn ? (open ?? 0) : 'auto', opacity: 1, transition: { duration: UNFOLD, ease: SMOOTH, delay: enterDelay } }}
      onAnimationComplete={() => open !== null && settle(row.current)}
      exit={{ height: 0, opacity: 0, transition: { duration: 0.45, ease: SMOOTH } }}
      style={{ overflow: 'hidden' }}
    >
      <motion.button
        ref={scope}
        type="button"
        className="hidden-pill"
        aria-expanded={item.expanded}
        aria-label={`${item.count} hidden ${item.count === 1 ? 'message' : 'messages'} from ${names}. ${item.expanded ? 'Hide' : 'Show'} them.`}
        onClick={onToggle}
        initial={animateIn ? { scale: 0.86 } : false}
        animate={{ scale: 1, transition: { type: 'spring', stiffness: 420, damping: 28, delay: enterDelay } }}
      >
        <span className="hidden-faces">
          {faces.map((member) => (
            <Avatar key={member.id} member={member} className="hidden-face" />
          ))}
        </span>
        <span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={item.count}
              className="hidden-count"
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.28, ease: FOLD }}
            >
              {item.count}
            </motion.span>
          </AnimatePresence>{' '}
          hidden {item.count === 1 ? 'message' : 'messages'} from {names}
        </span>
        <ChevronDown size={14} className="hidden-chevron" />
      </motion.button>
    </motion.div>
  );
}

export type { GroupMessage };
