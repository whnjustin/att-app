# ATT in KL app: build plan

Repo: `whnjustin/att-app`. Live URL: `https://whnjustin.github.io/att-app/`.
Stack: Vite, React 18, TypeScript (strict), Firebase (Auth + Firestore), MapLibre GL JS, GitHub Pages via GitHub Actions.
Trip window: Thu 19 Nov 2026 to Sun 22 Nov 2026. All times are Malaysia time (UTC+8, no DST). Mobile first, light and dark mode follow the system.

This plan is written for one **dispatcher** session that spawns **builder** agents (Sonnet is fine). Part A is for Justin. Part B is the shared contract every builder must read. Part C is the work packages. Part D is the dispatch order and merge rules.

---

## Part A. Human setup (Justin)

### A1. Create the Firebase project (about 10 minutes)

1. Go to https://console.firebase.google.com and click **Create a project**. Name it `att-app`. Turn Google Analytics **off**. Create.
2. On the project overview, click the **web** icon (`</>`) to add a web app. Nickname `att-app`. Leave "Firebase Hosting" unticked. Click **Register app**.
3. Firebase shows a `firebaseConfig` object (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId). Copy it and paste it into the thread. These values are not secrets; they ship to every browser anyway.
4. Left menu, **Build > Authentication > Get started**. Under **Sign-in method**, enable **Anonymous**. Save.
5. Still in Authentication, open **Settings > Authorized domains** and add `whnjustin.github.io`. (`localhost` is there by default.)
6. Left menu, **Build > Firestore Database > Create database**. Choose **Standard edition**, location **asia-southeast1 (Singapore)**, start in **production mode**. Create.
7. Once the database exists, in the **Data** tab, click **Start collection**. Collection ID `passcodes`. Document ID: the group passcode itself (pick something with at least 8 characters, letters and digits only, for example `durian2026kl`). Add one field `active` (boolean) = `true`. Save. To change the passcode later, add a new doc and delete the old one.
8. The rules (`firestore.rules` in the repo) get deployed by pasting them into **Firestore > Rules** and clicking **Publish**. The dispatcher will tell you when the file is ready. Optional: install the Firebase CLI and run `firebase deploy --only firestore:rules` instead.

The free Spark plan covers this app many times over. No billing account needed.

### A1 result: Firebase web config (received 2026-11-16)

Put this in `src/config/firebase.config.ts` during WP0:

```ts
export const firebaseConfig = {
  apiKey: "AIzaSyCM0qI9WdU74ld0exRWhGsIxbTit8u0J-o",
  authDomain: "att-app-66d1d.firebaseapp.com",
  projectId: "att-app-66d1d",
  storageBucket: "att-app-66d1d.firebasestorage.app",
  messagingSenderId: "1069198171893",
  appId: "1:1069198171893:web:6d3ebc5f628a48c56a2fbc"
};
```

### A2. GitHub Pages

In `whnjustin/att-app` on GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**. That is all; the workflow from WP0 does the rest.

### A3. Attach the repo to the dispatcher session

Start the dispatcher session with `whnjustin/att-app` attached, and give it this file plus the Firebase config from A1 step 3.

---

## Part B. Shared contract (every builder reads this first)

### B1. Content rules (hard requirements, checked in CI)

- No explanatory filler text. No intro paragraphs, no "Tap here to...", no footers explaining the UI, no hint lines under headings. Labels, values and buttons only. Empty states are a single short phrase, e.g. `No places yet`.
- No em dash (U+2014), en dash (U+2013), middle dot (U+00B7) or bullet (U+2022) anywhere in `src/` or `index.html`. Ranges use `to` (`4 PM to 6 PM`). Separators use layout (spacing, separate lines) instead of punctuation.
- No emoji in UI.
- Paul does not exist in this app.
- `scripts/check-copy.mjs` (WP0) fails the build if any banned character appears in `src/**` or `index.html`.

### B2. Repo layout and file ownership

```
.github/workflows/deploy.yml        WP0
firestore.rules                     WP2
index.html, vite.config.ts          WP0
scripts/check-copy.mjs              WP0
src/
  main.tsx, App.tsx                 WP0 (shell routes), WP3 edits nav only
  config/firebase.config.ts         WP0 (placeholder), dispatcher fills values
  contracts/types.ts                WP0  (frozen after WP0 merges)
  contracts/store.ts                WP0  (frozen after WP0 merges)
  contracts/seed.ts                 WP0  (frozen after WP0 merges)
  lib/time.ts                       WP0
  lib/mockStore.ts                  WP0
  lib/firestoreStore.ts             WP2
  lib/auth.ts, lib/presence.ts      WP2
  lib/geo/*                         WP4
  styles/tokens.css                 WP0
  styles/base.css                   WP0
  ui/*                              WP1 (component kit)
  features/gate/*                   WP2
  features/shell/*                  WP3
  features/overview/arrivals/*      WP5
  features/overview/map/*           WP6
  features/plan/timeline/*          WP7
  features/plan/places/*            WP8
```

