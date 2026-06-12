# ASTSPARES — Cloud Build auto-deploy setup

Goal: push to GitHub (or click "Run") → Google Cloud Build refreshes the catalog from Firestore, builds the static site, and deploys to Firebase Hosting. No local builds, no zip extraction, no service-account key.

Pieces added to the repo: `cloudbuild.yaml` (the pipeline) and a one-line change to `scripts/export-products.ts` so it can read Firestore using Cloud Build's identity.

---

## 1. Get the correct code onto GitHub

The bracketed Next.js route folders didn't survive the Windows zip extraction last time. Re-extract with `tar` (it doesn't choke on `[ ]`), from the repo root:

```
tar -xf "$env:USERPROFILE\Downloads\astspares-stage1-cloudbuild.zip"
Remove-Item -LiteralPath "app\products\[category]" -Recurse -Force
```

Verify (want True / False):
```
Test-Path -LiteralPath "app\products\[...slug]\page.tsx"
Test-Path -LiteralPath "app\products\[category]"
```

Then commit + push via GitHub Desktop / VS Code (your git auth already works there). The commit should show the new `[...slug]` route added, `[slug]\page.tsx` modified, `[category]` deleted, plus `cloudbuild.yaml`.

---

## 2. Enable APIs + grant the build service account (Cloud Shell)

All `gcloud` runs in Cloud Shell.

```
gcloud config set project astspares

gcloud services enable cloudbuild.googleapis.com firebase.googleapis.com cloudresourcemanager.googleapis.com

# This project builds as the compute service account (you granted it the
# Cloud Build builder role earlier for the function deploy).
SA=29510678571-compute@developer.gserviceaccount.com

gcloud projects add-iam-policy-binding astspares --member="serviceAccount:$SA" --role="roles/cloudbuild.builds.builder"
gcloud projects add-iam-policy-binding astspares --member="serviceAccount:$SA" --role="roles/firebase.admin"
gcloud projects add-iam-policy-binding astspares --member="serviceAccount:$SA" --role="roles/serviceusage.apiKeysAdmin"
```

`roles/firebase.admin` covers both the Firestore read (export step) and the Hosting deploy. `apiKeysAdmin` lets the deploy read the Hosting config.

---

## 3. Connect GitHub + create the trigger (Console)

1. Google Cloud Console → **Cloud Build → Triggers**.
2. **Connect repository** → GitHub → authorize the Cloud Build GitHub app → pick `shamitrai71/AstSpares`.
3. **Create trigger**:
   - Name: `astspares-deploy`
   - Event: **Push to a branch**
   - Branch: `^main$` (use `^master$` if that's your default branch)
   - Configuration: **Cloud Build configuration file (yaml)**, location `/cloudbuild.yaml`
   - Service account: the compute SA above (if asked)
4. Save.

---

## 4. First run

Either push any commit to your branch, or hit **Run** on the trigger. Watch **Cloud Build → History**:
- Step `build`: `npm ci`, export from Firestore, `next build` → `out/`
- Step `deploy`: pushes `out/` to Firebase Hosting

When it goes green, `https://astspares.web.app` is live with the new build. First run is the slow one (~3–5 min); later ones are faster.

> Make sure you've already re-seeded Firestore (Stage 1) and deployed the updated `firestore.rules` — the build reads live Firestore, so it should contain the new category/product shape before the first deploy.

---

## How publishing works from now on

- **Code changes** (anything I deliver in future stages): get it onto GitHub → push → auto-builds and deploys.
- **Catalog changes** (you add a product/category in the admin): the data is in Firestore immediately, but the static site needs a rebuild — so **run the trigger** to publish. Console "Run", or `gcloud builds triggers run astspares-deploy --branch=main`.

The natural finish (a later step) is an admin **"Publish" button** that calls a tiny Cloud Function which runs the trigger for you — so you never leave the admin panel to push catalog changes live. Say the word and I'll wire that up.
