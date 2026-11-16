import { useEffect } from 'react';
import { Avatar, ListGroup, ListRow, Sidebar } from '../../ui';
import { useMe, usePeople, useStore } from '../../contracts/store';
import { navigate } from '../../lib/router';

interface Props {
  open: boolean;
  page: 'overview' | 'plan';
  onClose: () => void;
}

function Check() {
  return (
    <svg className="shell-check" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShellSidebar({ open, page, onClose }: Props) {
  const store = useStore();
  const me = useMe();
  const people = usePeople();

  // Close on any navigation, including browser back.
  useEffect(() => {
    window.addEventListener('hashchange', onClose);
    return () => window.removeEventListener('hashchange', onClose);
  }, [onClose]);

  const go = (target: 'overview' | 'plan') => {
    onClose();
    if (target !== page) navigate(target === 'plan' ? { page: 'plan', date: null } : { page: 'overview' });
  };

  return (
    <Sidebar open={open} onClose={onClose} label="Menu">
      <div className="shell-side">
        <ListGroup>
          <ListRow
            title="Overview"
            onClick={() => go('overview')}
            trailing={page === 'overview' ? <Check /> : undefined}
          />
          <ListRow
            title="Day plan"
            onClick={() => go('plan')}
            trailing={page === 'plan' ? <Check /> : undefined}
          />
        </ListGroup>
        <ListGroup title="You are">
          {people.map((p) => (
            <ListRow
              key={p.id}
              leading={<Avatar initials={p.initials} colorToken={p.colorToken} label={p.name} size={32} />}
              title={p.name}
              trailing={me === p.id ? <Check /> : undefined}
              onClick={() => {
                void store.setMe(p.id);
              }}
            />
          ))}
        </ListGroup>
      </div>
    </Sidebar>
  );
}
