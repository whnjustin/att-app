import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { TRIP_DAYS, type DateKey, type ItineraryItem, type Poi } from '../../../contracts/types';
import { useDays, useItems, usePois, useStore } from '../../../contracts/store';
import { navigate } from '../../../lib/router';
import { formatDay, formatMin, formatRange, todayTripDay } from '../../../lib/time';
import { legIndexByItem } from '../../../lib/geo';
import { Badge, IconButton, SegmentedControl } from '../../../ui';
import { AddPlaceSheet } from '../places';
import {
  PX_PER_HOUR,
  PX_PER_MIN,
  firstFreeHour,
  keyboardSpan,
  moveSpan,
  packColumns,
  resizeEnd,
  resizeStart,
  slotAt,
  type Span,
} from './geometry';
import { ItemSheet, type SheetTarget } from './ItemSheet';
import './timeline.css';

const TOP_PAD = 10;
const GRID_H = PX_PER_HOUR * 24 + TOP_PAD * 2;
const EDGE = 48;
const LONG_PRESS_MS = 250;
const KEY_DEBOUNCE_MS = 400;
const DEFAULT_DAY: DateKey = '2026-11-19';
const HOURS = Array.from({ length: 24 }, (_, h) => h);

type Mode = 'move' | 'start' | 'end';
/** Local hold on one item while this user edits it. Remote changes to it are ignored until it settles. */
interface Hold extends Span {
  id: string;
  phase: 'drag' | 'hold' | 'commit';
}

interface Gesture {
  id: string;
  mode: Mode;
  pointerId: number;
  touch: boolean;
  startY: number;
  startX: number;
  startScroll: number;
  lastY: number;
  orig: Span;
  cur: Span;
  active: boolean;
  timer: number | null;
  raf: number | null;
}

const CAT_VAR: Record<Poi['category'], string> = {
  restaurant: '--cat-restaurant',
  cafe: '--cat-cafe',
  bar: '--cat-bar',
  other: '--cat-other',
  stay: '--cat-stay',
};

const mealLabel = (i: ItineraryItem) => (i.meal === 'dinner' ? 'Dinner' : 'Lunch');

