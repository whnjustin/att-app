import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

type Handler = (...a: unknown[]) => void;

const h = vi.hoisted(() => {
  const state = {
    maps: [] as {
      opts: Record<string, unknown>;
      handlers: Record<string, Handler[]>;
      setStyle: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
      addControl: ReturnType<typeof vi.fn>;
      fire(ev: string): void;
    }[],
  };
  return state;
});

vi.mock('maplibre-gl', () => {
  class Map {
    opts: Record<string, unknown>;
    handlers: Record<string, Handler[]> = {};
    setStyle = vi.fn();
    remove = vi.fn();
    addControl = vi.fn();
    constructor(opts: Record<string, unknown>) {
      this.opts = opts;
      h.maps.push(this);
    }
    on(ev: string, fn: Handler) {
      (this.handlers[ev] ??= []).push(fn);
    }
    once(ev: string, fn: Handler) {
      const wrap: Handler = (...a) => {
        this.handlers[ev] = (this.handlers[ev] ?? []).filter((x) => x !== wrap);
        fn(...a);
      };
      this.on(ev, wrap);
    }
    fire(ev: string) {
      [...(this.handlers[ev] ?? [])].forEach((f) => f());
    }
  }
  class AttributionControl {
    opts: unknown;
    constructor(opts: unknown) {
      this.opts = opts;
    }
  }
  return { default: { Map, AttributionControl }, Map, AttributionControl };
});

import { MapCanvas, STYLE_DARK, STYLE_LIGHT } from './MapCanvas';

function stubMatchMedia(dark: boolean) {
  const listeners: (() => void)[] = [];
  const mq = {
    matches: dark,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.splice(listeners.indexOf(fn), 1),
  };
  vi.stubGlobal('matchMedia', () => mq);
  return { mq, listeners };
}

afterEach(() => {
  cleanup();
  h.maps.length = 0;
  vi.unstubAllGlobals();
});

describe('MapCanvas', () => {
  it('mounts, reports ready, and cleans up', () => {
    stubMatchMedia(false);
    const onReady = vi.fn();
    const { unmount } = render(<MapCanvas onReady={onReady} />);
    const map = h.maps[0];
    expect(map.opts.style).toBe(STYLE_LIGHT);
    expect(map.opts.center).toEqual([101.6869, 3.139]);
    expect(map.opts.zoom).toBe(11.5);
    expect(map.addControl).toHaveBeenCalledTimes(1);
    map.fire('load');
    expect(onReady).toHaveBeenCalledWith(map);
    unmount();
    expect(map.remove).toHaveBeenCalled();
  });

  it('swaps style on scheme change and fires onStyleReload', () => {
    const { mq, listeners } = stubMatchMedia(false);
    const onStyleReload = vi.fn();
    render(<MapCanvas onReady={() => undefined} onStyleReload={onStyleReload} />);
    const map = h.maps[0];
    mq.matches = true;
    listeners.forEach((f) => f());
    expect(map.setStyle).toHaveBeenCalledWith(STYLE_DARK);
    map.fire('style.load');
    expect(onStyleReload).toHaveBeenCalledWith(map);
  });

  it('falls back to positron when the dark style errors on load', () => {
    stubMatchMedia(true);
    render(<MapCanvas onReady={() => undefined} />);
    const map = h.maps[0];
    expect(map.opts.style).toBe(STYLE_DARK);
    map.fire('error');
    expect(map.setStyle).toHaveBeenCalledWith(STYLE_LIGHT);
  });

  it('works without matchMedia and honours interactive=false', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<MapCanvas onReady={() => undefined} interactive={false} />);
    expect(h.maps[0].opts.interactive).toBe(false);
    expect(h.maps[0].opts.style).toBe(STYLE_LIGHT);
  });
});
