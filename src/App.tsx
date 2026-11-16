import { Suspense, lazy, useEffect, useState } from 'react';
import { StoreProvider, type Store } from './contracts/store';
import { createMockStore } from './lib/mockStore';
import { createFirestoreStore } from './lib/firestoreStore';
import { firebaseConfig } from './config/firebase.config';
import { useRoute, type Route } from './lib/router';
import { Gate } from './features/gate';
import { Shell } from './features/shell';
import { ArrivalsCalendar } from './features/overview/arrivals';
import { DayMap } from './features/overview/map';
import { DayTimeline } from './features/plan/timeline';
import { PlacesList } from './features/plan/places';

const Gallery = import.meta.env.DEV ? lazy(() => import('./ui/Gallery')) : null;

function wantsMock(): boolean {
  const q = new URLSearchParams(window.location.search);
  return q.has('mock') || !firebaseConfig.projectId;
}

async function pickStore(): Promise<Store> {
  const q = new URLSearchParams(window.location.search);
  if (!wantsMock()) {
    const fs = await createFirestoreStore();
    if (fs) return fs;
  }
  const store = createMockStore({ reset: q.has('reset') });
  await store.ensureSeed();
  return store;
}

function OverviewPage() {
  return (
    <main className="page">
      <ArrivalsCalendar />
      <DayMap />
    </main>
  );
}

function PlanPage({ route }: { route: Extract<Route, { page: 'plan' }> }) {
  return (
    <main className="page">
      <DayTimeline date={route.date} />
      <PlacesList />
    </main>
  );
}

function Page({ route }: { route: Route }) {
  if (route.page === 'plan') return <PlanPage route={route} />;
  if (route.page === 'ui' && Gallery) {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    );
  }
  return <OverviewPage />;
}

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const route = useRoute();

  useEffect(() => {
    let alive = true;
    pickStore().then((s) => alive && setStore(s));
    return () => {
      alive = false;
    };
  }, []);

  if (!store) return null;

  return (
    <StoreProvider store={store}>
      <Gate>
        <Shell route={route}>
          <Page route={route} />
        </Shell>
      </Gate>
    </StoreProvider>
  );
}
