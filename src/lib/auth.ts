import type { PersonId } from '../contracts/types';
import { PERSON_IDS } from '../contracts/seed';

export const ME_KEY = 'att.me';

export function isPersonId(v: unknown): v is PersonId {
  return typeof v === 'string' && (PERSON_IDS as string[]).includes(v);
}

/** Read the saved identity from localStorage. Never throws. */
export function readStoredMe(): PersonId | null {
  try {
    const v = localStorage.getItem(ME_KEY);
    return isPersonId(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeStoredMe(id: PersonId): void {
  try {
    localStorage.setItem(ME_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

/** Passcodes are compared as typed, minus surrounding whitespace. */
export function normalizeCode(code: string): string {
  return code.trim();
}

/** Firestore permission errors map to a wrong passcode on join. */
export function isPermissionDenied(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'permission-denied';
}