A builder edits only the files its package owns. If it needs a change to a frozen contract file, it stops and reports the needed change to the dispatcher instead of editing.

### B3. Data model (`src/contracts/types.ts`)

```ts
export type DateKey = '2026-11-19' | '2026-11-20' | '2026-11-21' | '2026-11-22';
export const TRIP_DAYS: DateKey[] = ['2026-11-19','2026-11-20','2026-11-21','2026-11-22'];

export type PersonId = 'ayyad' | 'bqck' | 'xavier' | 'nicolino' | 'justinn' | 'justinw';

export interface Movement {
  date: string | null;      // 'YYYY-MM-DD', may be outside TRIP_DAYS (Ayyad leaves 2026-11-26)
  time: string | null;      // 'HH:mm' 24h, null = not set
  place: string;            // free text, e.g. 'Airport'
}

export interface Person {
  id: PersonId;
  name: string;             // 'Justin N'
  initials: string;         // 'JN'
  colorToken: string;       // CSS var name, e.g. '--person-ayyad'
  role: 'visitor' | 'local';
  stayPoiId: string | null; // POI with category 'stay'
  arrival: Movement | null; // null for locals
  departure: Movement | null;
  updatedAt: number;
  updatedBy: PersonId | null;
}

export type PoiCategory = 'restaurant' | 'cafe' | 'bar' | 'other' | 'stay';

export interface Poi {
  id: string;
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  address: string;          // short, e.g. 'Area A'
  source: 'search' | 'gmaps-url' | 'pin' | 'seed';
  osmRef: string | null;    // e.g. 'N123456' from Photon, for dedupe
  note: string;
  createdAt: number;
  createdBy: PersonId | null;
  updatedAt: number;
}

export interface ItineraryItem {
  id: string;
  date: DateKey;
  kind: 'meal' | 'poi';
  meal: 'lunch' | 'dinner' | null; // set when kind = 'meal'
  poiId: string | null;            // meals may be unlinked
  startMin: number;                // minutes from 00:00, multiple of 30, 0..1410
  endMin: number;                  // multiple of 30, startMin+30..1440
  createdAt: number;
  updatedAt: number;
  updatedBy: PersonId | null;
}

export interface DayConfig {
  date: DateKey;
  startPoiId: string;       // route start, default the shared stay ('home')
  endPoiId: string;         // route end, default the shared stay ('home')
}

export interface Member { uid: string; personId: PersonId | null; joinedAt: number; code: string; }

export interface Presence { uid: string; personId: PersonId | null; page: 'overview' | 'plan'; lastSeen: number; }

export interface RouteLeg {
  key: string;              // legKey(from, to)
  polyline: string;         // Google encoded polyline, precision 5
  distanceM: number;
  durationS: number;
  fetchedAt: number;
}
```

Times are stored as plain strings and minute integers, never `Date` objects, so no time zone conversion ever happens. `src/lib/time.ts` (WP0) provides `formatTime('16:00') -> '4 PM'`, `formatTime('16:30') -> '4:30 PM'`, `minToHHmm`, `hhmmToMin`, `formatDay('2026-11-19') -> 'Thu 19'`, `formatDayLong -> 'Thursday 19 November'`, `snap30(min)`.

### B4. Firestore layout

| Path | Doc id | Shape |
|---|---|---|
| `passcodes/{code}` | the passcode | `{active: true}`; created by hand, never readable |
| `members/{uid}` | auth uid | `Member` |
| `people/{personId}` | person id | `Person` |
| `pois/{poiId}` | auto id (seed uses fixed ids) | `Poi` |
| `items/{itemId}` | auto id (seed meals use `{date}-lunch`, `{date}-dinner`) | `ItineraryItem` |
| `days/{date}` | date key | `DayConfig` |
| `routes/{legKey}` | leg key | `RouteLeg` (shared cache) |
| `presence/{uid}` | auth uid | `Presence` |
| `meta/seed` | `seed` | `{version: 1, at: number}` |

