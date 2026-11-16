import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SegmentedControl, Sheet, TimeField } from './index';

afterEach(cleanup);

function Seg() {
  const [v, setV] = useState<'a' | 'b' | 'c'>('a');
  return (
    <SegmentedControl
      ariaLabel="Demo"
      value={v}
      onChange={setV}
      options={[
        { value: 'a', label: 'One' },
        { value: 'b', label: 'Two' },
        { value: 'c', label: 'Three' },
      ]}
    />
  );
}

describe('SegmentedControl', () => {
  it('uses radiogroup semantics and roving tabindex', () => {
    render(<Seg />);
    expect(screen.getByRole('radiogroup', { name: 'Demo' })).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });
  it('moves selection with arrow keys and wraps', () => {
    render(<Seg />);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Two' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'Three' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('Sheet', () => {
  it('is a modal dialog and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Title">
        <button>Inside</button>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Title' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('traps focus and restores it on close', () => {
    function Host() {
      const [o, setO] = useState(false);
      return (
        <>
          <button onClick={() => setO(true)}>Open</button>
          <Sheet open={o} onClose={() => setO(false)} title="T">
            <button>Inside</button>
          </Sheet>
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByText('Open');
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole('button', { name: 'Close' });
    const inside = screen.getByText('Inside');
    expect(document.activeElement).toBe(close);
    inside.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('TimeField', () => {
  it('formats the value and lists 30 minute steps', () => {
    const onChange = vi.fn();
    render(<TimeField label="Start" value={16 * 60 + 30} onChange={onChange} />);
    expect(screen.getByText('4:30 PM', { selector: '.pick-value' })).toBeTruthy();
    const select = screen.getByLabelText('Start') as HTMLSelectElement;
    expect(select.options.length).toBe(48);
    expect(select.options[1].textContent).toBe('12:30 AM');
    fireEvent.change(select, { target: { value: '600' } });
    expect(onChange).toHaveBeenCalledWith(600);
  });
});
