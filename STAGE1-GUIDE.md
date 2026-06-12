# ASTSPARES — Phase 2, Stage 1: Catalog management

Hierarchical categories + full product/category CRUD in the admin, with Cloudinary image URLs. This is a drop-in update to your existing repo.

## What changed

**Data model**
- `Category` is now hierarchical: `{ id, slug, name, blurb, parentId, code?, order }`. `id` is path-derived (ancestor slugs + own slug joined by `--`, e.g. `rim-seals--primary--mechanical-shoe`). Top-level categories carry `code` (the AST part-number prefix, e.g. `RS`); descendants inherit it.
- Products now reference a category node via `categoryId` (was the flat `category` slug). `family` is kept as a denormalised copy of the top-level code for badges.
- Product `images` are now Cloudinary (or any) URLs — rendered on cards and the product page. First URL is the thumbnail.

**Public site**
- `/products/[category]` (single level) is replaced by a catch-all `/products/[...slug]` that renders nested URLs like `/products/rim-seals/primary/mechanical-shoe/`, shows sub-categories, and lists every product in that node *and its descendants*. Breadcrumbs are built from the path.
- Header nav and the home "Browse by family" cards are now generated from the top-level categories (no more hardcoded list).

**Admin**
- New **Categories** tab: tree view with create / edit / delete. Slug auto-derives from the name; parent is chosen from a dropdown; top-level nodes get a code field. Slug/parent lock on edit (changing them would re-key the doc); delete is blocked while sub-categories exist.
- **Products** tab rebuilt: a real list with a full create/edit form — category picker, part-number field (auto-prefixed `AST-<code>-` from the chosen category), Cloudinary image URLs, features, compatible equipment, a specs editor and a datasheets editor, plus inline stock/active toggles and delete. Part numbers validate against `AST-<code>-<number>`.

**Rules / scripts**
- `firestore.rules`: added a `categories` collection (public read, admin write).
- `scripts/seed.ts`: categories now keyed by `id` (not slug), and seeding is a full replace so the migration cleanly drops old fields.
- `scripts/export-products.ts`: now also snapshots `data/categories.json` from Firestore.

### Files
Changed: `lib/types.ts`, `lib/catalog.ts`, `lib/db.ts`, `data/categories.json`, `data/products.json`, `firestore.rules`, `app/layout.tsx`, `app/page.tsx`, `app/product/[slug]/page.tsx`, `components/Header.tsx`, `components/ProductCard.tsx`, `components/CatalogBrowser.tsx`, `app/admin/layout.tsx`, `app/admin/products/page.tsx`, `scripts/seed.ts`, `scripts/export-products.ts`
New: `app/products/[...slug]/page.tsx`, `app/admin/categories/page.tsx`
Removed: `app/products/[category]/page.tsx`

## How to apply

1. **Extract over your existing project folder**, overwriting when prompted. Your `.env.local`, `functions/.env`, `.firebaserc` and `service-account.json` are *not* in the zip, so they stay as they are. Then delete the now-removed route folder if your unzip didn't: `app/products/[category]/`.
2. Review the diff: `git status` then `git add -A && git commit -m "Phase 2 Stage 1: hierarchical categories + admin CRUD"` (commit before deploying so you can roll back).

## Migrate the live data (re-seed)

Because the category shape changed and products switched to `categoryId`, re-seed Firestore (this is a clean replace — it overwrites the 10 starter products and the categories with the new shape). Pre-launch with no real data, this is safe; **it will overwrite any stock/lead-time edits you made in the admin.**

In **Cloud Shell** (same as last time — no local service-account key needed):
```
git clone https://github.com/shamitrai71/AstSpares.git && cd AstSpares
npm install
export GOOGLE_CLOUD_PROJECT=astspares
npm run seed
```
(Run this after you've pushed this update to GitHub, so Cloud Shell clones the new data files.)

Then deploy the updated rules:
```
firebase deploy --only firestore:rules
```

## Preview

```
npm run dev
```
Open `/admin/categories/` and `/admin/products/` to manage the catalog, and browse `/products/rim-seals/primary/mechanical-shoe/` to see the nested hierarchy.

## Note on "going live"

Your admin edits write to Firestore immediately, but the public catalog is statically generated — so changes appear on the deployed site only after a rebuild. Right now that means running `npm run deploy` locally (it runs `export:products` to refresh the snapshot, rebuilds, and deploys). **Stage 2 is the publish pipeline** that turns this into a button/automated flow so you don't touch the command line to push catalog changes. Until then, `npm run deploy` is the way to push.

If you `npm run deploy` now, the staging site reflects Stage 1; if you'd rather wait and review more locally first, that's fine too — nothing is public yet.
