/**
 * Line icons drawn for this prototype in the weight of iOS system glyphs.
 * Original drawings; nothing is copied from Apple's or Telegram's assets.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export const BackIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.5}>
    <path d="M15 4.5 7.5 12l7.5 7.5" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.4}>
    <path d="M12 19.5V5M6 10.5 12 4.5l6 6" />
  </svg>
);

export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.2}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </svg>
);

export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.2}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const AttachIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={1.9}>
    <path d="M19.6 11.4 12.3 18.7a4.6 4.6 0 0 1-6.5-6.5l7.6-7.6a3.1 3.1 0 0 1 4.4 4.4l-7.5 7.5a1.6 1.6 0 0 1-2.3-2.3l6.9-6.9" />
  </svg>
);

export const StickerIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <path d="M20.5 12.4V9.5a5 5 0 0 0-5-5h-7a5 5 0 0 0-5 5v5a5 5 0 0 0 5 5h3.6" />
    <path d="M20.5 12.4c-4.5.2-8.2 3.4-8.4 7.1 2.2-.3 7.6-3.4 8.4-7.1Z" />
    <path d="M8.6 9.4v1.3M13.4 9.4v1.3M8.3 13.4c.8 1 2 1.4 3.2 1.2" />
  </svg>
);

export const MicIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={1.8}>
    <rect x="9" y="3" width="6" height="11.5" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </svg>
);

export const ReplyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9.5 6 4 11.5 9.5 17" />
    <path d="M4.5 11.5h9a6 6 0 0 1 6 6V19" />
  </svg>
);

export const CopyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="11.5" height="12.5" rx="2.6" />
    <path d="M15.5 8V6.1A2.6 2.6 0 0 0 12.9 3.5H7.1A2.6 2.6 0 0 0 4.5 6.1v8.3A2.6 2.6 0 0 0 7.1 17H8" />
  </svg>
);

export const TranslateIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.5 6h9M8 4v2c0 4.3-2 7.3-4.5 8.8M5.8 9.5c1.3 2.4 3.4 4.2 5.7 5" />
    <path d="m12.5 20 3.8-9 3.7 9M13.8 17.2h5" />
  </svg>
);

export const PinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9.2 3.8h5.6l-.9 5.4 3.4 3.2v1.4H6.7v-1.4l3.4-3.2-.9-5.4Z" />
    <path d="M12 13.8v6.4" />
  </svg>
);

export const ForwardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.5 6 20 11.5 14.5 17" />
    <path d="M19.5 11.5h-9a6 6 0 0 0-6 6V19" />
  </svg>
);

export const SelectIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.2 2.5 2.5 4.9-5" />
  </svg>
);

export const ReportIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.6 21 19.4H3L12 3.6Z" />
    <path d="M12 9.6v4.6" />
    <circle cx="12" cy="17" r=".4" fill="currentColor" />
  </svg>
);

/** Hide for Me: an eye with a stroke through it. */
export const EyeSlashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9.9 5.4c.7-.1 1.4-.2 2.1-.2 5.2 0 8.6 4.6 9.5 6.8-.4 1-1.3 2.4-2.6 3.8M6.4 6.9C4.4 8.3 3 10.3 2.5 12c.9 2.2 4.3 6.8 9.5 6.8 1.7 0 3.2-.5 4.5-1.2" />
    <path d="M9.6 9.8a3.3 3.3 0 0 0 4.6 4.6" />
    <path d="M4 3.5 20 20.5" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2.5 12c.9-2.2 4.3-6.8 9.5-6.8s8.6 4.6 9.5 6.8c-.9 2.2-4.3 6.8-9.5 6.8S3.4 14.2 2.5 12Z" />
    <circle cx="12" cy="12" r="3.3" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.3V12l3.2 2" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1Z" />
  </svg>
);

export const InfinityIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={1.9}>
    <path d="M12 12c-2-2.6-3.6-3.9-5.4-3.9a3.9 3.9 0 0 0 0 7.8c1.8 0 3.4-1.3 5.4-3.9Zm0 0c2 2.6 3.6 3.9 5.4 3.9a3.9 3.9 0 0 0 0-7.8c-1.8 0-3.4 1.3-5.4 3.9Z" />
  </svg>
);

export const PlayIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...rest}>
    <path d="M8.5 5.7c0-1 1.1-1.6 1.9-1.1l9 5.8c.8.5.8 1.7 0 2.2l-9 5.8c-.8.5-1.9-.1-1.9-1.1V5.7Z" fill="currentColor" />
  </svg>
);

export function Checks({ double = true, size = 16 }: { double?: boolean; size?: number }) {
  return (
    <svg width={size * 1.18} height={size * 0.72} viewBox="0 0 19 12" fill="none" stroke="currentColor" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m1.2 6.6 3.4 3.5L11.4 2" />
      {double && <path d="m8.4 9 1 1.1L17.2 2" />}
    </svg>
  );
}

// ---- status bar ------------------------------------------------------------

export const SignalIcon = () => (
  <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor" aria-hidden>
    <rect x="0" y="7.5" width="3.2" height="4.5" rx="1" />
    <rect x="5.2" y="5" width="3.2" height="7" rx="1" />
    <rect x="10.4" y="2.5" width="3.2" height="9.5" rx="1" />
    <rect x="15.6" y="0" width="3.2" height="12" rx="1" />
  </svg>
);

export const WifiIcon = () => (
  <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor" aria-hidden>
    <path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5.1.1.3.1.5 0l1-1c.2-.2.2-.4 0-.6A11.2 11.2 0 0 0 8.5 0C5.6 0 2.9 1.1.7 3.2c-.2.2-.2.4 0 .6l1 1c.2.1.4.1.5 0a9 9 0 0 1 6.3-2.5Z" />
    <path d="M8.5 6.1c1.3 0 2.5.5 3.5 1.3.1.1.3.1.5 0l1-1c.2-.2.2-.4 0-.6a7.5 7.5 0 0 0-10 0c-.2.2-.2.4 0 .6l1 1c.2.1.4.1.5 0 1-.8 2.2-1.3 3.5-1.3Z" />
    <path d="M11 9.2c.2-.2.2-.4 0-.6a3.7 3.7 0 0 0-5 0c-.2.2-.2.4 0 .6l2.2 2.2c.2.2.4.2.6 0L11 9.2Z" />
  </svg>
);

/** The iOS 26 battery: a pill with the percentage inside. */
export const Battery = ({ percent = 87 }: { percent?: number }) => (
  <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden>
    <rect x="0" y="0.5" width="26.5" height="13" rx="4.4" fill="currentColor" />
    <path d="M28 4.8v4.4c.9-.3 1.6-1.2 1.6-2.2S28.9 5.1 28 4.8Z" fill="currentColor" fillOpacity="0.45" />
    <text x="13.25" y="10.6" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#000" style={{ fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
      {percent}
    </text>
  </svg>
);
