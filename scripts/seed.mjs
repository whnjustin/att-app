// Writes the real seed data from ./seed.local.json (gitignored) to Firestore.
// Usage: node scripts/seed.mjs <passcode> [--force]
// Without --force nothing is written when meta/seed already exists.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, writeBatch } from 'firebase/firestore';

const SEED_VERSION = 1;
const TRIP_DAYS = ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
const HOME_POI_ID = 'home';

// Duplicate of the public skeleton in src/contracts/seed.ts.
const PEOPLE = [
  { id: 'ayyad', name: 'Ayyad', initials: 'A', colorToken: '--person-ayyad', role: 'visitor' },
  { id: 'bqck', name: 'Bqck', initials: 'B', colorToken: '--person-bqck', role: 'visitor' },
  { id: 'xavier', name: 'Xavier', initials: 'X', colorToken: '--person-xavier', role: 'visitor' },
  { id: 'nicolino', name: 'Nicolino', initials: 'N', colorToken: '--person-nicolino', role: 'visitor' },
  { id: 'justinn', name: 'Justin N', initials: 'JN', colorToken: '--person-justinn', role: 'local' },
  { id: 'justinw', name: 'Justin W', initials: 'JW', colorToken: '--person-justinw', role: 'local' },
];

const args = process.argv.slice(2);
const force = args.includes('--force');
const code = args.find((a) => !a.startsWith('--'));
if (!code) {
  console.error('Usage: node scripts/seed.mjs <passcode> [--force]');
  process.exit(1);
}

let local;
try {
  local = JSON.parse(readFileSync('seed.local.json', 'utf8'));
} catch (err) {
  console.error(`Cannot read seed.local.json: ${err.message}`);
  process.exit(1);
}

// Read the public web config from the app source.
const cfgText = readFileSync('src/config/firebase.config.ts', 'utf8');
const firebaseConfig = {};
for (const m of cfgText.matchAll(/(\w+):\s*'([^']*)'/g)) firebaseConfig[m[1]] = m[2];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const { user } = await signInAnonymously(auth);
const now = Date.now();

await setDoc(doc(db, 'members', user.uid), {
  uid: user.uid,
  personId: null,
  joinedAt: now,
  code: code.trim(),
}).catch((err) => {
  console.error(`Join failed: ${err.code ?? err.message}`);
  process.exit(1);
});

const metaRef = doc(db, 'meta', 'seed');
const exists = (await getDoc(metaRef)).exists();
if (exists && !force) {
  console.log('meta/seed exists, nothing written (use --force to overwrite people and pois)');
  process.exit(0);
}

const batch = writeBatch(db);

for (const p of PEOPLE) {
  const extra = (local.people ?? []).find((x) => x.id === p.id) ?? {};
  batch.set(doc(db, 'people', p.id), {
    ...p,
    stayPoiId: extra.stayPoiId ?? null,
    arrival: extra.arrival ?? null,
    departure: extra.departure ?? null,
    updatedAt: now,
    updatedBy: null,
  });
}

for (const p of local.pois ?? []) {
  batch.set(doc(db, 'pois', p.id), {
    id: p.id,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    address: p.address ?? '',
    source: 'seed',
    osmRef: null,
    note: '',
    createdAt: now,
    createdBy: null,
    updatedAt: now,
  });
}

if (!exists) {
  for (const date of TRIP_DAYS) {
    for (const [meal, startMin, endMin] of [
      ['lunch', 720, 780],
      ['dinner', 1200, 1260],
    ]) {
      batch.set(doc(db, 'items', `${date}-${meal}`), {
        id: `${date}-${meal}`,
        date,
        kind: 'meal',
        meal,
        poiId: null,
        startMin,
        endMin,
        createdAt: now,
        updatedAt: now,
        updatedBy: null,
      });
    }
    batch.set(doc(db, 'days', date), { date, startPoiId: HOME_POI_ID, endPoiId: HOME_POI_ID });
  }
  batch.set(metaRef, { version: SEED_VERSION, at: now });
}

await batch.commit();
console.log(`Seeded ${PEOPLE.length} people, ${(local.pois ?? []).length} pois${exists ? ' (forced)' : ''}`);
process.exit(0);
