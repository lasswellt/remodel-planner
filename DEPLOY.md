# Deploy runbook — Remodel Planner (prod)

The application code is complete and verified against the **dev** project
(`remodel-planner-dev`). Production deploy is **blocked on owner GCP actions**:
`remodel-planner-prod` currently has **no billing**, no Firestore/Storage, and
no prod web app. This runbook lists the exact prerequisites (owner) and the
deploy/verify commands (repeatable) so a prod release is a checklist, not a
guess.

> ⚠️ **`.env.production` currently holds DEV config** (`remodel-planner-dev`,
> project number `532413125263`) as a placeholder. It **must** be replaced with
> the real prod web-app config (step P5) before any `NODE_ENV=production`
> build — otherwise a "prod" build talks to the dev project.

## Prerequisites — owner GCP actions (one-time, required first)

These need billing/console access and cannot be scripted from this repo.

| # | Action | Command / where |
|---|---|---|
| P1 | **Link billing** to prod. The per-account project-billing quota previously blocked this (only dev is billed) — request an increase or free a slot. | `gcloud billing projects link remodel-planner-prod --billing-account=<ACCOUNT_ID>` · quota: https://support.google.com/code/contact/billing_quota_increase |
| P2 | **Enable APIs** on prod. | `gcloud services enable firestore.googleapis.com firebasestorage.googleapis.com firebasehosting.googleapis.com identitytoolkit.googleapis.com recaptchaenterprise.googleapis.com --project remodel-planner-prod` |
| P3 | **Create Firestore** (native, `us-east1`). | `gcloud firestore databases create --location=us-east1 --project remodel-planner-prod` |
| P4 | **Create the default Storage bucket** (`us-east1`). | Firebase console → Storage → Get started, or `gsutil mb -l us-east1 gs://remodel-planner-prod.firebasestorage.app` |
| P5 | **Create the prod web app**, then write its real config into `.env.production` (replace the dev placeholder). | `firebase apps:create web "Remodel Planner" --project prod` → `firebase apps:sdkconfig web <APP_ID> --project prod` → copy apiKey/authDomain/projectId/storageBucket/messagingSenderId/appId into `.env.production` |
| P6 | **Enable Google sign-in** in the prod Auth console (auto-creates the OAuth client); add the Hosting domain to authorized domains. | Firebase console → Authentication → Sign-in method → Google |
| P7 | **Create a reCAPTCHA Enterprise key** for prod and register **App Check**; put the site key in `.env.production` (`NUXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY`). Do **not** enforce yet. | Firebase console → App Check |

## Deploy (repeatable)

```bash
# 1. Build the static SPA with REAL prod config (.env.production from P5/P7)
NODE_ENV=production pnpm generate            # → .output/public

# 2. Deploy hosting + rules + indexes + storage to prod (explicit --project)
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage --project prod

# 3. Backups: GCS bucket + weekly scheduled Firestore export (Cloud Scheduler)
scripts/setup-backups.sh remodel-planner-prod us-east1
#    → verify the first export manually:
#    gcloud firestore export gs://remodel-planner-prod-firestore-backups/manual-$(date +%F) --project remodel-planner-prod
```

## Post-deploy verification

1. Load the Hosting URL; **sign in with the real Google account**; create a
   throwaway project + upload one photo; confirm both land in prod
   Firestore/Storage; delete them.
2. **Unauthenticated read is blocked** (expect HTTP 403):
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     "https://firestore.googleapis.com/v1/projects/remodel-planner-prod/databases/(default)/documents/users/anyuid/projects"
   ```
3. **Enable App Check enforcement** on prod Firestore + Storage (console), then
   confirm a tokenless REST request is rejected and the deployed app still works.
4. Record the **Hosting URL**, **backup bucket**, and **deploy timestamp** in
   `.remodel/registry.json` (`firebase.hostingSite` + the `deploy` phase) and
   mark the phase complete.

## Rollback

Hosting keeps prior releases — `firebase hosting:rollback --project prod`.
Rules/indexes are versioned in-repo; redeploy a previous commit's
`firestore.rules` / `firestore.indexes.json` to revert.
