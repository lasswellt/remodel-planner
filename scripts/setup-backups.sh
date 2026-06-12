#!/usr/bin/env bash
#
# Weekly scheduled Firestore export for the PROD project.
#
# Creates a GCS bucket and a Cloud Scheduler job that runs `gcloud firestore
# export` every week. Run once during the deploy phase, against prod only.
# Documented in README. There are no Cloud Functions in this app; this is the
# real backup path (JSON export/import in the app is the portability path).
#
# Usage:  scripts/setup-backups.sh <PROD_PROJECT_ID> [REGION]
set -euo pipefail

PROJECT="${1:?prod project id required, e.g. remodel-planner-prod}"
REGION="${2:-us-east1}"
BUCKET="gs://${PROJECT}-firestore-backups"
SA="firestore-backup@${PROJECT}.iam.gserviceaccount.com"
JOB="firestore-weekly-export"

# Hard refuse to run against anything that is not clearly the prod project.
case "$PROJECT" in
  *prod*) : ;;
  *) echo "Refusing: '$PROJECT' does not look like a prod project id." >&2; exit 2 ;;
esac

echo "==> enabling required APIs on ${PROJECT}"
gcloud services enable firestore.googleapis.com cloudscheduler.googleapis.com \
  storage.googleapis.com --project "$PROJECT"

echo "==> creating backup bucket ${BUCKET} (if absent)"
gcloud storage buckets create "$BUCKET" --location="$REGION" --project "$PROJECT" \
  --uniform-bucket-level-access 2>/dev/null || echo "    bucket exists, skipping"

echo "==> creating backup service account (if absent)"
gcloud iam service-accounts create firestore-backup \
  --display-name="Firestore weekly backup" --project "$PROJECT" 2>/dev/null \
  || echo "    service account exists, skipping"

echo "==> granting export + bucket-write roles"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA}" --role="roles/datastore.importExportAdmin" --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "$BUCKET" \
  --member="serviceAccount:${SA}" --role="roles/storage.objectAdmin" >/dev/null

echo "==> creating weekly Cloud Scheduler export job (Sundays 03:00)"
EXPORT_URI="https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default):exportDocuments"
gcloud scheduler jobs create http "$JOB" \
  --project "$PROJECT" \
  --location "$REGION" \
  --schedule="0 3 * * 0" \
  --time-zone="America/New_York" \
  --uri="$EXPORT_URI" \
  --http-method=POST \
  --oauth-service-account-email="$SA" \
  --message-body="{\"outputUriPrefix\":\"${BUCKET}\"}" 2>/dev/null \
  || gcloud scheduler jobs update http "$JOB" \
       --project "$PROJECT" --location "$REGION" \
       --schedule="0 3 * * 0" --time-zone="America/New_York" \
       --uri="$EXPORT_URI" --http-method=POST \
       --oauth-service-account-email="$SA" \
       --message-body="{\"outputUriPrefix\":\"${BUCKET}\"}"

echo "==> done. Verify the first run manually:"
echo "    gcloud scheduler jobs run ${JOB} --project ${PROJECT} --location ${REGION}"
echo "    gcloud storage ls ${BUCKET}"
