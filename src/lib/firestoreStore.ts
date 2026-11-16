import type { Store, Unsub } from '../contracts/store';
import type {
  DateKey,
  DayConfig,
  ItineraryItem,
  Person,
  PersonId,
  Poi,
  Presence,
  RouteLeg,
} from '../contracts/types';
import { SEED_VERSION, defaultDays, defaultItems } from '../contracts/seed';
import { firebaseConfig } from '../config/firebase.config';
import { isPermissionDenied, isPersonId, normalizeCode, readStoredMe, writeStoredMe } from './auth';

export async function createFirestoreStore(): Promise<Store | null> {
  if (!firebaseConfig.projectId) return null;

  const [{ initializeApp }, auth, fs] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);

  const app = initializeApp(firebaseConfig);
  const fbAuth = auth.getAuth(app);
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });

  let uid: string | null = null;
  let me: PersonId | null = readStoredMe();
  const meListeners = new Set<(id: PersonId | null) => void>();

  const setLocalMe = (id: PersonId | null) => {
    if (id === me) return;
    me = id;
    if (id) writeStoredMe(id);
    meListeners.forEach((cb) => cb(me));
  };

  const requireUid = (): string => {
    if (!uid) throw new Error('not signed in');
    return uid;
  };

  const stamp = () => ({ updatedAt: Date.now(), updatedBy: me });

  function watchCol<T>(
    q: ReturnType<typeof fs.collection> | ReturnType<typeof fs.query>,
    cb: (v: T[]) => void,
  ): Unsub {
    return fs.onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => d.data() as T)),
      () => cb([]),
    );
  }

  const store: Store = {
    kind: 'firestore',

    async signIn() {
      if (!fbAuth.currentUser) {
        await auth.signInAnonymously(fbAuth);
      }
      const id = fbAuth.currentUser?.uid;
      if (!id) throw new Error('sign in failed');
      uid = id;
      return id;
    },

    async isMember() {
      const id = requireUid();
      try {
        const snap = await fs.getDoc(fs.doc(db, 'members', id));
        if (!snap.exists()) return false;
        const pid = (snap.data() as { personId?: unknown }).personId;
        if (isPersonId(pid)) setLocalMe(pid);
        else if (me) {
          // Local choice not yet saved to the member doc.
          fs.updateDoc(fs.doc(db, 'members', id), { personId: me }).catch(() => {});
        }
        return true;
      } catch (err) {
        if (isPermissionDenied(err)) return false;
        throw err;
      }
    },

    async join(code) {
      const id = requireUid();
      try {
        await fs.setDoc(fs.doc(db, 'members', id), {
          uid: id,
          personId: null,
          joinedAt: Date.now(),
          code: normalizeCode(code),
        });
        return 'ok';
      } catch (err) {
        if (isPermissionDenied(err)) return 'bad-code';
        throw err;
      }
    },

    async setMe(personId) {
      setLocalMe(personId);
      writeStoredMe(personId);
      await fs.updateDoc(fs.doc(db, 'members', requireUid()), { personId });
    },

    me: () => me,

    watchMe(cb) {
      cb(me);
      meListeners.add(cb);
      return () => {
        meListeners.delete(cb);
      };
    },

    watchPeople: (cb) => watchCol<Person>(fs.collection(db, 'people'), cb),
    watchPois: (cb) => watchCol<Poi>(fs.collection(db, 'pois'), cb),
    watchItems: (date: DateKey | 'all', cb) =>
      watchCol<ItineraryItem>(
        date === 'all'
          ? fs.collection(db, 'items')
          : fs.query(fs.collection(db, 'items'), fs.where('date', '==', date)),
        cb,
      ),
    watchDays: (cb) => watchCol<DayConfig>(fs.collection(db, 'days'), cb),
    watchPresence: (cb) => watchCol<Presence>(fs.collection(db, 'presence'), cb),

    async updatePerson(id, patch) {
      await fs.updateDoc(fs.doc(db, 'people', id), { ...patch, ...stamp() });
    },

    async addPoi(p) {
      const ref = fs.doc(fs.collection(db, 'pois'));
      const now = Date.now();
      const poi: Poi = { ...p, id: ref.id, createdAt: now, updatedAt: now, createdBy: me };
      await fs.setDoc(ref, poi);
      return ref.id;
    },

    async updatePoi(id, patch) {
      const rest: Partial<Poi> = { ...patch };
      delete rest.id;
      await fs.updateDoc(fs.doc(db, 'pois', id), { ...rest, updatedAt: Date.now() });
    },

    async deletePoi(id) {
      const used = await fs.getDocs(fs.query(fs.collection(db, 'items'), fs.where('poiId', '==', id)));
      const batch = fs.writeBatch(db);
      const s = stamp();
      used.forEach((d) => batch.update(d.ref, { poiId: null, ...s }));
      batch.delete(fs.doc(db, 'pois', id));
      await batch.commit();
    },

    async addItem(i) {
      const ref = fs.doc(fs.collection(db, 'items'));
      const now = Date.now();
      const item: ItineraryItem = { ...i, id: ref.id, createdAt: now, updatedAt: now, updatedBy: me };
      await fs.setDoc(ref, item);
      return ref.id;
    },

    async updateItem(id, patch) {
      await fs.updateDoc(fs.doc(db, 'items', id), { ...patch, ...stamp() });
    },

    async deleteItem(id) {
      await fs.deleteDoc(fs.doc(db, 'items', id));
    },

    async updateDay(date, patch) {
      await fs.setDoc(fs.doc(db, 'days', date), { ...patch, date }, { merge: true });
    },

    async getRoute(key) {
      const snap = await fs.getDoc(fs.doc(db, 'routes', key));
      return snap.exists() ? (snap.data() as RouteLeg) : null;
    },

    async putRoute(leg) {
      await fs.setDoc(fs.doc(db, 'routes', leg.key), leg);
    },

    async heartbeat(page) {
      const id = requireUid();
      const p: Presence = { uid: id, personId: me, page, lastSeen: Date.now() };
      await fs.setDoc(fs.doc(db, 'presence', id), p);
    },

    async ensureSeed() {
      const now = Date.now();
      const items = defaultItems(now);
      const days = defaultDays();
      await fs.runTransaction(db, async (tx) => {
        const metaRef = fs.doc(db, 'meta', 'seed');
        if ((await tx.get(metaRef)).exists()) return;
        const itemSnaps = await Promise.all(items.map((i) => tx.get(fs.doc(db, 'items', i.id))));
        const daySnaps = await Promise.all(days.map((d) => tx.get(fs.doc(db, 'days', d.date))));
        items.forEach((i, n) => {
          if (!itemSnaps[n].exists()) tx.set(fs.doc(db, 'items', i.id), i);
        });
        days.forEach((d, n) => {
          if (!daySnaps[n].exists()) tx.set(fs.doc(db, 'days', d.date), d);
        });
        tx.set(metaRef, { version: SEED_VERSION, at: now });
      });
    },
  };

  return store;
}
