# Deploying to Google Cloud Run

This guide covers automated and manual deployment of **Sunnylink Wiki** (`sunnylink.wiki`) to Google Cloud Run.

## Canonical Production Configuration

All deployment paths (`scripts/deploy.py`, `cloudbuild.yaml`, and `.github/workflows/autonomous-master.yml`) share a single canonical configuration:

| Setting | Value |
| :--- | :--- |
| **GCP Project ID** | `sunnylink-wiki` |
| **Cloud Run Service** | `sunnylink-wiki-service` |
| **Container Image** | `gcr.io/sunnylink-wiki/wiki-app` |
| **Region** | `us-central1` |
| **Container Port** | `3000` |
| **Resources & Scaling** | `512Mi` memory, `1` vCPU, `--min-instances 0`, `--max-instances 3` |

---

## Option 1: Automated CI/CD (GitHub Actions)

In production, `.github/workflows/autonomous-master.yml` runs on a 6-hour schedule (and via manual **Workflow Dispatch** in GitHub Actions with `force_deploy: true`):
1. Runs `scripts/autonomous_sync.mjs` to sync upstream models, toggles, supported cars, Discourse polls, and sentiment.
2. Runs `npm test` and `node scripts/check-i18n.mjs --data-only`.
3. Invokes `python3 scripts/deploy.py` using the `GCP_SA_KEY` repository secret to package source, build `gcr.io/sunnylink-wiki/wiki-app`, and deploy `sunnylink-wiki-service`.

---

## Option 2: Scripted Local Deploy (`scripts/deploy.py`)

If you have Python 3 (`pip install requests google-auth`) and Application Default Credentials configured:

```bash
gcloud auth application-default login
python3 scripts/deploy.py
```

`scripts/deploy.py` packages a slim source tarball (excluding `node_modules`, `.next`, `tests`, `docs/weekly-audits`, `data/discord_feedback`, logs, and backups), uploads it to `gs://sunnylink-wiki_cloudbuild`, triggers Cloud Build, and deploys `sunnylink-wiki-service`.

---

## Option 3: Manual `gcloud` CLI Deployment

### Prerequisites
Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) so `gcloud` is available in your shell.

### 1. Authenticate & Set Project
```bash
gcloud auth login
gcloud config set project sunnylink-wiki
```

### 2. Enable Required Services (First-Time Setup)
```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

### 3. Build & Deploy via `cloudbuild.yaml` (Single Command)
```bash
gcloud builds submit --config cloudbuild.yaml --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD) .
```

### 4. Or Build & Deploy Step-by-Step
```bash
# Build and push image in Cloud Build
gcloud builds submit --tag gcr.io/sunnylink-wiki/wiki-app:latest .

# Deploy to the canonical Cloud Run service
gcloud run deploy sunnylink-wiki-service \
  --image gcr.io/sunnylink-wiki/wiki-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3
```

Once finished, `gcloud` prints the live Cloud Run service URL (`https://sunnylink-wiki-service-xyz.a.run.app`, mapped to `https://sunnylink.wiki`).

---

## Cloud Storage (GCS) Note
Per Google Cloud's CLI deprecation timeline (March 2027), always use `gcloud storage` instead of `gsutil`:
- List buckets/objects: `gcloud storage ls gs://sunnylink-wiki_cloudbuild`
- Upload file: `gcloud storage cp <local-file> gs://<bucket>/`
- Download file: `gcloud storage cp gs://<bucket>/<file> .`
- Sync directories: `gcloud storage rsync -r <local-dir> gs://<bucket>/<dir>`