### B5. Security rules (WP2 writes, this is the spec)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function isMember() { return signedIn() && exists(/databases/$(db)/documents/members/$(request.auth.uid)); }

    match /passcodes/{code} { allow read, write: if false; }

    match /members/{uid} {
      allow get: if signedIn() && request.auth.uid == uid;
      allow create: if signedIn() && request.auth.uid == uid
        && request.resource.data.code is string
        && exists(/databases/$(db)/documents/passcodes/$(request.resource.data.code));
      allow update: if isMember() && request.auth.uid == uid
        && request.resource.data.code == resource.data.code;
      allow delete: if false;
    }

    match /{col}/{id} {
      allow read, write: if isMember() && col in ['people','pois','items','days','routes','presence','meta'];
    }
  }
}
```

`exists()` in rules ignores read rules, so the client can prove the passcode without ever reading `passcodes`. Add field validation on `items` (`startMin`/`endMin` ints, multiples of 30, in range) and on `pois` (`lat`/`lng` numbers, `category` in the enum).

### B6. Store interface (`src/contracts/store.ts`)

Every UI package talks to data only through this interface, provided by React context. WP0 ships `mockStore` (in memory, seeded, fake realtime via listeners) so UI packages can build and test without Firebase. WP2 ships `firestoreStore`. `App.tsx` picks Firestore when the config has a `projectId`, else mock (also `?mock=1` forces mock).

```ts
export type Unsub = () => void;
export interface Store {
  // auth and identity
  signIn(): Promise<string>;                        // anonymous, returns uid
  isMember(): Promise<boolean>;
  join(code: string): Promise<'ok' | 'bad-code'>;
  setMe(personId: PersonId): Promise<void>;
  me(): PersonId | null;

  // live subscriptions (callback fires immediately with current data, then on every change)
  watchPeople(cb: (p: Person[]) => void): Unsub;
  watchPois(cb: (p: Poi[]) => void): Unsub;
  watchItems(date: DateKey | 'all', cb: (i: ItineraryItem[]) => void): Unsub;
  watchDays(cb: (d: DayConfig[]) => void): Unsub;
  watchPresence(cb: (p: Presence[]) => void): Unsub;

