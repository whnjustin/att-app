import { useState, type ReactNode } from 'react';
import { MapCanvas } from '../lib/geo';
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  DayField,
  Glass,
  ICON_NAMES,
  Icon,
  IconButton,
  ListGroup,
  ListRow,
  SearchField,
  SegmentedControl,
  Sheet,
  Sidebar,
  TextField,
  TimeField,
  TopBar,
} from './index';

const PEOPLE = [
  { initials: 'AY', colorToken: '--person-ayyad', label: 'Person one' },
  { initials: 'BQ', colorToken: '--person-bqck', label: 'Person two' },
  { initials: 'XA', colorToken: '--person-xavier', label: 'Person three' },
  { initials: 'NI', colorToken: '--person-nicolino', label: 'Person four' },
  { initials: 'JN', colorToken: '--person-justinn', label: 'Person five' },
  { initials: 'JW', colorToken: '--person-justinw', label: 'Person six' },
];

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="section-title">{label}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>{children}</div>
    </section>
  );
}

const row = { display: 'flex', flexWrap: 'wrap', gap: 'var(--s3)', alignItems: 'center' } as const;

export default function Gallery() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [time, setTime] = useState(16 * 60 + 30);
  const [day, setDay] = useState<string | null>('2026-11-20');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(false);
  const [sheetLarge, setSheetLarge] = useState(false);
  const [side, setSide] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <TopBar
        title="Components"
        leading={<IconButton icon="sidebar" aria-label="Open menu" onClick={() => setSide(true)} />}
        trailing={<IconButton icon="plus" aria-label="Add" />}
      />
      <main className="page">
        <Section label="Glass">
          <div style={row}>
            <Glass style={{ padding: 'var(--s4)', borderRadius: 'var(--r-card)' }}>Regular</Glass>
            <Glass variant="strong" style={{ padding: 'var(--s4)', borderRadius: 'var(--r-card)' }}>
              Strong
            </Glass>
          </div>
        </Section>

        <Section label="Buttons">
          <div style={row}>
            <Button>Filled</Button>
            <Button variant="tinted">Tinted</Button>
            <Button variant="plain">Plain</Button>
            <Button variant="destructive">Delete</Button>
          </div>
          <div style={row}>
            <Button size="small">Filled</Button>
            <Button size="small" variant="tinted" leading="plus">
              Tinted
            </Button>
            <Button size="small" variant="plain">
              Plain
            </Button>
            <Button size="small" variant="destructive">
              Delete
            </Button>
          </div>
          <div style={row}>
            <IconButton icon="plus" aria-label="Add" variant="filled" />
            <IconButton icon="map" aria-label="Map" variant="tinted" />
            <IconButton icon="close" aria-label="Close" />
            <IconButton icon="trash" aria-label="Delete" variant="destructive" />
            <IconButton icon="car" aria-label="Directions" glass />
          </div>
        </Section>

        <Section label="Icons">
          <div style={{ ...row, color: 'var(--label)' }}>
            {ICON_NAMES.map((n) => (
              <Icon key={n} name={n} size={26} />
            ))}
          </div>
        </Section>

        <Section label="Segmented control">
          <SegmentedControl
            ariaLabel="Demo"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'a', label: 'One' },
              { value: 'b', label: 'Two' },
              { value: 'c', label: 'Three' },
            ]}
          />
        </Section>

        <Section label="Fields">
          <TextField label="Name" value={text} onChange={setText} placeholder="Name" />
          <SearchField ariaLabel="Search places" value={query} onChange={setQuery} />
          <TimeField label="Start" value={time} onChange={setTime} />
          <DayField label="Day" value={day} onChange={setDay} />
        </Section>

        <Section label="Avatars and badges">
          <div style={row}>
            <Avatar {...PEOPLE[0]} size={44} />
            <Avatar {...PEOPLE[1]} />
            <Avatar {...PEOPLE[2]} size={24} />
            <AvatarStack people={PEOPLE} max={4} />
          </div>
          <div style={row}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Badge key={n} n={n} colorVar={`--leg-${n}`} />
            ))}
          </div>
        </Section>

        <Section label="Lists">
          <ListGroup
            title="Places"
            headerAction={
              <Button size="small" variant="plain" leading="plus">
                Add
              </Button>
            }
          >
            <ListRow
              leading={<Icon name="fork-knife" />}
              title="Row title"
              subtitle="Subtitle"
              chevron
              onClick={() => {}}
            />
            <ListRow leading={<Icon name="cup" />} title="With value" trailing="4:30 PM" />
            <ListRow
              leading={<Icon name="house" />}
              title="Expandable"
              expanded={open}
              onClick={() => setOpen(!open)}
              expandedContent={
                <Button size="small" variant="destructive" leading="trash">
                  Delete
                </Button>
              }
            />
          </ListGroup>
        </Section>

        <Section label="Map">
          <div style={{ aspectRatio: '4 / 3', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
            <MapCanvas onReady={() => {}} />
          </div>
        </Section>

        <Section label="Overlays">
          <div style={row}>
            <Button variant="tinted" onClick={() => setSheet(true)}>
              Sheet
            </Button>
            <Button variant="tinted" onClick={() => setSheetLarge(true)}>
              Large sheet
            </Button>
            <Button variant="tinted" onClick={() => setSide(true)}>
              Sidebar
            </Button>
          </div>
        </Section>
      </main>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Sheet">
        <TextField label="Name" value={text} onChange={setText} />
      </Sheet>
      <Sheet
        open={sheetLarge}
        onClose={() => setSheetLarge(false)}
        title="Large sheet"
        detent="large"
        actions={<Button size="small">Save</Button>}
      >
        <ListGroup>
          {PEOPLE.map((p) => (
            <ListRow key={p.label} leading={<Avatar {...p} />} title={p.label} />
          ))}
        </ListGroup>
      </Sheet>
      <Sidebar open={side} onClose={() => setSide(false)}>
        <ListGroup>
          <ListRow leading={<Icon name="house" />} title="Overview" chevron onClick={() => setSide(false)} />
          <ListRow leading={<Icon name="map" />} title="Plan" chevron onClick={() => setSide(false)} />
        </ListGroup>
      </Sidebar>
    </div>
  );
}
