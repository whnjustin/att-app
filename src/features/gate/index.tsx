import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useStore, type Store } from '../../contracts/store';
import { PEOPLE } from '../../contracts/seed';
import type { PersonId } from '../../contracts/types';
import './gate.css';

type Phase = 'loading' | 'code' | 'seeding' | 'picker' | 'ready';

function useMeValue(store: Store): PersonId | null {
  const [me, setMe] = useState<PersonId | null>(() => store.me());
  useEffect(() => store.watchMe(setMe), [store]);
  return me;
}

function Passcode({ store, onDone }: { store: Store; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await store.join(code);
      if (r === 'ok') {
        onDone();
        return;
      }
    } catch {
      /* treated as a failed attempt */
    }
    setWrong(true);
    setShake((n) => n + 1);
    setBusy(false);
    input.current?.focus();
  }

  return (
    <main className="gate">
      <form className="gate-card" onSubmit={submit}>
        <h1 className="gate-title">ATT in KL</h1>
        <input
          key={shake}
          ref={input}
          className={`gate-input${shake ? ' gate-shake' : ''}`}
          type="password"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Passcode"
          aria-invalid={wrong}
          value={code}
          autoFocus
          onChange={(e) => {
            setCode(e.target.value);
            setWrong(false);
          }}
        />
        <p className="gate-error" role="alert">
          {wrong ? 'Wrong passcode' : ''}
        </p>
        <button className="gate-button" type="submit" disabled={busy || code.trim() === ''}>
          Enter
        </button>
      </form>
    </main>
  );
}

function Picker({ store }: { store: Store }) {
  return (
    <main className="gate">
      <div className="gate-card gate-card-wide">
        <h1 className="gate-title">ATT in KL</h1>
        <div className="gate-grid">
          {PEOPLE.map((p) => (
            <button
              key={p.id}
              type="button"
              className="gate-person"
              onClick={() => {
                store.setMe(p.id).catch(() => {});
              }}
            >
              <span className="gate-avatar" style={{ background: `var(${p.colorToken})` }}>
                {p.initials}
              </span>
              <span className="gate-name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function FirestoreGate({ store, children }: { store: Store; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const me = useMeValue(store);

  async function enter() {
    setPhase('seeding');
    try {
      await store.ensureSeed();
    } catch {
      /* seed is best effort, the app works without it */
    }
    setPhase('picker');
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await store.signIn();
        const member = await store.isMember();
        if (!alive) return;
        if (member) await enter();
        else setPhase('code');
      } catch {
        if (alive) setPhase('code');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  if (phase === 'loading' || phase === 'seeding') return <main className="gate" aria-busy="true" />;
  if (phase === 'code') return <Passcode store={store} onDone={enter} />;
  if (me === null) return <Picker store={store} />;
  return <>{children}</>;
}

export function Gate({ children }: { children: ReactNode }) {
  const store = useStore();
  if (store.kind !== 'firestore') return <>{children}</>;
  return <FirestoreGate store={store}>{children}</FirestoreGate>;
}
