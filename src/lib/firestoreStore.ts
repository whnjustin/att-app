// Stub until WP2 lands. Returning null makes App fall back to the mock store.
import type { Store } from '../contracts/store';

export async function createFirestoreStore(): Promise<Store | null> {
  return null;
}