export function DayTimeline({ date }: { date: DateKey | null }) {
  const store = useStore();
  const day: DateKey = date ?? todayTripDay() ?? DEFAULT_DAY;

  useEffect(() => {
    if (date === null) navigate({ page: 'plan', date: day }, { replace: true });
  }, [date, day]);

  const items = useItems(day);
  const pois = usePois();
  const days = useDays();

  const [hold, setHold] = useState<Hold | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [addingPlace, setAddingPlace] = useState(false);
  const [newPoiId, setNewPoiId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const keyTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const holdRef = useRef<Hold | null>(null);
  holdRef.current = hold;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onMoveRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const onUpRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const onCancelRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const stable = useRef({
    move: (e: PointerEvent) => onMoveRef.current(e),
    up: (e: PointerEvent) => onUpRef.current(e),
    cancel: (e: PointerEvent) => onCancelRef.current(e),
  });

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 9 * PX_PER_HOUR;
  }, []);

  // Reset local state on day change.
  useEffect(() => {
    setHold(null);
    setSelected(null);
    setSheet(null);
  }, [day]);

  useEffect(
    () => () => {
      if (keyTimer.current) window.clearTimeout(keyTimer.current);
    },
    [],
  );

  // Release a committed hold once the store shows the new times, or after a short wait.
  useEffect(() => {
    if (!hold || hold.phase !== 'commit') return;
    const it = items.find((i) => i.id === hold.id);
    if (!it || (it.startMin === hold.startMin && it.endMin === hold.endMin)) {
      setHold(null);
      return;
    }
    const t = window.setTimeout(() => setHold(null), 2500);
    return () => window.clearTimeout(t);
  }, [hold, items]);

  const shown = useMemo(
    () =>
      items.map((i) =>
        hold && hold.id === i.id ? { ...i, startMin: hold.startMin, endMin: hold.endMin } : i,
      ),
    [items, hold],
  );
  const placement = useMemo(() => packColumns(shown.map((i) => ({ ...i, id: i.id }))), [shown]);
  const poiById = useMemo(() => new Map(pois.map((p) => [p.id, p])), [pois]);
  const legs = useMemo(() => {
    const cfg = days.find((d) => d.date === day);
    return legIndexByItem(shown, pois, cfg ?? { startPoiId: '', endPoiId: '' });
  }, [shown, pois, days, day]);

  const commit = useCallback(
    (id: string, span: Span) => {
      const orig = itemsRef.current.find((i) => i.id === id);
      if (!orig || (orig.startMin === span.startMin && orig.endMin === span.endMin)) {
        setHold(null);
        return;
      }
      setHold({ id, ...span, phase: 'commit' });
      void store.updateItem(id, { startMin: span.startMin, endMin: span.endMin });
    },
    [store],
  );

  // ---- pointer gestures ----

  const apply = useCallback((g: Gesture) => {
    const sc = scrollRef.current;
    const dy = g.lastY - g.startY + (sc ? sc.scrollTop - g.startScroll : 0);
    const dMin = dy / PX_PER_MIN;
    g.cur =
      g.mode === 'move'
        ? moveSpan(g.orig, dMin)
        : g.mode === 'end'
          ? resizeEnd(g.orig, dMin)
          : resizeStart(g.orig, dMin);
    setHold({ id: g.id, ...g.cur, phase: 'drag' });
  }, []);

  const stopLoop = (g: Gesture) => {
    if (g.raf !== null) cancelAnimationFrame(g.raf);
    g.raf = null;
  };

  const loop = useCallback(
    (g: Gesture) => {
      const tick = () => {
        const sc = scrollRef.current;
        if (!sc || gesture.current !== g || !g.active) return;
        const r = sc.getBoundingClientRect();
        let v = 0;
        if (g.lastY < r.top + EDGE) v = -Math.min(14, ((r.top + EDGE - g.lastY) / EDGE) * 14);
        else if (g.lastY > r.bottom - EDGE) v = Math.min(14, ((g.lastY - (r.bottom - EDGE)) / EDGE) * 14);
        if (v) {
          sc.scrollTop += v;
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
      g.active = true;
      setSelected(g.id);
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
      gesture.current = null;
      if (g.active) {
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
        if (save) commit(g.id, g.cur);
        else setHold(null);
      }
    },
    [commit],
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
      if (!g || e.pointerId !== g.pointerId) return;
      endGesture(g, true);
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

  const startGesture = (e: ReactPointerEvent, item: ItineraryItem, mode: Mode) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (gesture.current) endGesture(gesture.current, false);
    if (keyTimer.current) {
      window.clearTimeout(keyTimer.current);
      keyTimer.current = null;
    }
    const shownItem = shown.find((i) => i.id === item.id) ?? item;
    const orig = { startMin: shownItem.startMin, endMin: shownItem.endMin };
    const touch = e.pointerType !== 'mouse';
    const g: Gesture = {
      id: item.id,
      mode,
      pointerId: e.pointerId,
      touch,
      startX: e.clientX,
      startY: e.clientY,
      startScroll: scrollRef.current?.scrollTop ?? 0,
      lastY: e.clientY,
      orig,
      cur: orig,
      active: false,
      timer: null,
      raf: null,
    };
    gesture.current = g;
    setSelected(item.id);
    if (touch) {
      g.timer = window.setTimeout(() => {
        g.timer = null;
        if (gesture.current === g) {
          window.addEventListener('touchmove', blockTouch, { passive: false });
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
    },
    [],
  );

  // ---- keyboard ----

  const onKey = (e: KeyboardEvent, item: ItineraryItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSheet({ mode: 'edit', itemId: item.id });
      return;
    }
    const cur = holdRef.current && holdRef.current.id === item.id ? holdRef.current : item;
    const next = keyboardSpan(e.key, e.shiftKey, cur);
    if (!next) return;
    e.preventDefault();
    setHold({ id: item.id, ...next, phase: 'hold' });
    if (keyTimer.current) window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(() => {
      keyTimer.current = null;
      commit(item.id, next);
    }, KEY_DEBOUNCE_MS);
  };

  // ---- taps and add ----

  const onGridClick = (e: MouseEvent) => {
    if (suppressClick.current) return;
    if ((e.target as HTMLElement).closest('.tl-block')) return;
    const grid = gridRef.current;
    if (!grid) return;
    setSelected(null);
    const y = e.clientY - grid.getBoundingClientRect().top - TOP_PAD;
    const slot = slotAt(Math.floor(y / PX_PER_MIN / 30) * 30);
    setSheet({ mode: 'add', date: day, ...slot });
  };

  const openAdd = () => {
    const slot = slotAt(firstFreeHour(items));
    setSheet({ mode: 'add', date: day, ...slot });
  };

  const closeSheet = () => {
    setSheet(null);
    setAddingPlace(false);
    setNewPoiId(null);
  };

  return (
    <section className="tl" aria-label="Timeline">
      <h2 className="visually-hidden">Timeline</h2>
      <SegmentedControl
        ariaLabel="Day"
        value={day}
        onChange={(d) => navigate({ page: 'plan', date: d })}
        options={TRIP_DAYS.map((d) => ({ value: d, label: formatDay(d) }))}
      />
      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-grid" ref={gridRef} style={{ height: GRID_H }} onClick={onGridClick}>
          {HOURS.map((h) => (
            <div key={h} className="tl-hour" style={{ top: TOP_PAD + h * PX_PER_HOUR }}>
              <span className="tl-label">{formatMin(h * 60)}</span>
              <span className="tl-line" />
              <span className="tl-half" />
            </div>
          ))}
          <div className="tl-end" style={{ top: TOP_PAD + 24 * PX_PER_HOUR }} />
          <div className="tl-lane">
            {shown.map((item) => {
              const poi = item.poiId ? poiById.get(item.poiId) : undefined;
              const name = poi?.name ?? mealLabel(item);
              const unlinked = !poi;
              const range = formatRange(item.startMin, item.endMin);
              const place = placement[item.id] ?? { col: 0, cols: 1 };
              const leg = legs[item.id];
              const dragging = hold?.id === item.id && hold.phase === 'drag';
              const compact = item.endMin - item.startMin <= 30;
              const cls = [
                'tl-block',
                unlinked ? 'unlinked' : 'linked',
                selected === item.id ? 'selected' : '',
                dragging ? 'dragging' : '',
                compact ? 'compact' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${name}, ${range}`}
                  className={cls}
                  data-id={item.id}
                  style={{
                    top: TOP_PAD + item.startMin * PX_PER_MIN,
                    height: (item.endMin - item.startMin) * PX_PER_MIN,
                    left: `${(place.col / place.cols) * 100}%`,
                    width: `${100 / place.cols}%`,
                    ['--cat' as string]: poi ? `var(${CAT_VAR[poi.category]})` : 'var(--label-3)',
                  }}
                  onPointerDown={(e) => startGesture(e, item, 'move')}
                  onClick={() => {
                    if (suppressClick.current) return;
                    setSelected(item.id);
                    setSheet({ mode: 'edit', itemId: item.id });
                  }}
                  onKeyDown={(e) => onKey(e, item)}
                  onFocus={() => setSelected(item.id)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className="tl-inner">
                    <span className="tl-text">
                      <span className="tl-name">{name}</span>
                      <span className="tl-range">{range}</span>
                    </span>
                    {leg ? <Badge n={leg} colorVar={`--leg-${((leg - 1) % 8) + 1}`} /> : null}
                  </span>
                  <span
                    className="tl-handle top"
                    aria-hidden="true"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      startGesture(e, item, 'start');
                    }}
                  />
                  <span
                    className="tl-handle bottom"
                    aria-hidden="true"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      startGesture(e, item, 'end');
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <IconButton glass icon="plus" aria-label="Add to day" className="tl-fab" onClick={openAdd} />
      {sheet ? (
        <ItemSheet
          key={sheet.mode === 'edit' ? sheet.itemId : `add-${sheet.startMin}`}
          target={sheet}
          items={items}
          pois={pois}
          hidden={addingPlace}
          onClose={closeSheet}
          onNewPlace={() => setAddingPlace(true)}
          newPoiId={newPoiId}
          onNewPoiHandled={() => setNewPoiId(null)}
        />
      ) : null}
      <AddPlaceSheet
        open={addingPlace}
        onClose={() => setAddingPlace(false)}
        onSaved={(id) => {
          setNewPoiId(id);
          setAddingPlace(false);
        }}
      />
    </section>
  );
}

function blockTouch(e: TouchEvent) {
  if (e.cancelable) e.preventDefault();
}
