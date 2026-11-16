// Run with: npm run test:rules (starts the Firestore emulator).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const CODE = 'test-code';
let env;

const item = (over = {}) => ({
  id: 'i1',
  date: '2026-11-20',
  kind: 'poi',
  meal: null,
  poiId: null,
  startMin: 600,
  endMin: 660,
  createdAt: 1,
  updatedAt: 1,
  updatedBy: null,
  ...over,
});

const poi = (over = {}) => ({
  id: 'p1',
  name: 'Place',
  category: 'cafe',
  lat: 3.1,
  lng: 101.6,
  address: 'Area',
  source: 'pin',
  osmRef: null,
  note: '',
  createdAt: 1,
  createdBy: null,
  updatedAt: 1,
  ...over,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-att-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'passcodes', CODE), { active: true });
    await setDoc(doc(db, 'people', 'ayyad'), { id: 'ayyad' });
    await setDoc(doc(db, 'members', 'member'), { uid: 'member', personId: null, joinedAt: 1, code: CODE });
  });
});

const asMember = () => env.authenticatedContext('member').firestore();
const asStranger = () => env.authenticatedContext('stranger').firestore();

describe('rules', () => {
  it('non member cannot read people', async () => {
    await assertFails(getDoc(doc(asStranger(), 'people', 'ayyad')));
  });

  it('unauthenticated cannot read people', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'people', 'ayyad')));
  });

  it('member can read people', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'people', 'ayyad')));
  });

  it('wrong code cannot create member', async () => {
    await assertFails(
      setDoc(doc(asStranger(), 'members', 'stranger'), {
        uid: 'stranger',
        personId: null,
        joinedAt: 1,
        code: 'nope',
      }),
    );
  });

  it('right code can create member', async () => {
    await assertSucceeds(
      setDoc(doc(asStranger(), 'members', 'stranger'), {
        uid: 'stranger',
        personId: null,
        joinedAt: 1,
        code: CODE,
      }),
    );
  });

  it('cannot create member for another uid', async () => {
    await assertFails(
      setDoc(doc(asStranger(), 'members', 'member2'), {
        uid: 'member2',
        personId: null,
        joinedAt: 1,
        code: CODE,
      }),
    );
  });

  it('member can set own personId but not the code', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'members', 'member'), { personId: 'ayyad' }));
    await assertFails(updateDoc(doc(asMember(), 'members', 'member'), { code: 'other' }));
  });

  it('nobody can read or write passcodes', async () => {
    await assertFails(getDoc(doc(asMember(), 'passcodes', CODE)));
    await assertFails(getDoc(doc(asStranger(), 'passcodes', CODE)));
    await assertFails(setDoc(doc(asMember(), 'passcodes', 'new'), { active: true }));
  });

  it('member can write items', async () => {
    await assertSucceeds(setDoc(doc(asMember(), 'items', 'i1'), item()));
  });

  it('non member cannot write items', async () => {
    await assertFails(setDoc(doc(asStranger(), 'items', 'i1'), item()));
  });

  it('rejects invalid items', async () => {
    const db = asMember();
    await assertFails(setDoc(doc(db, 'items', 'a'), item({ startMin: 615 })));
    await assertFails(setDoc(doc(db, 'items', 'b'), item({ startMin: -30 })));
    await assertFails(setDoc(doc(db, 'items', 'c'), item({ endMin: 600 })));
    await assertFails(setDoc(doc(db, 'items', 'd'), item({ endMin: 1470 })));
    await assertFails(setDoc(doc(db, 'items', 'e'), item({ startMin: 600.5 })));
    await assertFails(setDoc(doc(db, 'items', 'f'), item({ date: '2026-11-25' })));
    await assertFails(setDoc(doc(db, 'items', 'g'), item({ kind: 'other' })));
    await assertSucceeds(setDoc(doc(db, 'items', 'h'), item({ startMin: 1410, endMin: 1440 })));
  });

  it('validates pois', async () => {
    const db = asMember();
    await assertSucceeds(setDoc(doc(db, 'pois', 'p1'), poi()));
    await assertFails(setDoc(doc(db, 'pois', 'p2'), poi({ lat: 'x' })));
    await assertFails(setDoc(doc(db, 'pois', 'p3'), poi({ category: 'zoo' })));
    await assertFails(setDoc(doc(db, 'pois', 'p4'), poi({ name: '' })));
  });
});
