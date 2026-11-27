# Sunnylink Wiki - Developer Instructions (CLAUDE.md)

This file contains the guidelines for maintaining, testing, and deploying the **Sunnylink Wiki** application (`sunnylink.wiki`), including integrations with GitHub and Google Cloud Platform (GCP).

## 🛠️ Tech Stack & Architecture
- **Framework**: Next.js 16 (App Router, `output: "standalone"`), React 19
- **Languages**: TypeScript 5, JavaScript (Node.js 22+)
- **Styling & UI**: Tailwind CSS v4, Framer Motion, Lucide React
- **3D & Telemetry**: Three.js (`/new-sim`), Cap'n Proto (`capnp-es`) + `fzstd` (`/model-replay`), Recharts (`/stats`)
- **Search**: Fuse.js local search + TypeSafe Jev semantic ranking (`/api/search`, `docs/semantic-search.md`)
- **Data Store**: Structured JSON datasets in `data/` (toggles, models, features, cars, fleet stats, Discourse polls, model votes)
- **Localization**: 6-locale i18n (`en`, `zh`, `es`, `fr`, `de`, `ko`) across `locales/` and localized `data/*.<locale>.json` files

---

## 💻 Core Development Commands
Use these standard commands for common development operations:
- **Start Local Server**: `npm run dev` (Access at [http://localhost:3000](http://localhost:3000))
- **Production Build**: `npm run build`
- **Run Linter**: `npm run lint`
- **Run Unit Tests**: `npm test`
- **Check Localization Parity**: `npm run i18n:check`
- **Run Autonomous Data Sync**: `npm run autonomy:sync`

---

## 🌐 GitHub Integration
The project's remote repository is `https://github.com/vinnie291/sunnylink-wiki.git`.
To perform GitHub-related tasks (such as pulling, committing, or opening Pull Requests):
1. Ensure the GitHub CLI (`gh`) is installed and authenticated: `gh auth login`
2. Use standard git commands or GitHub CLI tools.
3. For opening PRs, use: `gh pr create --title "<title>" --body "<body>"`

---

## ☁️ Google Cloud Platform (GCP) & Deployment Setup
The project is deployed as a standalone Next.js Docker container on **Google Cloud Run** via **Google Cloud Build**.

### Canonical Cloud Project Configuration
All deployment scripts (`scripts/deploy.py`), Cloud Build configs (`cloudbuild.yaml`), and docs (`DEPLOYMENT.md`) target:
- **GCP Project ID**: `sunnylink-wiki`
- **Cloud Run Service**: `sunnylink-wiki-service` (`us-central1`, port `3000`, `512Mi` memory, `1` CPU, `0–3` instances)
- **Container Image**: `gcr.io/sunnylink-wiki/wiki-app`

### Prerequisites for Cloud Operations
To build and deploy locally:
1. `gcloud` (Google Cloud SDK) installed and in `PATH`.
2. Authentication configured: `gcloud auth login` and `gcloud auth application-default login`
3. Target project set: `gcloud config set project sunnylink-wiki`

---

## 🤖 Core Workflows
Predefined workflows are located in `.agent/workflows/` and `.github/workflows/`:

### 1. Local Testing & Verification (`.agent/workflows/local.md`)
1. Ensure dependencies are current: `npm ci --ignore-scripts` (or `npm install`)
2. Run development server: `npm run dev`
3. Verify via local browser at [http://localhost:3000](http://localhost:3000).

### 2. Code Quality Checks (`.agent/workflows/quality_check.md`)
Always run before deploying:
1. Run unit tests & i18n check: `npm test && npm run i18n:check`
2. Run linter: `npm run lint`
3. Run production build / typecheck: `npm run build`

### 3. Production Deployment (`scripts/deploy.py` & `cloudbuild.yaml`)
Production auto-deploys every 6 hours when upstream data changes via `.github/workflows/autonomous-master.yml` (`python3 scripts/deploy.py`).

To deploy manually to `sunnylink.wiki`:
1. Ensure all changes are committed and pushed:
   ```bash
   git status
   git push
   ```
2. **Option A — Scripted Cloud Build & Deploy (Recommended)**:
   ```bash
   python3 scripts/deploy.py
   ```
3. **Option B — Manual `gcloud` Build & Deploy**:
   ```bash
   gcloud builds submit --tag gcr.io/sunnylink-wiki/wiki-app:latest --project sunnylink-wiki .

   gcloud run deploy sunnylink-wiki-service \
     --image gcr.io/sunnylink-wiki/wiki-app:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 3000 \
     --memory 512Mi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 3 \
     --project sunnylink-wiki
   ```

---

## 🎨 Design & Code Guidelines
- **Modern & Premium Design**: Use clean visual hierarchy, subtle backdrop filters, responsive mobile-first layouts, and smooth micro-animations with Framer Motion.
- **Maintain Translation Integrity**: When adding UI strings or modifying datasets, ensure all 6 locales (`en`, `zh`, `es`, `fr`, `de`, `ko`) remain synchronized in `locales/` and `data/`, verified with `npm run i18n:check`.
- **Components**: Create modular, accessible React 19 components under `components/` using Tailwind CSS v4 styling rules.
