import { useEffect, useMemo, useState } from 'react';
import type { DateKey, ItineraryItem, Poi, PoiCategory } from '../../../contracts/types';
import { useStore } from '../../../contracts/store';
import { formatDay } from '../../../lib/time';
import { Button, Icon, ListGroup, ListRow, SearchField, Sheet, TimeField, type IconName } from '../../../ui';

export type SheetTarget =
  { mode: 'edit'; itemId: string } | { mode: 'add'; date: DateKey; startMin: number; endMin: number };

const GROUPS: { category: PoiCategory; title: string; icon: IconName }[] = [
  { category: 'restaurant', title: 'Restaurants', icon: 'fork-knife' },
  { category: 'cafe', title: 'Cafes', icon: 'cup' },
  { category: 'bar', title: 'Bars', icon: 'glass' },
  { category: 'other', title: 'Other', icon: 'pin' },
  { category: 'stay', title: 'Stays', icon: 'house' },
];

interface Props {
  target: SheetTarget;
  items: ItineraryItem[];
  pois: Poi[];
  /** True while the add place sheet is on top. */
  hidden: boolean;
  onClose: () => void;
  onNewPlace: () => void;
  /** Set by the parent after the add place sheet saves. */
  newPoiId: string | null;
  onNewPoiHandled: () => void;
}

export function ItemSheet({
  target,
  items,
  pois,
  hidden,
  onClose,
  onNewPlace,
  newPoiId,
  onNewPoiHandled,
}: Props) {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(() =>
    target.mode === 'add' ? { start: target.startMin, end: target.endMin } : { start: 0, end: 0 },
  );
  const item = target.mode === 'edit' ? items.find((i) => i.id === target.itemId) : undefined;
  const start = target.mode === 'edit' ? (item?.startMin ?? 0) : draft.start;
  const end = target.mode === 'edit' ? (item?.endMin ?? 60) : draft.end;
  const isMeal = item?.kind === 'meal';

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (p: Poi) => !q || p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q);
    return GROUPS.map((g) => ({
      ...g,
      pois: pois
        .filter((p) => p.category === g.category && match(p))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.pois.length > 0);
  }, [pois, query]);

  const link = (poiId: string) => {
    if (target.mode === 'edit') {
      void store.updateItem(target.itemId, { poiId });
    } else {
      void store.addItem({
        date: target.date,
        kind: 'poi',
        meal: null,
        poiId,
        startMin: draft.start,
        endMin: draft.end,
      });
    }
    onClose();
  };

  // A place saved from the add place sheet links to this item.
  useEffect(() => {
    if (!newPoiId || hidden) return;
    onNewPoiHandled();
    link(newPoiId);
  });

  const setTimes = (s: number, e: number) => {
    if (target.mode === 'edit') void store.updateItem(target.itemId, { startMin: s, endMin: e });
    else setDraft({ start: s, end: e });
  };
  const onStart = (v: number) => setTimes(v, v >= end ? Math.min(1440, v + 60) : end);
  const onEnd = (v: number) => setTimes(start, v);

  if (target.mode === 'edit' && !item) return null;

  const title =
    target.mode === 'add'
      ? formatDay(target.date)
      : (pois.find((p) => p.id === item?.poiId)?.name ??
        (isMeal ? (item?.meal === 'dinner' ? 'Dinner' : 'Lunch') : 'Place'));

  return (
    <Sheet
      open={!hidden}
      onClose={onClose}
      title={title}
      detent="large"
      actions={
        target.mode === 'edit' ? (
          <Button
            variant="destructive"
            size="small"
            leading="trash"
            onClick={() => {
              void store.deleteItem(target.itemId);
              onClose();
            }}
          >
            Delete
          </Button>
        ) : null
      }
    >
      <div className="tl-sheet">
        <div className="tl-times">
          <TimeField label="Start" value={start} min={0} max={1410} onChange={onStart} />
          <TimeField label="End" value={end} min={start + 30} max={1440} onChange={onEnd} />
        </div>
        <SearchField value={query} onChange={setQuery} ariaLabel="Search places" />
        <ListGroup>
          <ListRow leading={<Icon name="plus" size={20} />} title="New place" onClick={onNewPlace} />
        </ListGroup>
        {groups.length === 0 ? <p className="tl-empty">No places</p> : null}
        {groups.map((g) => (
          <ListGroup key={g.category} title={g.title}>
            {g.pois.map((p) => (
              <ListRow
                key={p.id}
                leading={<Icon name={g.icon} size={20} />}
                title={p.name}
                subtitle={p.address || undefined}
                trailing={
                  item?.poiId === p.id ? (
                    <>
                      <Icon name="star" size={16} />
                      <span className="visually-hidden">Selected</span>
                    </>
                  ) : undefined
                }
                onClick={() => link(p.id)}
              />
            ))}
          </ListGroup>
        ))}
      </div>
    </Sheet>
  );
}
