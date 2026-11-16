import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ItineraryItem } from '../../../contracts/types';
import { useStore } from '../../../contracts/store';
import type { Stop } from '../../../lib/geo';
import { stopColorVar } from '../../../lib/geo/legs';
import { formatRange } from '../../../lib/time';
import { Badge } from '../../../ui';
import { formatDistance, formatDuration } from './format';
import { reorderTimes, type DisplayLeg } from './model';

const LONG_PRESS_MS = 250;
const EDGE = 72;
const MAX_SCROLL = 16;
const SETTLE_MS = 2500;

const blockTouch = (e: TouchEvent) => {
  if (e.cancelable) e.preventDefault();
};
const blockMenu = (e: Event) => e.preventDefault();

function reduced(): boolean {
  return (
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type Span = { startMin: number; endMin: number };

/** Frozen copy of the list while a row is held, so remote changes wait until the drop. */
interface Drag {
  from: number;
  to: number;
  dy: number;
  phase: 'drag' | 'commit';
  tops: number[];
  stops: Stop[];
  items: Map<string, ItineraryItem>;
  expect: Map<string, Span>;
}

interface Gesture {
  id: string;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  startScroll: number;
  lastY: number;
  active: boolean;
  timer: number | null;
  raf: number | null;
  from: number;
  to: number;
  dy: number;
  tops: number[];
  heights: number[];
  stops: Stop[];
  items: Map<string, ItineraryItem>;
}

interface Props {
  stops: Stop[];
  itemById: Map<string, ItineraryItem>;
  display: DisplayLeg[];
}

export function StopList({ stops, itemById, display }: Props) {
  const store = useStore();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const gesture = useRef<Gesture | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const focusId = useRef<string | null>(null);
  const suppress = useRef(false);
  const onMoveRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const onUpRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const onCancelRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const stable = useRef({
    move: (e: PointerEvent) => onMoveRef.current(e),
    up: (e: PointerEvent) => onUpRef.current(e),
    cancel: (e: PointerEvent) => onCancelRef.current(e),
  });

  const shownStops = drag ? drag.stops : stops;
  const shownItems = drag ? drag.items : itemById;

  // Release a committed drag once the store shows the new times, or after a short wait.
  useEffect(() => {
    if (!drag || drag.phase !== 'commit') return;
    let done = true;
    for (const [id, span] of drag.expect) {
      const it = itemById.get(id);
      if (it && (it.startMin !== span.startMin || it.endMin !== span.endMin)) done = false;
    }
    if (done) {
      setDrag(null);
      return;
    }
    const t = window.setTimeout(() => setDrag(null), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [drag, itemById]);

  // Keep keyboard focus on the moved row after the list reorders.
  useLayoutEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    rows.current.get(id)?.querySelector<HTMLElement>('.stop-main')?.focus();
  });

  const write = useCallback(
    (list: Stop[], items: Map<string, ItineraryItem>, from: number, to: number) => {
      const found = list.map((s) => items.get(s.itemId)).filter((i): i is ItineraryItem => !!i);
      if (found.length !== list.length) return null;
      const next = reorderTimes(found, from, to);
      const expect = new Map<string, Span>();
      found.forEach((it, i) => {
        if (it.startMin !== next[i].startMin || it.endMin !== next[i].endMin) {
          expect.set(it.id, next[i]);
          void store.updateItem(it.id, { ...next[i], date: it.date });
        }
      });
      return expect;
    },
    [store],
  );

  // ---- pointer gestures ----

  const apply = useCallback((g: Gesture) => {
    g.dy = g.lastY - g.startY + (window.scrollY - g.startScroll);
    const center = g.tops[g.from] + g.heights[g.from] / 2 + g.dy;
    let best = g.from;
    let bestD = Infinity;
    g.tops.forEach((t, k) => {
      const d = Math.abs(center - (t + g.heights[k] / 2));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    g.to = best;
    setDrag({
      from: g.from,
      to: g.to,
      dy: g.dy,
      phase: 'drag',
      tops: g.tops,
      stops: g.stops,
      items: g.items,
      expect: new Map(),
    });
  }, []);

  const stopLoop = (g: Gesture) => {
    if (g.raf !== null) cancelAnimationFrame(g.raf);
    g.raf = null;
  };

  const loop = useCallback(
    (g: Gesture) => {
      const tick = () => {
        if (gesture.current !== g || !g.active) return;
        const h = window.innerHeight;
        let v = 0;
        if (g.lastY < EDGE) v = -Math.min(MAX_SCROLL, ((EDGE - g.lastY) / EDGE) * MAX_SCROLL);
        else if (g.lastY > h - EDGE) v = Math.min(MAX_SCROLL, ((g.lastY - (h - EDGE)) / EDGE) * MAX_SCROLL);
        if (v) {
          window.scrollBy(0, v);
          apply(g);
        }
        g.raf = requestAnimationFrame(tick);
      };
      g.raf = requestAnimationFrame(tick);
    },
    [apply],
  );

  const activate = useCallback(
    (g: Gesture) => {
      const tops: number[] = [];
      const heights: number[] = [];
      for (const s of g.stops) {
        const r = rows.current.get(s.itemId)?.getBoundingClientRect();
        tops.push(r ? r.top + window.scrollY : 0);
        heights.push(r ? r.height : 0);
      }
      g.tops = tops;
      g.heights = heights;
      g.active = true;
      g.startScroll = window.scrollY;
      apply(g);
      loop(g);
      if (g.touch) navigator.vibrate?.(8);
    },
    [apply, loop],
  );

  const endGesture = useCallback(
    (g: Gesture, save: boolean) => {
      if (g.timer !== null) window.clearTimeout(g.timer);
      stopLoop(g);
      window.removeEventListener('pointermove', stable.current.move);
      window.removeEventListener('pointerup', stable.current.up);
      window.removeEventListener('pointercancel', stable.current.cancel);
      window.removeEventListener('touchmove', blockTouch);
      window.removeEventListener('contextmenu', blockMenu);
      gesture.current = null;
      if (!g.active) return;
      suppress.current = true;
      window.setTimeout(() => (suppress.current = false), 0);
      if (save && g.to !== g.from) {
        const expect = write(g.stops, g.items, g.from, g.to);
        if (expect) {
          setDrag({
            from: g.from,
            to: g.to,
            dy: 0,
            phase: 'commit',
            tops: g.tops,
            stops: g.stops,
            items: g.items,
            expect,
          });
          setAnnounce(`${g.stops[g.from].poi.name} moved to ${g.to + 1}`);
          return;
        }
      }
      setDrag(null);
    },
    [write],
  );

  const onMove = useCallback(
    (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.pointerId) return;
      g.lastY = e.clientY;
      if (!g.active) {
        const dist = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
        if (g.touch) {
          if (dist > 8) endGesture(g, false);
        } else if (dist > 4) activate(g);
        return;
      }
      apply(g);
    },
    [activate, apply, endGesture],
  );
  const onUp = useCallback(
    (e: PointerEvent) => {
      const g = gesture.current;
      if (g && e.pointerId === g.pointerId) endGesture(g, true);
    },
    [endGesture],
  );
  const onCancel = useCallback(
    (e: PointerEvent) => {
      const g = gesture.current;
      if (g && e.pointerId === g.pointerId) endGesture(g, false);
    },
    [endGesture],
  );
  onMoveRef.current = onMove;
  onUpRef.current = onUp;
  onCancelRef.current = onCancel;

  const startGesture = (e: ReactPointerEvent, index: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag) return;
    if (gesture.current) endGesture(gesture.current, false);
    const touch = e.pointerType !== 'mouse';
    const g: Gesture = {
      id: stops[index].itemId,
      pointerId: e.pointerId,
      touch,
      startX: e.clientX,
      startY: e.clientY,
      startScroll: window.scrollY,
      lastY: e.clientY,
      active: false,
      timer: null,
      raf: null,
      from: index,
      to: index,
      dy: 0,
      tops: [],
      heights: [],
      stops,
      items: itemById,
    };
    gesture.current = g;
    if (touch) {
      g.timer = window.setTimeout(() => {
        g.timer = null;
        if (gesture.current === g) {
          window.addEventListener('touchmove', blockTouch, { passive: false });
          window.addEventListener('contextmenu', blockMenu);
          activate(g);
        }
      }, LONG_PRESS_MS);
    }
    window.addEventListener('pointermove', stable.current.move);
    window.addEventListener('pointerup', stable.current.up);
    window.addEventListener('pointercancel', stable.current.cancel);
  };

  useEffect(
    () => () => {
      const g = gesture.current;
      if (g) {
        if (g.timer !== null) window.clearTimeout(g.timer);
        stopLoop(g);
      }
      window.removeEventListener('pointermove', stable.current.move);
      window.removeEventListener('pointerup', stable.current.up);
      window.removeEventListener('pointercancel', stable.current.cancel);
      window.removeEventListener('touchmove', blockTouch);
      window.removeEventListener('contextmenu', blockMenu);
    },
    [],
  );

  // ---- keyboard ----

  const moveBy = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= stops.length || drag) return;
    if (!write(stops, itemById, index, to)) return;
    focusId.current = stops[index].itemId;
    setAnnounce(`${stops[index].poi.name} moved to ${to + 1}`);
  };

  const onKey = (e: KeyboardEvent, index: number) => {
    const id = stops[index].itemId;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setGrabbed((g) => (g === id ? null : id));
      return;
    }
    if (e.key === 'Escape') {
      setGrabbed(null);
      return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!e.altKey && grabbed !== id) return;
    e.preventDefault();
    moveBy(index, e.key === 'ArrowUp' ? -1 : 1);
  };

  const motion = !reduced();

  return (
    <section className={`list-group stop-list${drag ? ' is-dragging' : ''}`}>
      <ul className="list">
        {shownStops.flatMap((st, i) => {
          const it = shownItems.get(st.itemId);
          const d = display[i];
          let style: CSSProperties | undefined;
          let cls = 'list-row stop-row';
          if (drag) {
            if (i === drag.from) {
              const lifted = drag.phase === 'drag';
              const y = lifted ? drag.dy : drag.tops[drag.to] - drag.tops[drag.from];
              style = { transform: `translate3d(0, ${y}px, 0)${lifted && motion ? ' scale(1.025)' : ''}` };
              cls += lifted ? ' lifted' : ' settling';
            } else if (drag.from < drag.to && i > drag.from && i <= drag.to) {
              style = { transform: `translate3d(0, ${drag.tops[i - 1] - drag.tops[i]}px, 0)` };
            } else if (drag.to < drag.from && i >= drag.to && i < drag.from) {
              style = { transform: `translate3d(0, ${drag.tops[i + 1] - drag.tops[i]}px, 0)` };
            }
          }
          const out = [
            <li
              key={`stop:${st.itemId}`}
              className={cls}
              style={style}
              ref={(el) => {
                if (el) rows.current.set(st.itemId, el);
                else rows.current.delete(st.itemId);
              }}
            >
              <div
                className={`row-main stop-main${grabbed === st.itemId ? ' grabbed' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={grabbed === st.itemId}
                aria-label={`${st.poi.name}, stop ${i + 1} of ${shownStops.length}`}
                onPointerDown={(e) => startGesture(e, i)}
                onKeyDown={(e) => onKey(e, i)}
                onBlur={() => setGrabbed((g) => (g === st.itemId ? null : g))}
                onClick={(e) => {
                  if (suppress.current) e.preventDefault();
                }}
              >
                <span className="row-leading">
                  <Badge n={st.number} colorVar={stopColorVar(st.number)} />
                </span>
                <span className="row-text">
                  <span className="row-title">{st.poi.name}</span>
                  {it ? <span className="row-sub">{formatRange(it.startMin, it.endMin)}</span> : null}
                </span>
              </div>
            </li>,
          ];
          if (d) {
            out.push(
              <li key={`gap:${i}`} className="stop-gap" aria-hidden={d.durationS === null}>
                {d.durationS !== null && d.distanceM !== null ? (
                  <>
                    <span>{formatDuration(d.durationS)}</span>
                    <span>{formatDistance(d.distanceM)}</span>
                  </>
                ) : null}
              </li>,
            );
          }
          return out;
        })}
      </ul>
      <div className="visually-hidden" role="status" aria-live="polite">
        {announce}
      </div>
    </section>
  );
}