  // writes (stamp updatedAt / updatedBy inside the store)
  updatePerson(id: PersonId, patch: Partial<Pick<Person,'arrival'|'departure'|'stayPoiId'>>): Promise<void>;
  addPoi(p: Omit<Poi,'id'|'createdAt'|'updatedAt'|'createdBy'>): Promise<string>;
  updatePoi(id: string, patch: Partial<Poi>): Promise<void>;
  deletePoi(id: string): Promise<void>;              // also sets poiId=null on items that use it
  addItem(i: Omit<ItineraryItem,'id'|'createdAt'|'updatedAt'|'updatedBy'>): Promise<string>;
  updateItem(id: string, patch: Partial<Pick<ItineraryItem,'startMin'|'endMin'|'poiId'|'date'>>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  updateDay(date: DateKey, patch: Partial<DayConfig>): Promise<void>;

  // route cache
  getRoute(key: string): Promise<RouteLeg | null>;
  putRoute(leg: RouteLeg): Promise<void>;

  // presence
  heartbeat(page: Presence['page']): Promise<void>;  // called every 25 s; online = lastSeen within 60 s

  // seed
  ensureSeed(): Promise<void>;                      // idempotent: no-op if meta/seed exists
}
```

React hooks in `src/contracts/store.ts` too: `useStore()`, `usePeople()`, `usePois()`, `useItems(date)`, `useDays()`, `usePresence()`, `useMe()`. Hooks are thin wrappers over `watch*` with `useSyncExternalStore` or `useEffect` state.

Concurrency model: last write wins per field. Drag and resize write only on pointer up, never during the gesture. Remote updates to an item currently being dragged by this user are held and applied on drop.

### B7. Seed data

**Privacy rule: the repo is public and the built JS bundle is downloadable by anyone, passcode or not.** So no arrival times, flight places, stay names, addresses or coordinates may appear in the repo or the bundle.

- `src/contracts/seed.ts` (committed) holds only the public skeleton: people ids, names, initials, colour tokens, roles, the 4 day keys, default meal items, and **fake placeholder** arrivals and stays (e.g. `Airport`, `Stay A` at central KL coordinates) for the mock store.
- The real values below go in `seed.local.json` (gitignored, listed in `.gitignore` by WP0, never imported by `src/`). WP2 writes `scripts/seed.mjs`: it reads `seed.local.json`, signs in anonymously, joins with a passcode passed as a CLI argument, and writes the docs if `meta/seed` is missing. The dispatcher runs it once locally after Justin publishes the rules. `ensureSeed()` in the app only creates the default meal items and day configs if missing, never personal data.
- `scripts/check-private.mjs` fails CI if any denylisted private term appears in tracked files or `dist/`. The denylist is stored only as SHA-256 hashes of lowercase 1 and 2 word windows, so the terms themselves never appear in the repo.
- Stay POI ids are generic in the repo: `home` (the shared stay), `stay-2`, `stay-3`. Transport POI ids: `arrive-1`, `arrive-2`, `arrive-3`.

Real seed values: kept out of the repo. They live in the project notes (outside GitHub) and in the gitignored `seed.local.json`. Shape of `seed.local.json`: `{ "people": Person[] (personal fields only), "pois": Poi[] (stays `home`, `stay-2`, `stay-3` and transport `arrive-1..3`) }`.

Items: for each of the 4 days, `{date}-lunch` (kind meal, meal lunch, 720 to 780) and `{date}-dinner` (meal dinner, 1200 to 1260), `poiId: null`.

Days: each day `startPoiId = endPoiId = 'home'`.

### B8. Design system (`src/styles/tokens.css`)

Apple Liquid Glass, as Apple applies it: glass is for the **navigation and control layer that floats above content** (top bar, sidebar, segmented controls, floating buttons, sheets, popovers). Content (lists, calendar grid, map) sits on solid grouped backgrounds. Do not make every card glass.

```css
:root {
  /* surfaces */
  --bg: #f2f2f7;                    /* systemGroupedBackground */
  --surface: #ffffff;               /* secondarySystemGroupedBackground */
  --surface-2: #f2f2f7;
  --separator: rgba(60,60,67,.18);
  /* text */
  --label: #000000;
  --label-2: rgba(60,60,67,.60);
  --label-3: rgba(60,60,67,.30);
  --tint: #007aff;
  --destructive: #ff3b30;
  /* glass */
  --glass-fill: rgba(255,255,255,.55);
  --glass-fill-strong: rgba(255,255,255,.78);
  --glass-blur: 24px;
  --glass-saturate: 180%;
  --glass-edge: rgba(255,255,255,.65);      /* inner specular top edge */
  --glass-rim: rgba(0,0,0,.06);             /* outer hairline */
  --glass-shadow: 0 8px 32px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06);
  /* people */
  --person-ayyad: #007aff; --person-bqck: #ff9500; --person-xavier: #34c759;
  --person-nicolino: #ff3b30; --person-justinn: #30b0c7; --person-justinw: #5856d6;
  /* route legs, used in order, wrap after 8 */
  --leg-1: #007aff; --leg-2: #ff2d55; --leg-3: #34c759; --leg-4: #ff9500;
  --leg-5: #af52de; --leg-6: #00c7be; --leg-7: #ffcc00; --leg-8: #a2845e;
  /* category */
  --cat-restaurant: #ff9500; --cat-cafe: #a2845e; --cat-bar: #af52de; --cat-other: #8e8e93; --cat-stay: #007aff;
  /* type (SF via system stack) */
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
  --t-large: 700 34px/41px var(--font-display);
  --t-title2: 700 22px/28px var(--font-display);
  --t-title3: 600 20px/25px var(--font-display);
  --t-headline: 600 17px/22px var(--font);
  --t-body: 400 17px/22px var(--font);
  --t-callout: 400 16px/21px var(--font);
  --t-subhead: 400 15px/20px var(--font);
  --t-footnote: 400 13px/18px var(--font);
  --t-caption: 500 12px/16px var(--font);
  /* shape, concentric: inner radius = outer radius minus padding */
  --r-sheet: 28px; --r-card: 20px; --r-control: 14px; --r-capsule: 999px;
  /* spacing, 4 pt grid */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 20px; --s6: 24px; --s8: 32px;
  --gutter: 16px;
  --hit: 44px;                               /* minimum touch target */
  /* motion */
  --spring: cubic-bezier(.32,.72,0,1);
  --dur-fast: 180ms; --dur: 320ms;
}
```

Dark values go under `@media (prefers-color-scheme: dark)`: `--bg:#000`, `--surface:#1c1c1e`, `--surface-2:#2c2c2e`, `--separator: rgba(84,84,88,.6)`, `--label:#fff`, `--label-2: rgba(235,235,245,.6)`, `--label-3: rgba(235,235,245,.3)`, `--tint:#0a84ff`, `--glass-fill: rgba(40,40,44,.55)`, `--glass-fill-strong: rgba(40,40,44,.8)`, `--glass-edge: rgba(255,255,255,.18)`, `--glass-rim: rgba(255,255,255,.08)`, `--glass-shadow: 0 8px 32px rgba(0,0,0,.5)`, and the dark variants of each system colour (`#0a84ff`, `#ff9f0a`, `#30d158`, `#ff453a`, `#40c8e0`, `#5e5ce6`, `#ff375f`, `#bf5af2`, `#63e6e2`, `#ffd60a`, `#ac8e68`).

