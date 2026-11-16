import type { ReactNode } from 'react';
import { useMyBackground } from '../../contracts/store';
import type { Route } from '../../lib/router';
import { usePresenceHeartbeat } from '../../lib/presence';
import { NavButton } from './NavButton';
import { ProfileButton } from './Accounts';
import './shell.css';

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  if (route.page === 'ui') return <>{children}</>;
  return <ShellFrame page={route.page}>{children}</ShellFrame>;
}

function ShellFrame({ page, children }: { page: 'overview' | 'plan'; children: ReactNode }) {
  usePresenceHeartbeat(page);
  const bg = useMyBackground();

  return (
    <>
      {bg ? (
        <div className="shell-bg" aria-hidden="true" style={{ backgroundImage: `url("${bg.dataUrl}")` }}>
          <div className="shell-bg-veil" />
        </div>
      ) : null}
      <ProfileButton />
      <div className="shell-page" key={page}>
        <h1 className={page === 'plan' ? 'shell-title shell-title-plan' : 'shell-title shell-title-home'}>
          {page === 'plan' ? 'Day plan' : 'ATT in KL'}
        </h1>
        {children}
      </div>
      <NavButton page={page} />
    </>
  );
}
