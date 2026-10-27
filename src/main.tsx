import '@fontsource-variable/inter';
import { MotionConfig } from 'motion/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AFTER_HIDE, FLOOD, resetScript, type ScriptedMessage } from './chat/data';
import { ChatScreen, type ChatHandle } from './phone/ChatScreen';
import { Device } from './phone/parts';
import './styles/phone.css';
import './styles/page.css';

const Stage = lazy(() => import('./stage/Stage'));

declare global {
  interface Window {
    __chat?: ChatHandle;
  }
}

const storage = (() => {
  try {
    localStorage.setItem('hide-for-me/probe', '1');
    return localStorage;
  } catch {
    return null;
  }
})();

/** Plays scripted arrivals into the chat, one after another. */
function play(handle: ChatHandle, script: ScriptedMessage[]): () => void {
  let cancelled = false;
  let index = 0;
  const next = () => {
    if (cancelled || index >= script.length) return;
    const step = script[index++]!;
    setTimeout(() => {
      if (cancelled) return;
      handle.push(step.build(handle.messages()));
      next();
    }, step.delay);
  };
  next();
  return () => {
    cancelled = true;
  };
}

/** The interactive demo: one phone, real feature, scripted group. */
function Demo() {
  const chat = useRef<ChatHandle>(null);
  const [scale, setScale] = useState(1);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (innerHeight - 120) / 920, (innerWidth - 32) / 450));
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (chat.current) window.__chat = chat.current;
  });

  const run = (script: ScriptedMessage[]) => {
    stop.current?.();
    if (chat.current) stop.current = play(chat.current, script);
  };

  return (
    <main className="page">
      <div className="page-phone" style={{ width: 450 * scale, height: 920 * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          <Device>
            <ChatScreen handle={chat} storage={storage} />
          </Device>
        </div>
      </div>
      <div className="page-tools">
        <p className="page-hint">Long-press (or right-click) one of Max’s messages, then choose Hide Max for Me.</p>
        <div className="page-buttons">
          <button type="button" onClick={() => run(FLOOD)}>
            Max keeps typing
          </button>
          <button type="button" onClick={() => run(AFTER_HIDE)}>
            Mentions and replies
          </button>
          <button
            type="button"
            onClick={() => {
              resetScript();
              try {
                localStorage.removeItem('hide-for-me/v1');
              } catch {
                /* ignore */
              }
              location.reload();
            }}
          >
            Reset
          </button>
        </div>
        <p className="page-foot">Independent concept for Telegram. Not affiliated with or endorsed by Telegram.</p>
      </div>
    </main>
  );
}

function App() {
  if (location.pathname.replace(/\/+$/, '') === '/stage') {
    return (
      <Suspense fallback={null}>
        <Stage />
      </Suspense>
    );
  }
  return <Demo />;
}

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <App />
  </MotionConfig>,
);