Glass recipe (in `ui/Glass.tsx` and `.glass` class): `background: var(--glass-fill); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: inset 0 1px 0 var(--glass-edge), 0 0 0 .5px var(--glass-rim), var(--glass-shadow);`. Fallback when `backdrop-filter` is unsupported or `prefers-reduced-transparency: reduce`: use `--glass-fill-strong` with no blur. Pressed state scales to .97 with `--spring`. Respect `prefers-reduced-motion` (no scale, no spring, instant).

Layout: max content width 720px centred, `--gutter` side padding, safe area insets honoured, no horizontal page scroll at 360px width. Large title collapses into the glass top bar on scroll.

### B9. Map stack (no API keys)

- Renderer: `maplibre-gl` (v4 or v5).
- Basemap: OpenFreeMap (`https://tiles.openfreemap.org/styles/positron` for light, its dark style for dark; WP4 confirms the exact dark style URL and falls back to positron if none). Attribution control stays visible (required).
- Search: Photon (`https://photon.komoot.io/api/?q=...&lat=3.139&lon=101.6869&limit=8&lang=en&bbox=101.40,2.85,101.95,3.35`). Debounce 350 ms, abort the previous request. OSM data: big names and chains are found; very new or tiny places may not be.
- Search fallbacks in the add place sheet: paste a full Google Maps URL (parse `@lat,lng` or `!3d<lat>!4d<lng>` or `q=lat,lng`; short `maps.app.goo.gl` links cannot be resolved in the browser, so show `Open the link and copy the full address bar URL`) or drop a pin on a mini map.
- Routing: OSRM public server `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=polyline`. One leg per request, max 1 request per second through a queue, results cached in `routes/{legKey}` so the whole group shares them and the public server is hit once per unique leg. On failure draw a dashed straight line for that leg and retry on next change.
- `legKey(a, b) = round5(a.lat),round5(a.lng)_round5(b.lat),round5(b.lng)` with dots replaced by `p` and minus by `m` so it is a valid doc id.
- Links (no key needed):
  - Google Maps open: `https://www.google.com/maps/search/?api=1&query={encodeURIComponent(name + ' ' + address)}` (falls back to `query={lat},{lng}`).
  - Google Maps embed: `https://maps.google.com/maps?q={lat},{lng}&z=17&output=embed` in an `iframe` loaded only when the row is expanded. This keyless embed is unofficial; if it fails to load, show a MapLibre mini map with a pin instead.
  - Waze: `https://waze.com/ul?ll={lat},{lng}&navigate=yes`.

### B10. Navigation

Hash routes: `#/` overview, `#/plan` day plan (optional `#/plan/2026-11-20`). Top bar (glass) has a sidebar button on the left, page title, and online avatars on the right. The sidebar is a glass panel sliding from the left over a dimmed scrim: `Overview`, `Day plan`, then `You are` with the person picker. Closes on scrim tap, Escape, swipe left, or navigation.

---

## Part C. Work packages

Each package lists: owner files, depends on, what to build, acceptance criteria. Every package also must: pass `npm run typecheck`, `npm run lint`, `npm run check-copy`, `npm run build`; include Vitest tests for any pure logic; render without console errors at 375x812 and 1280x800 in both colour schemes using `?mock=1`.

### WP0. Scaffold and contracts (dispatcher does this itself, or one agent, before anything else)

