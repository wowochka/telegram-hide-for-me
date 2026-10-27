import { useState, type ReactNode } from 'react';
import type { Member } from '../hide/model';
import { AttachIcon, BackIcon, Battery, MicIcon, SendIcon, SignalIcon, StickerIcon, WifiIcon } from './icons';

/**
 * An iPhone 18 Pro. Uses Apple's product bezel when it is present locally
 * (public/apple, not redistributed) and a drawn frame otherwise.
 */
export function Device({ children }: { children: ReactNode }) {
  const [bezel, setBezel] = useState<'image' | 'drawn'>('image');
  return (
    <div className="device" data-bezel={bezel}>
      <div className="device-screen">
        <div className="screen-content">{children}</div>
      </div>
      {bezel === 'image' && (
        <img className="device-bezel" src="/apple/bezel-iphone-18-pro-black.png" alt="" draggable={false} onError={() => setBezel('drawn')} />
      )}
    </div>
  );
}

export function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <span className="statusbar-right">
        <SignalIcon />
        <WifiIcon />
        <Battery percent={87} />
      </span>
    </div>
  );
}

export function Avatar({ member, className, size }: { member: Member; className?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={className} style={size ? { width: size, height: size, fontSize: size * 0.42 } : undefined}>
      <div className="avatar" style={{ ['--a1' as string]: member.avatar[0], ['--a2' as string]: member.avatar[1] }}>
        {member.photo && !broken ? <img src={member.photo} alt="" draggable={false} onError={() => setBroken(true)} /> : member.name[0]}
      </div>
    </div>
  );
}

/** The group's photo: rooftops of Alfama, or a drawn evening if it is missing. */
export function GroupAvatar() {
  const [broken, setBroken] = useState(false);
  if (!broken) return <img className="group-avatar" src="/photos/group.jpg" alt="" draggable={false} onError={() => setBroken(true)} />;
  return (
    <svg viewBox="0 0 46 46" width="46" height="46" aria-hidden>
      <defs>
        <linearGradient id="ga-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb36b" />
          <stop offset="0.55" stopColor="#ff7a8a" />
          <stop offset="1" stopColor="#c45aa8" />
        </linearGradient>
        <linearGradient id="ga-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a6fd6" />
          <stop offset="1" stopColor="#25398a" />
        </linearGradient>
      </defs>
      <rect width="46" height="46" fill="url(#ga-sky)" />
      <circle cx="29" cy="24" r="7" fill="#ffe3a3" />
      <path d="M0 29h46v17H0z" fill="url(#ga-sea)" />
      <path d="M6 33h10M22 35h14M10 39h8M27 40h11" stroke="#ffd1a1" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 29V19l3-3 3 3v10M10 22h2M10 25h2" stroke="#3b2a55" strokeWidth="1.4" fill="#3b2a55" fillOpacity="0.35" strokeLinejoin="round" />
    </svg>
  );
}

export function Tail() {
  return (
    <svg className="bubble-tail" viewBox="0 0 11 18" aria-hidden>
      <path d="M11 0v18H0.6c-.5 0-.7-.6-.3-.9C3.9 14.4 5.5 10.3 5.5 5V0Z" fill="currentColor" />
    </svg>
  );
}

export function Nav({ title, subtitle, unread }: { title: string; subtitle: ReactNode; unread: number }) {
  return (
    <>
      <div className="nav-scrim" />
      <div className="nav">
        <button type="button" className="nav-back glass" aria-label="Back" tabIndex={-1}>
          <BackIcon size={21} />
          {unread > 0 && <span className="nav-back-count">{unread}</span>}
        </button>
        <div className="nav-title glass" data-tid="nav-title">
          <span className="nav-name">{title}</span>
          <span className="nav-sub" data-tid="nav-sub">
            {subtitle}
          </span>
        </div>
        <div className="nav-avatar glass">
          <GroupAvatar />
        </div>
      </div>
    </>
  );
}

/** The input bar. With a draft, the microphone turns into Send, as in Telegram. */
export function Composer({ draft = '' }: { draft?: string }) {
  const typing = draft.length > 0;
  return (
    <div className="dock">
      <div className="composer">
        <button type="button" className="round glass" aria-label="Attach" tabIndex={-1}>
          <AttachIcon size={23} />
        </button>
        <div className="field glass">
          {typing ? (
            <span className="field-text" data-tid="draft">
              {draft}
              <i className="caret" />
            </span>
          ) : (
            <span className="field-placeholder">Message</span>
          )}
          <span className="field-icon">
            <StickerIcon size={23} />
          </span>
        </div>
        <button type="button" className="round glass" data-send={typing} aria-label={typing ? 'Send' : 'Record voice message'} tabIndex={-1} data-tid="send">
          <span className="round-icon" data-on={!typing}>
            <MicIcon size={22} />
          </span>
          <span className="round-icon send" data-on={typing}>
            <SendIcon size={20} />
          </span>
        </button>
      </div>
    </div>
  );
}
