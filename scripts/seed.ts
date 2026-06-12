/**
 * Seed Firestore with the starter catalog.
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed
 *
 * Idempotent: products and categories are keyed by stable IDs, so re-running
 * overwrites rather than duplicates.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

function load<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'data', file), 'utf8')) as T;
}

async function main() {
  const products = load<Array<{ partNumber: string }>>('products.json');
  const categories = load<Array<{ id: string }>>('categories.json');

  const batch = db.batch();
  for (const c of categories) {
    batch.set(db.collection('categories').doc(c.id), c); // full replace — drops any stale fields
  }
  for (const p of products) {
    batch.set(db.collection('products').doc(p.partNumber), { ...p, updatedAt: Date.now() }); // full replace
  }
  await batch.commit();

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
