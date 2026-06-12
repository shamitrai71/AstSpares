# ASTSPARES

B2B industrial procurement platform for storage-tank and terminal spare parts —
**part-number catalog + RFQ**, no public pricing.

Rim seals · flame arrestors · PV valves · hoses · gaskets.

---

## Why it's built this way

- **Static-first (Next.js `output: 'export'`).** The catalog is the SEO lead-source
  and barely changes minute-to-minute, so every product/category page is
  pre-rendered to plain HTML and served from Firebase Hosting. This deliberately
  avoids SSR on Cloud Run and the `asia-south1` domain-mapping friction.
- **Firestore is the single source of truth.** `data/products.json` is a build-time
  snapshot. The admin panel writes to Firestore; `npm run export:products`
  regenerates the snapshot before each deploy.
- **RFQ, not checkout.** The cart adds parts to a request; submission writes one
  Firestore document and a Cloud Function emails sales + the customer (via Resend).
- **Part number is the key.** `AST-<family>-####` (e.g. `AST-RS-1001`) is the
  Firestore doc ID, the URL slug stem, and the join key for inventory and future ERP.

## Stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| Framework      | Next.js 14 (App Router, static export)   |
| Styling        | Tailwind — industrial-editorial tokens   |
| Auth           | Firebase Auth (Email, Google, Microsoft) |
| Database       | Firestore                                |
| Files          | Cloud Storage                            |
| RFQ processing | Cloud Functions (`asia-south1`)          |
| Email          | Resend                                   |
| Hosting        | Firebase Hosting                         |

## Local development

```bash
npm install
cp .env.example .env.local        # fill in NEXT_PUBLIC_FIREBASE_* from your Firebase project
npm run dev                       # http://localhost:3000
```

The catalog renders from `data/products.json` with no Firebase needed. Auth, RFQ
submission, and admin require a real Firebase project.

## Firebase setup

```bash
npm i -g firebase-tools
firebase login
firebase use --add                # select your project (id: astspares or your own)

# Auth: enable Email/Password, Google, and Microsoft providers in the console.
# Grant yourself admin: create a doc at  admins/<your-uid>  (any fields).

# Seed the catalog into Firestore:
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed

# RFQ email (Cloud Functions):
firebase functions:secrets:set RESEND_API_KEY
# set SALES_EMAIL and FROM_EMAIL as functions env vars (verified Resend domain)
```

## Deploy

```bash
npm run deploy
# = export:products (Firestore -> snapshot) -> next build -> firebase deploy
#   (hosting + firestore rules/indexes + functions)
```

## Project layout

```
app/
  page.tsx                 home (hero, families, featured)
  products/                all parts (client filter + search)
  products/[category]/     SSG category pages
  product/[slug]/          SSG product detail (+ Product JSON-LD)
  rfq/                     review & submit RFQ
  admin/                   auth-gated: dashboard, RFQ queue, product edits
components/                Header, RfqProvider/Drawer, ProductCard, etc.
lib/                       types, firebase, catalog (build-time), db (client)
data/                      products.json + categories.json (build snapshot)
functions/                 onRfqCreated → Resend emails
scripts/                   seed.ts, export-products.ts
firestore.rules            public catalog read, public RFQ create, admin-only rest
```

## Built (Phase 1) vs. next

**Built:** catalog + categories + part-number search/filter, product pages with
specs & JSON-LD, full RFQ cart → submit → email workflow, admin login + RFQ
pipeline + quick product edits, security rules, seed/export tooling.

**Next:** dedicated inventory module UI (qty/reserved/min-stock, low-stock alerts),
full product create/edit form with Storage image uploads, Algolia for typo-tolerant
search at scale, customer accounts + RFQ history, then Phase 3 AI assistant and the
distributor/multi-warehouse/ERP work.
