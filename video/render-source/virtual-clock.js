/*
 * Virtual clock for frame-accurate capture.
 *
 * Injected before any page script. It replaces the page's notion of time
 * (performance.now, Date, timers, requestAnimationFrame) with a clock that
 * only moves when the renderer calls `__clock.advance(ms)`, and it seeks
 * every CSS animation and transition to that clock. The result: each video
 * frame shows exactly the state at its timestamp, however long the frame
 * took to capture.
 *
 * What is not virtualised: React's scheduler, which commits on a real
 * MessageChannel tick; `settle()` gives it a moment after every frame.
 */
(() => {
  if (window.__clock) return;

  const realSetTimeout = window.setTimeout.bind(window);
  const realNow = performance.now.bind(performance);
  const RealDate = Date;

  // 09:41 on the demo day, so anything that formats "now" matches the mock.
  const epoch = new RealDate(2026, 9, 24, 9, 41, 0).getTime();
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  let frames = new Map();

  const addTimer = (fn, delay, args, interval) => {
    const id = ++sequence;
    const wait = Math.max(0, Number(delay) || 0);
    timers.set(id, { at: now + wait, fn, args, interval: interval ? Math.max(1, wait) : 0, order: id });
    return id;
  };

  window.setTimeout = (fn, delay, ...args) => addTimer(fn, delay, args, false);
  window.setInterval = (fn, delay, ...args) => addTimer(fn, delay, args, true);
  window.clearTimeout = (id) => void timers.delete(id);
  window.clearInterval = (id) => void timers.delete(id);
  window.requestAnimationFrame = (fn) => {
    const id = ++sequence;
    frames.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => void frames.delete(id);

  performance.now = () => now;

  class VirtualDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(epoch + now);
      else super(...args);
    }
    static now() {
      return epoch + now;
    }
  }
  window.Date = VirtualDate;

  // Without the Web Animations entry point, the animation library runs its
  // springs and tweens on requestAnimationFrame, i.e. on this clock.
  try {
    delete Element.prototype.animate;
  } catch {
    /* non-configurable in some engines; CSS seeking below still applies */
  }

  const microtasks = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };

  const nextTimer = (limit) => {
    let best = null;
    for (const [id, timer] of timers) {
      if (timer.at > limit) continue;
      if (!best || timer.at < best.timer.at || (timer.at === best.timer.at && timer.order < best.timer.order)) {
        best = { id, timer };
      }
    }
    return best;
  };

  const run = (fn, args) => {
    try {
      if (typeof fn === 'function') fn(...args);
    } catch (error) {
      console.error('[virtual-clock]', error);
    }
  };

  const tracked = new WeakMap();

  window.__clock = {
    now: () => now,

    /** Moves time forward, firing timers in order, then one animation frame. */
    async advance(ms) {
      const target = now + ms;
      let guard = 0;
      for (;;) {
        const next = nextTimer(target);
        if (!next || ++guard > 20000) break;
        now = Math.max(now, next.timer.at);
        if (next.timer.interval) next.timer.at = now + next.timer.interval;
        else timers.delete(next.id);
        run(next.timer.fn, next.timer.args);
        // Let promise continuations schedule their follow-up timers at the
        // correct virtual time before looking for the next one.
        await microtasks();
      }
      now = target;
      const callbacks = [...frames.values()];
      frames = new Map();
      for (const callback of callbacks) run(callback, [now]);
      await microtasks();
    },

    /** Gives real-time work (React commits) time to land. */
    async settle(maxMs = 400) {
      const wait = (ms) => new Promise((resolve) => realSetTimeout(resolve, ms));
      await wait(5);
      const started = realNow();
      while (window.__stage && !window.__stage.converged() && realNow() - started < maxMs) await wait(3);
      await wait(5);
    },

    /** Pins every CSS animation and transition to the virtual clock. */
    syncAnimations() {
      for (const animation of document.getAnimations()) {
        let record = tracked.get(animation);
        if (!record) {
          record = { start: now };
          tracked.set(animation, record);
          try {
            animation.pause();
          } catch {
            /* already finished */
          }
        }
        const local = now - record.start;
        let end = Infinity;
        try {
          const timing = animation.effect && animation.effect.getComputedTiming();
          if (timing && typeof timing.endTime === 'number') end = timing.endTime;
        } catch {
          /* no effect */
        }
        try {
          if (local >= end) {
            if (animation.playState !== 'finished') animation.finish();
          } else {
            animation.currentTime = local;
          }
        } catch {
          /* the element went away mid-frame */
        }
      }
    },
  };
})();
