# ☀️ Sunnylink Wiki

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Live](https://img.shields.io/badge/Status-Live%20Production-emerald)](https://sunnylink.wiki)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Sim-black?logo=threedotjs)](https://threejs.org/)

**The "Missing Manual" for Sunnypilot.** A community-driven encyclopedia, interactive 3D driving simulator, telemetry replay analyzer, and configuration consultant decoding the settings, toggles, supported cars, and driving models of the [sunnypilot](https://github.com/sunnypilot/sunnypilot) ecosystem.

<img width="1448" height="1142" alt="Sunnylink Wiki Home" src="https://github.com/user-attachments/assets/c4dc3055-df88-4b39-8b28-56a512f5c067" />

### 🌐 Live App: [https://sunnylink.wiki](https://sunnylink.wiki)

---

## 🚀 Overview

Sunnypilot (an advanced community fork of openpilot) offers **100+ customizable toggles**, **130+ catalogued driving models**, and broad vehicle compatibility across dozens of makes. Understanding the interplay between *MADS*, *NNLC*, and *Dynamic Experimental Control*—or choosing between *WMI v12*, *Down to Ride v6*, and *Recertified Herbalist*—can be overwhelming for new and veteran drivers alike.

**Sunnylink Wiki** translates low-level parameters and scattered forum threads into an interactive, mobile-first reference optimized for both desktop exploration and in-car setup.

### ✨ Key Features

* **🎛️ Toggle Encyclopedia (`/`) & Deep-Dive Features (`/features`):** Searchable documentation for every sunnypilot setting with plain-English explanations, trade-offs, safety warnings, and toggle dependencies.
* **🧠 Driving Model Explorer (`/models`):** 130+ driving models organized by architecture and era, complete with "Vibe Check" tags, Discourse community poll tallies, Discord sentiment scores, live community voting, and multi-domain skill ratings (lateral centering, chill longitudinal, E2E longitudinal).
* **🛣️ 3D Driving Lab (`/new-sim`):** Interactive **Three.js** procedural multi-lane highway simulation modeling synthetic driver profiles derived from community telemetry and consensus traits in `data/models.json`.
* **📼 Openpilot `rlog` Replay (`/model-replay`):** Client-side Cap'n Proto (`capnp-es` + `fzstd`) log decoder and trajectory visualizer for inspecting real openpilot `rlog` / `.zst` route segments directly in the browser.
* **🚗 Supported Vehicles (`/cars`) & Setup Wizard (`/wizard`, `/quiz`):** Filterable vehicle harness & longitudinal support matrix paired with an interactive "My Car" handshake and step-by-step build-sheet consultant.
* **📊 Fleet Telemetry & Stats (`/stats`):** Interactive **Recharts** dashboards visualizing real-world driving model popularity, vehicle brand market share, and sunnypilot branch adoption.
* **🔍 Hybrid Jev Semantic Search (`Cmd/Ctrl+K`):** Instant client-side lexical matching (`Fuse.js`) augmented by server-side **TypeSafe Jev** semantic re-ranking (`/api/search`) so natural-language questions like *"steering stays on when I brake"* surface `MADS` immediately.
* **🌍 6-Locale Internationalization (`i18n`):** Complete UI and dataset translations across **English (`en`)**, **Chinese (`zh`)**, **Spanish (`es`)**, **French (`fr`)**, **German (`de`)**, and **Korean (`ko`)**.
* **🤖 Autonomous Sync & Auto-Deploy Pipeline:** Every 6 hours, GitHub Actions (`.github/workflows/autonomous-master.yml`) scans upstream sunnypilot repositories, Discourse polls, Discord feedback, and Clarity UX telemetry, validates i18n parity and tests, and auto-deploys to Google Cloud Run.
* **🔌 AI Agent & Markdown Discovery:** Ships with `/llms.txt`, RFC 8288 `Link` headers, `.well-known` MCP/agent skill manifests, and `/api/markdown` content negotiation.

---

## 🧠 Model Explorer & Community Consensus

<img width="1348" height="1003" alt="Sunnylink Model Explorer" src="https://github.com/user-attachments/assets/6a0af72a-3feb-42cb-a704-dadf7ac80600" />

Instead of a raw list of model weights, `/models` answers *"How does it actually feel to drive?"*:
* **Vibe Check Attributes:** Human-readable tags (*Smooth*, *Aggressive*, *On Rails*, *Wife Approved*) distilled from driver reports.
* **Blended Community Consensus:** Combines structured [Sunnypilot Discourse](https://community.sunnypilot.ai) model polls (`data/discourse_polls.json`), Discord thread sentiment (`scripts/analyze_discord_sentiment.ts`), and direct in-app survey votes (`data/model_votes.json`).
* **Smart Era Categorization:** Groups models across 2026 World Models, End-to-End experimental drops, and rock-solid highway classics.

---

## 🧙‍♂️ Interactive Setup Wizard

![Sunnylink Setup Wizard](https://github.com/user-attachments/assets/abbd31e8-ad72-4bbf-8fec-b49e3237f9b1)

Rather than generating raw device config blobs that risk corrupting hardware fingerprints, the **Setup Wizard (`/wizard`)** interviews the driver:
1. **Hardware & Vehicle Handshake:** Filters toggles based on Comma device (`Comma 3`, `Comma 3X`, `Comma 4`) and vehicle make/model.
2. **Driving Style Profiling:** Maps plain-English preferences (*Limo Driver*, *Commuter*, *Sporty*) to recommended models and longitudinal personalities.
3. **Interactive In-Car Build Sheet:** Produces a mobile-friendly checklist you can follow directly from the driver's seat.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Standalone Output), [React 19](https://react.dev/), TypeScript 5 |
| **Styling & Motion** | [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion 12](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) |
| **3D & Telemetry** | [Three.js](https://threejs.org/), [Recharts 3](https://recharts.org/), `capnp-es`, `fzstd` |
| **Search** | `fuse.js` + [TypeSafe Jev](https://docs.typesafe.ai) semantic scoring ([docs/semantic-search.md](docs/semantic-search.md)) |
| **Data & i18n** | Structured JSON datasets (`data/*.json`) + 6-locale dictionaries (`locales/*.json`) |
| **Infrastructure** | Docker (`node:22-alpine`), Google Cloud Build (`cloudbuild.yaml`), Google Cloud Run (`sunnylink-wiki-service`) |

---

## 🏁 Getting Started

### Prerequisites
* **Node.js 22+**
* **npm**

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vinnie291/sunnylink-wiki.git
   cd sunnylink-wiki
   ```

2. **Install dependencies:**
   ```bash
   npm ci --ignore-scripts
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Enable Jev semantic search (optional):**
   Add `TYPESAFE_API_KEY` to `.env.local` and restart `npm run dev`. Without a key, search gracefully uses local `Fuse.js` ranking. See [docs/semantic-search.md](docs/semantic-search.md) for details.

### Useful Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start local Next.js 16 dev server |
| `npm run build` | Build standalone production bundle |
| `npm test` | Run TypeScript unit & integration test suite (`tsx --test`) |
| `npm run lint` | Run ESLint 9 checks |
| `npm run i18n:check` | Verify translation key & dataset parity across all 6 locales |
| `npm run autonomy:sync` | Run master upstream sync pipeline (`scripts/autonomous_sync.mjs`) |

---

## 📂 Project Architecture

```text
sunnylink-wiki/
├── app/                  # Next.js 16 App Router pages & API routes
│   ├── cars/             # Supported vehicles matrix (/cars)
│   ├── features/         # Deep-dive Sunnypilot feature guides (/features)
│   ├── model-replay/     # Openpilot rlog Cap'n Proto trajectory viewer (/model-replay)
│   ├── models/           # Driving Model Explorer & community polls (/models)
│   ├── new-sim/          # Three.js 3D procedural driving simulator (/new-sim)
│   ├── quiz/ & wizard/   # Interactive configuration consultant (/wizard, /quiz)
│   ├── stats/            # Fleet usage & model telemetry charts (/stats)
│   └── api/              # Jev search, live model voting, wiki-data & markdown endpoints
├── components/           # Modular React 19 UI, simulator, & visualization components
├── data/                 # Canonical English & localized JSON datasets (models, toggles, cars, stats)
├── lib/                  # Search, skill ratings, rlog parser, i18n, & telemetry utilities
├── locales/              # UI translation dictionaries (en, zh, es, fr, de, ko)
├── scripts/              # Autonomous sync, i18n checks, sentiment analysis, & Cloud Run deploy.py
└── tests/                # Automated test suite
```

---

## ☁️ Deployment

Production runs on **Google Cloud Run** (`sunnylink-wiki-service` in `us-central1`, image `gcr.io/sunnylink-wiki/wiki-app`). See [DEPLOYMENT.md](DEPLOYMENT.md) for full details on automated GitHub Actions CI/CD, `python3 scripts/deploy.py`, and `cloudbuild.yaml`.

---

## 🤝 Contributing

Contributions are welcome—whether you're a developer improving the 3D simulator or a driver updating a model's consensus notes!

* **Update Model or Toggle Data:** Submit a Pull Request updating `data/models.json` or `data/toggles.json` and run `npm run i18n:check`.
* **Code & Bug Fixes:** Run `npm test` and `npm run lint` before opening a PR.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

* **Sunnyhaibin & the Sunnypilot Team:** For building and maintaining the sunnypilot ecosystem.
* **Comma.ai:** For pioneering openpilot.
* **The Sunnypilot Discourse & Discord Community:** For the thousands of miles of road testing, poll votes, and feedback that power our community consensus data.
