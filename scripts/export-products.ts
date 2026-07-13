/**
 * Refresh the static build snapshot (data/products.json) from live Firestore.
 * Runs automatically before a build via `npm run predeploy`.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run export:products
 *
 * If no credentials are present (e.g. local dev), it leaves the committed
 * snapshot untouched so the catalog still builds offline.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EXPORT) {
    console.warn('No credentials (set GOOGLE_APPLICATION_CREDENTIALS or FIRESTORE_EXPORT=1) — keeping committed data snapshot.');
    return;
  }

  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();

  const snap = await db.collection('products').orderBy('partNumber').get();
  const products = snap.docs
    .map((d) => {
      // Strip the internal-only vendor field (stored as `manufacturer`) so it
      // never ships in the public catalog bundle.
      const { updatedAt, manufacturer, ...rest } = d.data();
      void manufacturer;
      return { ...rest, updatedAt: updatedAt ?? null };
    })
    // Active-only — Inactive and Archived stay in Firestore (admin/analytics)
    // but never ship publicly. Spares ARE included now, so equipment pages can
    // list their BOM and search can match a spare (surfacing its parent).
    .filter((p) => (p as { status?: string }).status === 'Active');

  const out = resolve(process.cwd(), 'data', 'products.json');
  writeFileSync(out, JSON.stringify(products, null, 2) + '\n');
  console.log(`Wrote ${products.length} products to data/products.json`);

  const catSnap = await db.collection('categories').orderBy('order').get();
  const categories = catSnap.docs.map((d) => {
    const { updatedAt, ...rest } = d.data();
    return rest;
  });
  const catOut = resolve(process.cwd(), 'data', 'categories.json');
  writeFileSync(catOut, JSON.stringify(categories, null, 2) + '\n');
  console.log(`Wrote ${categories.length} categories to data/categories.json`);

  const siteDoc = await db.collection('site').doc('landing').get();
  const site = siteDoc.exists
    ? (() => {
        const { updatedAt, ...rest } = siteDoc.data() as Record<string, unknown>;
        return rest;
      })()
    : {};
  const siteOut = resolve(process.cwd(), 'data', 'site.json');
  writeFileSync(siteOut, JSON.stringify(site, null, 2) + '\n');
  console.log(`Wrote site config to data/site.json (${siteDoc.exists ? 'from Firestore' : 'empty — using defaults'})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
