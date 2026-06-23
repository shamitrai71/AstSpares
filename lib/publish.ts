import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** Admin-only: kick off a Cloud Build run to rebuild + redeploy the static catalog. */
export async function publishCatalog(): Promise<void> {
  const fn = httpsCallable<undefined, { ok: boolean }>(functions, 'publishCatalog');
  await fn();
}
