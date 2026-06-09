# Sunnylink Wiki - Developer Instructions (CLAUDE.md)

This file contains the "constitution" and guidelines for **Claude Code** to successfully maintain, test, and deploy the Sunnylink Wiki application, including integrations with GitHub and Google Cloud Platform (GCP).

## 🛠️ Tech Stack & Architecture
- **Framework**: Next.js 16 (App Router), React 19
- **Languages**: TypeScript, JavaScript
- **Styling**: Tailwind CSS v4, Framer Motion
- **Database**: Drizzle ORM with Better SQLite3
- **Localization**: Multi-language support (English `en`, Chinese `zh`, etc.) in `locales/`

---

## 💻 Core Development Commands
Use these standard commands for common development operations:
- **Start Local Server**: `npm run dev` (Access at [http://localhost:3000](http://localhost:3000))
- **Production Build**: `npm run build`
- **Run Linter**: `npm run lint`
- **Drizzle DB Push**: `npm run db:push`
- **Database Seeding**: `npm run db:seed`

---

## 🌐 GitHub Integration
The project's remote repository is `https://github.com/vinnie291/sunnylink-wiki.git`.
To perform GitHub-related tasks (such as pulling, committing, or opening Pull Requests):
1. Ensure the GitHub CLI (`gh`) is installed and authenticated: `gh auth login`
2. Use standard git commands or Claude Code's git tools.
3. For opening PRs, use: `gh pr create --title "<title>" --body "<body>"`

---

## ☁️ Google Cloud Platform (GCP) & Deployment Setup
The project is deployed as a Docker container on **Google Cloud Run** inside the **Google Cloud Build** pipeline.

### Cloud Project Configuration
- **GCP Project ID**: `sunnylink-wiki`
- **GCP Service Name**: `sunnylink-wiki-service` (region: `us-central1`, port: `3000`)
- **Docker Image Tag**: `gcr.io/sunnylink-wiki/sunnylink-wiki`

### Prerequisites for Claude Code Cloud Operations
To build and deploy via Claude Code, the user's terminal environment must have:
1. `gcloud` (Google Cloud SDK) installed and in the PATH.
2. Authentication configured: `gcloud auth login`
3. Target project set: `gcloud config set project sunnylink-wiki`

---

## 🤖 Core Workflows
These are predefined workflows located in `@.agent/workflows/` that you can run or reference:

### 1. Local Testing & Verification (`.agent/workflows/local.md`)
1. Ensure dependencies are current: `npm install`
2. Run development server: `npm run dev`
3. Verify via local browser at [http://localhost:3000](http://localhost:3000).

### 2. Code Quality Checks (`.agent/workflows/quality_check.md`)
Always run before deploying:
1. Run linter: `npm run lint`
2. Run production build / typecheck: `npm run build`

### 3. Production Deployment (`.agent/workflows/deploy.md`)
To deploy changes live to `sunnylink.wiki`:
1. Ensure all changes are committed and pushed:
   ```bash
   git status
   git push
   ```
2. Trigger GCP Cloud Build:
   ```bash
   gcloud builds submit --tag gcr.io/sunnylink-wiki/sunnylink-wiki --project sunnylink-wiki
   ```
3. Deploy to Google Cloud Run:
   ```bash
   gcloud run deploy sunnylink-wiki-service --image gcr.io/sunnylink-wiki/sunnylink-wiki --platform managed --region us-central1 --allow-unauthenticated --project sunnylink-wiki
   ```

---

## 🎨 Design & Code Guidelines
- **Modern & Premium Design**: Use beautiful gradient overlays, soft backdrop filters (glassmorphism), customized layouts, and micro-animations with Framer Motion. Avoid basic/plain browser styles.
- **Maintain Translation Integrity**: When adding UI strings or modifying pages, ensure locales are updated in `locales/`. Follow `.agent/workflows/add_translation.md` and `.agent/workflows/update_data.md` for proper data modifications.
- **Components**: Create modular React components under `components/` using Tailwind CSS v4 styling rules.
