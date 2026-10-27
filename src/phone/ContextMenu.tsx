/**
 * The long-press menu, in the shape iOS 26 gives Telegram: the message lifts
 * above a blurred chat, and a glass menu opens under it. "Hide <name> for Me"
 * opens a second page with the durations, like Telegram's Mute submenu.
 */
import { motion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { MEMBERS } from '../chat/data';
import type { ChatItem } from '../hide/collapse';
import type { HideDuration } from '../hide/model';
import { BubbleContent } from './Messages';
import { Tail } from './parts';
import {
  BackIcon,
  ChevronRight,
  ClockIcon,
  CopyIcon,
  EyeSlashIcon,
  ForwardIcon,
  InfinityIcon,
  MoonIcon,
  PinIcon,
  ReplyIcon,
  ReportIcon,
  SelectIcon,
  TranslateIcon,
} from './icons';

export interface MenuAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ContextMenuProps {
  item: Extract<ChatItem, { type: 'message' }>;
  anchor: MenuAnchor;
  outgoing: boolean;
  screenWidth: number;
  screenHeight: number;
  onClose(): void;
  onHide(duration: HideDuration): void;
}

const MENU_W = 258;
const ROW = 46;
const GAP = 8;
const SPRING = { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 } as const;

export function ContextMenu({ item, anchor, outgoing, screenWidth, screenHeight, onClose, onHide }: ContextMenuProps) {
  const [page, setPage] = useState<'main' | 'hide'>('main');
  const [pressed, setPressed] = useState<string | null>(null);
  const author = MEMBERS[item.message.from]!;
  const first = author.name.split(' ')[0];
  const canHide = !outgoing;

  // Main page: Reply, Copy, Translate, Pin, Forward | Hide | Select, Report.
  const mainHeight = canHide ? ROW * 8 + GAP * 2 : ROW * 5 + GAP;
  const hidePage = useRef<HTMLDivElement>(null);
  const [hideHeight, setHideHeight] = useState(ROW * 4 + 72);
  useLayoutEffect(() => {
    if (hidePage.current) setHideHeight(hidePage.current.offsetHeight);
  }, []);
  const height = page === 'main' ? mainHeight : hideHeight;

  // Keep the menu on screen: if it would run under the composer, lift the
  // message up first, as iOS does.
  const floor = screenHeight - 104;
  const lift = Math.max(0, anchor.top + anchor.height + 10 + mainHeight - floor);
  const previewTop = Math.max(118, anchor.top - lift);
  const menuTop = previewTop + anchor.height + 10;
  const menuLeft = outgoing
    ? Math.min(screenWidth - 12, anchor.left + anchor.width) - MENU_W
    : Math.max(12, Math.min(anchor.left, screenWidth - MENU_W - 12));

  const choose = (id: string, action: () => void) => {
    setPressed(id);
    // A beat of highlight before acting, like a real tap.
    setTimeout(action, 140);
  };

  return (
    <motion.div className="menu-layer" data-tid="menu-layer">
      <motion.div
        className="menu-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.22 } }}
        transition={{ duration: 0.24 }}
        onClick={onClose}
        data-tid="menu-backdrop"
      />
      <motion.div
        className="menu-preview row"
        data-side={outgoing ? 'out' : 'in'}
        data-group-start={item.groupStart}
        data-group-end={item.groupEnd}
        style={{ left: anchor.left, width: anchor.width, padding: 0 }}
        variants={{
          // Hidden: it dissolves where it is; otherwise it settles back into the chat.
          exit: (kind: 'return' | 'hide' | undefined) =>
            kind === 'hide' ? { opacity: 0, scale: 0.92, filter: 'blur(6px)', transition: { duration: 0.22, ease: 'easeOut' } } : { top: anchor.top, scale: 1, transition: SPRING },
        }}
        initial={{ top: anchor.top, scale: 1 }}
        animate={{ top: previewTop, scale: [1, 1.035, 1.02] }}
        exit="exit"
        transition={{ top: SPRING, scale: { duration: 0.34, times: [0, 0.4, 1] } }}
      >
        <div className="bubble" style={{ width: anchor.width, boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
          <BubbleContent item={item} outgoing={outgoing} />
          {item.groupEnd && <Tail />}
        </div>
      </motion.div>
      <motion.div
        className="menu"
        data-tid="menu"
        role="menu"
        style={{ left: menuLeft, top: menuTop, transformOrigin: outgoing ? '100% 0%' : '0% 0%' }}
        initial={{ opacity: 0, scale: 0.4, height: mainHeight }}
        animate={{ opacity: 1, scale: 1, height }}
        exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.14 } }}
        transition={{ ...SPRING, opacity: { duration: 0.16 } }}
      >
        <motion.div
          style={{ display: 'flex', alignItems: 'flex-start', width: MENU_W * 2 }}
          animate={{ x: page === 'main' ? 0 : -MENU_W }}
          transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        >
          <div className="menu-page" style={{ width: MENU_W }} aria-hidden={page !== 'main'}>
            <Item id="reply" label="Reply" icon={<ReplyIcon />} pressed={pressed} onPick={() => choose('reply', onClose)} />
            <Item id="copy" label="Copy" icon={<CopyIcon />} pressed={pressed} onPick={() => choose('copy', onClose)} />
            {canHide && <Item id="translate" label="Translate" icon={<TranslateIcon />} pressed={pressed} onPick={() => choose('translate', onClose)} />}
            <Item id="pin" label="Pin" icon={<PinIcon />} pressed={pressed} onPick={() => choose('pin', onClose)} />
            <Item id="forward" label="Forward" icon={<ForwardIcon />} pressed={pressed} onPick={() => choose('forward', onClose)} />
            <div className="menu-gap" />
            {canHide && (
              <>
                <Item
                  id="hide"
                  label={`Hide ${first} for Me`}
                  icon={<EyeSlashIcon />}
                  trailing
                  pressed={pressed}
                  onPick={() => {
                    setPressed('hide');
                    setTimeout(() => {
                      setPressed(null);
                      setPage('hide');
                    }, 120);
                  }}
                />
                <div className="menu-gap" />
              </>
            )}
            <Item id="select" label="Select" icon={<SelectIcon />} pressed={pressed} onPick={() => choose('select', onClose)} />
            {canHide && <Item id="report" label="Report" icon={<ReportIcon />} tone="danger" pressed={pressed} onPick={() => choose('report', onClose)} />}
          </div>

          <div className="menu-page" ref={hidePage} style={{ width: MENU_W }} aria-hidden={page !== 'hide'}>
            <button type="button" className="menu-item menu-head" data-tid="menu-back" onClick={() => setPage('main')}>
              <BackIcon size={18} />
              Hide {first} for Me
            </button>
            <Item id="hour" label="For 1 Hour" icon={<ClockIcon />} pressed={pressed} onPick={() => choose('hour', () => onHide('hour'))} />
            <Item id="today" label="Until Tomorrow" icon={<MoonIcon />} pressed={pressed} onPick={() => choose('today', () => onHide('today'))} />
            <Item id="always" label="Always" icon={<InfinityIcon />} pressed={pressed} onPick={() => choose('always', () => onHide('always'))} />
            <div className="menu-note">
              Only you stop seeing {first}’s messages in this group. {first} won’t know.
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

interface ItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  tone?: 'danger';
  trailing?: boolean;
  pressed: string | null;
  onPick(): void;
}

function Item({ id, label, icon, tone, trailing, pressed, onPick }: ItemProps) {
  return (
    <button type="button" role="menuitem" className="menu-item" data-tid={`menu-${id}`} data-tone={tone} data-pressed={pressed === id} onClick={onPick}>
      <span>{label}</span>
      <span className="menu-trailing">
        {trailing && <ChevronRight size={15} className="chev" />}
        {icon}
      </span>
    </button>
  );
}
