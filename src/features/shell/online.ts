import type { Person, PersonId, Presence } from '../../contracts/types';

/** People currently online: deduped by personId, null ids skipped, in people order. */
export function onlinePeople(presence: Presence[], people: Person[]): Person[] {
  const ids = new Set<PersonId>();
  for (const p of presence) if (p.personId) ids.add(p.personId);
  return people.filter((p) => ids.has(p.id));
}