Depends on: nothing.
Build:
- Vite React TS project, `base: '/att-app/'`, strict TS, ESLint, Prettier, Vitest, Playwright (for smoke screenshots).
- `src/contracts/*` exactly as Part B, `lib/time.ts` with tests, `lib/mockStore.ts` implementing `Store` with seed data and listener based fake realtime (writes notify all watchers on next tick).
- `styles/tokens.css`, `styles/base.css` (reset, body uses `--bg`, type defaults).
- `App.tsx` with store provider, hash router, placeholder pages `Overview` and `Plan`, each a `<main>` with mount points for feature components: overview mounts `<ArrivalsCalendar/>` then `<DayMap/>`; plan mounts `<DayTimeline/>` then `<PlacesList/>`. Placeholders are stubs exported from each feature folder so packages replace their own folder only.
- `scripts/check-copy.mjs` and npm script.
- `.github/workflows/deploy.yml`: on push to `main`, `npm ci`, the four checks, build, `actions/upload-pages-artifact`, `actions/deploy-pages`.
- `src/config/firebase.config.ts` exporting `firebaseConfig` (empty placeholder until Justin's values arrive).
Accept: `npm run dev` shows both stub pages via hash routes; CI green; Pages deploy succeeds and shows the stubs; contracts compile.

### Wave 1 (parallel after WP0 merges)

#### WP1. UI kit (`src/ui/*`)

Build components with props typed and a `src/ui/Gallery.tsx` page reachable at `#/ui` (dev only) showing every component in both schemes:
- `Glass` (surface wrapper, variants `regular` and `strong`), `TopBar` (large title that collapses on scroll), `Sidebar` (sliding panel + scrim, focus trap), `Sheet` (bottom sheet on phones with drag to dismiss and detents medium and large; centred modal at 768px and wider), `SegmentedControl` (glass capsule with sliding selection), `Button` (filled, tinted, plain, destructive; sizes regular and small; icon only variant with 44px hit), `ListGroup` and `ListRow` (inset grouped list with separators, leading accessory, trailing value or chevron, expandable), `Avatar` and `AvatarStack` (initials on person colour), `TextField`, `SearchField`, `TimeField` (30 minute steps, shows `4:30 PM`), `DayField` (19 to 22 plus free date), `Badge` (numbered leg badge with colour), `Icon` (inline SVG set: sidebar, plus, close, chevron, map, car, waze, pin, trash, clock, search, house, fork-knife, cup, glass, star).
Accept: keyboard operable, visible focus ring in `--tint`, `aria` roles correct for sheet (dialog), sidebar (dialog), segmented (radiogroup); reduced motion respected; no banned characters.

#### WP2. Firebase, gate, identity, presence (`lib/firestoreStore.ts`, `lib/auth.ts`, `lib/presence.ts`, `features/gate/*`, `firestore.rules`)

Build:
- `firestoreStore` implementing every `Store` method with the modular Firebase SDK v10+. Use `onSnapshot` for watchers, `serverTimestamp` not needed (use `Date.now()`), `writeBatch` for `ensureSeed` and `deletePoi`. Enable `persistentLocalCache` for offline.
- `ensureSeed`: transaction that creates only default meal items and day configs if missing. Personal seed data comes from `scripts/seed.mjs` per B7.
- Gate screen: full screen, app title, one passcode field, one `Enter` button. Wrong code shakes the field and shows `Wrong passcode`. On success, if no `me` saved, show the person picker (6 avatars, tap one). Persist `me` in `members/{uid}.personId` and localStorage.
- Presence: heartbeat every 25 s while the tab is visible, on page change, and on `visibilitychange` to visible. `usePresence` filters to `lastSeen` within 60 s.
- `firestore.rules` per B5 plus validation; a rules unit test with `@firebase/rules-unit-testing` against the emulator covering: non member cannot read `people`; wrong code cannot create member; right code can; member can write items; nobody can read `passcodes`.
- Verify the real seed coordinates (B7) with Photon and write them into `seed.local.json` only. Write `scripts/seed.mjs`.
Accept: with real config, two browsers (one incognito) both pass the gate and see each other's item edits within 2 s; clearing site data sends you back to the gate; rules tests pass.

#### WP4. Geo library (`src/lib/geo/*`)

Pure TS, no React except `MapCanvas`.
- `photon.ts`: `searchPlaces(q, signal) -> PlaceHit[]` with `{name, address, lat, lng, osmRef, category}`; address built from `district`, `locality`, `city` (shortest useful part); `guessCategory(osm_key, osm_value)`: restaurant for `amenity=restaurant|fast_food|food_court`, cafe for `amenity=cafe|ice_cream` or `shop=coffee|bakery`, bar for `amenity=bar|pub|nightclub|biergarten`, else other.
- `gmapsUrl.ts`: `parseGoogleMapsUrl(url) -> {lat, lng, name?} | {error: 'short-link' | 'no-coords'}`; tests with real URL shapes.
- `links.ts`: `googleMapsUrl(poi)`, `googleEmbedUrl(poi)`, `wazeUrl(poi)`.
- `osrm.ts`: queued fetch, 1 per second, `fetchLeg(a, b) -> RouteLeg`.
- `legs.ts`: `buildLegs(items, pois, day) -> Leg[]`: sort items by `startMin`, keep those with a `poiId` whose POI exists, prepend `day.startPoiId`, append `day.endPoiId`, drop consecutive duplicates (same POI twice in a row), output `{index, from, to, key, colorVar}` where `colorVar = --leg-{(index % 8) + 1}`. Tests.
- `routeService.ts`: `resolveLegs(legs, store) -> Promise<ResolvedLeg[]>`: memory cache, then `store.getRoute`, then OSRM then `store.putRoute`; failed legs resolve as `{fallback: true}` straight line.
- `polyline.ts`: decode precision 5 to `[lng, lat][]`.
- `MapCanvas.tsx`: MapLibre wrapper that picks the light or dark style from `matchMedia`, swaps on change, centres on KL (`101.6869, 3.139`, zoom 11.5), exposes `onReady(map)`, cleans up on unmount, sets `cooperativeGestures` on touch so page scroll works.
Accept: unit tests for photon parsing (fixture JSON), category guess, URL parsing, legKey, buildLegs, polyline decode; `MapCanvas` renders in the UI gallery.

### Wave 2 (parallel after WP1 and WP4 merge; WP2 not required, use mock store)

#### WP3. App shell (`features/shell/*`, nav parts of `App.tsx`)

Build top bar with sidebar button, title (`ATT in KL` on overview, `Day plan` on plan), online `AvatarStack` from `usePresence`; sidebar per B10 with person picker; page transition fade. Gate wraps the shell when using Firestore.
Accept: sidebar opens and closes by button, scrim, Escape; picking a person updates `me` everywhere; avatars show only people online.

#### WP5. Arrivals calendar (`features/overview/arrivals/*`)

Layout (section title `Who's here`):
- Header row of 4 day columns: `Thu 19`, `Fri 20`, `Sat 21`, `Sun 22`, each column split into a 24 hour track (thin hour ticks every 6 hours, labels none).
- One row per person: visitors first in arrival order, Nicolino, then locals. Left cell: avatar plus name. Right: a bar on the person colour from arrival time to departure time across the 4 day track. Locals: full width bar at 35% opacity. Departure after 22 Nov: bar runs to the right edge and ends in a small chevron. No arrival set: no bar, a `Dates not set` label in `--label-3`.
- Small markers on the bar ends for the arrival and departure moments.
- A thin vertical `now` line when the current Malaysia time falls inside the window.
- Tap a row: it expands inline (or opens a Sheet on phones, builder's choice, match whichever reads cleaner) showing:
  - `Arrives` `Thu 19 Nov` `4 PM` `{place}`
  - `Leaves` `Sun 22 Nov` `12 PM` (or a date with `Time not set` when the time is null)
  - `Staying at` `{stay name}`
  - `Edit` button opening a sheet with `DayField`, `TimeField`, place text field for arrival and departure, and a stay picker (POIs with category stay). Saves via `updatePerson`.
Accept: renders the mock seed exactly (bars start and end at the seeded times; a departure after 22 Nov runs off the right edge); edits from another tab appear live; fits 360px width without horizontal scroll (rows may compress names to initials under 400px).

#### WP6. Day map (`features/overview/map/*`)

Layout (section title `Routes`): `SegmentedControl` with `Thu 19`, `Fri 20`, `Sat 21`, `Sun 22`, default today if inside the window else Thu 19. Map card 4:3 on phones, 16:9 wider, rounded `--r-card`. Below the map a leg list: numbered `Badge` in leg colour, `From name` and `To name` on two lines, trailing `18 min` and `6.2 km`.
Map content: one line layer per leg in its colour, 5px, white 8px casing under it, rounded joins; numbered circle markers per stop (start and end stay shown with a house icon); fit bounds to all stops with padding on day change. Tapping a stop marker shows a popover with the POI name and Google Maps and Waze buttons.
Refresh: subscribe to `useItems(date)`, `usePois()`, `useDays()`; recompute `buildLegs` on any change; debounce 600 ms; call `resolveLegs`; replace the GeoJSON source data. Loading legs show as dashed until resolved.
Accept: changing an item time in another tab redraws the route within about 2 s (cached legs instantly); a day with only the default meals unlinked shows just the stay marker; OSRM offline gives dashed straight lines and no crash.

#### WP7. Day timeline (`features/plan/timeline/*`)

Layout: `SegmentedControl` for the 4 days (synced with `#/plan/{date}`). A vertical 24 hour calendar, 00:00 to 24:00, 56px per hour, hour labels `12 AM`, `1 AM` ... `11 PM` in `--t-caption` on the left, half hour hairlines. Scrolls inside the page; initial scroll puts 9 AM at top. Glass floating `+` button bottom right.
Items: blocks from `startMin` to `endMin`, coloured by POI category (meal unlinked: neutral surface with dashed border and label `Lunch` or `Dinner`). Block shows POI name (or meal label), time range `12 PM to 1 PM`, and the leg number badge matching the map. Overlapping items share the width side by side (standard calendar column packing).
Interactions (pointer events, works with mouse and touch):
- Drag the block body to move. On touch, a 250 ms long press starts the drag so normal scroll still works. Snap to 30 min. Auto scroll near edges. Dragging is clamped to the day.
- Top and bottom handles (visible on hover and when selected, 44px hit area) resize, min 30 min.
- Write via `updateItem` only on release. Haptic style feedback: a subtle scale on pickup.
- Tap a block: Sheet with POI picker (same as add), `TimeField` start and end, `Delete`.
- Tap empty space: opens the add sheet prefilled with that half hour slot, 1 hour long.
- `+` button: add sheet, slot defaults to the first free hour from 10 AM.
- Add sheet: `SearchField` filtering existing POIs grouped by category; top row `New place` opens the WP8 `AddPlaceSheet` and on save links the new POI.
- Meals: tapping an unlinked meal opens the picker filtered to restaurants and cafes first.
- Remote changes animate into place; an item being dragged by this user ignores remote moves until drop.
Accept: drag and resize work on iOS Safari and desktop Chrome; times never land off the 30 minute grid; two tabs editing the same day converge; keyboard: selected block moves with arrow keys by 30 min, Shift+arrow resizes.

#### WP8. Places list and add place (`features/plan/places/*`)

Layout (section title `Places`): four `ListGroup`s titled `Restaurants`, `Cafes`, `Bars`, `Other` (stays and transport live in Other with a house or pin icon). Each row: category icon, name, address in `--label-2`, trailing count of itinerary uses if any (`2`). Trailing `+` button opens the place's add sheet with `Add to day plan` choices. Expanding a row shows: the embed (lazy iframe per B9 with fallback), `Google Maps` and `Waze` buttons, the note (editable inline), category picker, `Delete` (two step: second tap confirms, deletion unlinks items).
Header action `Add place` opens `AddPlaceSheet` (exported for WP7):
- `SearchField` with Photon results (name, address, guessed category chip). Pick fills the form.
- `Paste Google Maps link` row opens a text field, parses with `parseGoogleMapsUrl`.
- `Drop a pin` row shows a `MapCanvas` with a centre crosshair; `Use this spot`.
- Form: name, category (segmented, prefilled from guess), note. Save calls `addPoi`. Duplicate check: same `osmRef`, or same name within 100 m, shows `Already added` and selects the existing one.
Accept: adding `Jalan Alor` via search lands in Other or Restaurants with correct coordinates; Waze link opens navigation on a phone; deleting a POI used in the plan unlinks the item and the map redraws.

### Wave 3. Integration and polish (dispatcher, or one agent)

#### WP9. Integration QA

- Wire `firebaseConfig`, deploy rules (hand the file to Justin per A1 step 8), confirm seed on first join.
- Playwright smoke test on `?mock=1`: gate skipped in mock, overview renders 6 rows and the map, plan renders 8 meal blocks across days, add a place via a mocked Photon response, add it to Fri 20, map leg list updates.
- Screenshot pass at 375x812 and 1280x800, light and dark, for both pages; dispatcher reviews against B1 and B8 (no filler text, glass only on the floating layer, nothing overflows).
- Lighthouse on the deployed site: accessibility 95 or higher.
Accept: CI green, deployed URL works on Justin's phone, two people editing the same day at once see each other's changes.

---

## Part D. Dispatch and merge rules

1. Dispatcher completes WP0 on `main` (or merges its PR) first. Contract files are then frozen.
2. Wave 1: spawn WP1, WP2, WP4 in parallel, each on branch `wp{n}-{slug}` in its own worktree, each opens a PR to `main`.
3. Wave 2: once WP1 and WP4 are merged, spawn WP3, WP5, WP6, WP7, WP8 in parallel. They use `?mock=1`. WP7 imports `AddPlaceSheet` from WP8: WP0 ships a stub `AddPlaceSheet` with the final props `{open, onClose, onSaved(poiId)}` so WP7 does not wait.
4. Each builder prompt includes: this file, its package section, the owner file list, "do not edit files you do not own", and "report contract changes instead of making them".
5. Dispatcher reviews each PR against its acceptance criteria and B1 before merging; rebase conflicts are resolved by the dispatcher, not builders.
6. WP9 after all merge.
7. Justin is needed for: A1 config values (before WP2 can test against real Firebase), A1 step 7 passcode, A1 step 8 publishing rules, A2 Pages source. Everything else proceeds on the mock store.
