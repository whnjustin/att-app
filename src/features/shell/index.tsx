import { useState, type ReactNode } from 'react';
import { AvatarStack, IconButton, TopBar } from '../../ui';
import { usePeople, usePresence } from '../../contracts/store';
import type { Route } from '../../lib/router';
import { onlinePeople } from './online';
import { usePresenceHeartbeat } from '../../lib/presence';
import { ShellSidebar } from './ShellSidebar';
import './shell.css';

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  if (route.page === 'ui') return <>{children}</>;
  return <ShellFrame page={route.page}>{children}</ShellFrame>;
}

function ShellFrame({ page, children }: { page: 'overview' | 'plan'; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  usePresenceHeartbeat(page);
  const online = onlinePeople(usePresence(), usePeople());
  const title = page === 'plan' ? 'Day plan' : 'ATT in KL';

  return (
    <>
      <TopBar
        title={title}
        leading={<IconButton icon="sidebar" aria-label="Open menu" onClick={() => setOpen(true)} />}
        trailing={
          online.length ? (
            <AvatarStack
              people={online.map((p) => ({
                initials: p.initials,
                colorToken: p.colorToken,
                label: `${p.name} online`,
              }))}
            />
          ) : null
        }
      />
      <div className="shell-page" key={page}>
        {children}
      </div>
      <ShellSidebar open={open} page={page} onClose={() => setOpen(false)} />
    </>
  );
}
