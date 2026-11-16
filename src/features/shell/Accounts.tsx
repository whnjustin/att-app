import { useRef, useState } from 'react';
import { Avatar, AvatarStack, Icon, IconButton, Sheet } from '../../ui';
import {
  useBackgrounds,
  useMe,
  useMyBackground,
  usePeople,
  usePresence,
  useStore,
} from '../../contracts/store';
import { BACKGROUND_MAX_CHARS } from '../../contracts/types';
import { compressImageFile } from './compress';
import { onlinePeople } from './online';

export function ProfileButton() {
  const [open, setOpen] = useState(false);
  const me = useMe();
  const people = usePeople();
  const online = onlinePeople(usePresence(), people);
  const mine = people.find((p) => p.id === me);
  const others = online.filter((p) => p.id !== me).length;

  return (
    <>
      <button
        type="button"
        className="shell-profile glass"
        aria-label="Accounts"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {mine ? (
          <Avatar initials={mine.initials} colorToken={mine.colorToken} label={mine.name} size={36} />
        ) : (
          <Icon name="person" size={24} />
        )}
        {others > 0 ? <span className="shell-ring" aria-hidden="true" /> : null}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Accounts" detent="large">
        <AccountsBody />
      </Sheet>
    </>
  );
}

function AccountsBody() {
  const store = useStore();
  const me = useMe();
  const people = usePeople();
  const online = onlinePeople(usePresence(), people);
  const backgrounds = useBackgrounds();
  const mineBg = useMyBackground();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const url = await compressImageFile(file, BACKGROUND_MAX_CHARS);
      if (!url) {
        setError('Image too large');
        return;
      }
      const id = await store.addBackground(url);
      await store.setMyBackground(id);
    } catch {
      setError('Image too large');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acc">
      <section className="acc-sec" aria-labelledby="acc-you">
        <h3 id="acc-you" className="acc-h">
          You are
        </h3>
        <div className="acc-people" role="radiogroup" aria-label="You are">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={me === p.id}
              className="acc-person"
              onClick={() => {
                void store.setMe(p.id);
              }}
            >
              <span className={`acc-av${me === p.id ? ' on' : ''}`}>
                <Avatar initials={p.initials} colorToken={p.colorToken} label={p.name} size={48} />
              </span>
              <span className="acc-name">{p.name}</span>
            </button>
          ))}
        </div>
      </section>

      {online.length ? (
        <section className="acc-sec" aria-labelledby="acc-online">
          <h3 id="acc-online" className="acc-h">
            Online
          </h3>
          <AvatarStack
            max={6}
            people={online.map((p) => ({
              initials: p.initials,
              colorToken: p.colorToken,
              label: `${p.name} online`,
            }))}
          />
        </section>
      ) : null}

      <section className="acc-sec" aria-labelledby="acc-bg">
        <h3 id="acc-bg" className="acc-h">
          Background
        </h3>
        <div className="acc-grid">
          <button
            type="button"
            className={`acc-tile acc-none${mineBg === null ? ' on' : ''}`}
            aria-pressed={mineBg === null}
            onClick={() => {
              void store.setMyBackground(null);
            }}
          >
            None
          </button>
          {backgrounds.map((b) => {
            const own = me !== null && b.createdBy === me;
            const selected = mineBg?.id === b.id;
            return (
              <div key={b.id} className="acc-cell">
                <button
                  type="button"
                  className={`acc-tile${selected ? ' on' : ''}`}
                  aria-label="Background"
                  aria-pressed={selected}
                  style={{ backgroundImage: `url("${b.dataUrl}")` }}
                  onClick={() => {
                    void store.setMyBackground(b.id);
                  }}
                />
                {own ? (
                  confirm === b.id ? (
                    <button
                      type="button"
                      className="acc-del acc-del-confirm"
                      onClick={() => {
                        setConfirm(null);
                        void store.deleteBackground(b.id);
                      }}
                    >
                      Confirm
                    </button>
                  ) : (
                    <IconButton
                      icon="trash"
                      iconSize={16}
                      aria-label="Delete background"
                      className="acc-del"
                      onClick={() => setConfirm(b.id)}
                    />
                  )
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            className="acc-tile acc-none"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="upload" size={20} />
            Upload
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          data-testid="bg-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload(f);
          }}
        />
        {error ? (
          <p className="acc-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
