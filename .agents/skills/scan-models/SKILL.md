---
name: scan-models
description: Scans GitHub repositories (sunnypilot/sunnypilot-models, commaai/openpilot) for new driving models, researches community discussions and polls on Discourse (community.sunnypilot.ai), pulls Discord sentiment and user comments, and updates data/models.json.
---

# Driving Model Scanner & Community Researcher

This skill automates discovering newly released openpilot/sunnypilot driving models, pulling official release details from GitHub manifests, researching community sentiments and polls from Discourse (`community.sunnypilot.ai`), and extracting user feedback from Discord.

## When to Use This Skill

Activate this skill whenever the user asks to:
- "Scan for new models on GitHub"
- "Check if any new driving models have dropped"
- "Research community comments / sentiment for new models"
- "Pull latest models and prepare them for the website"
- "Sync models from Discord / Discourse"

---

## Architecture & Data Sources

| Source | Target / Endpoint | Data Extracted |
| :--- | :--- | :--- |
| **GitHub Manifests** | `sunnypilot/sunnypilot-models:gh-pages`<br>`docs/driving_models_chestnut_v23.json`<br>`docs/driving_models_v22.json` | Model display names, release dates, short names, bundle index, generation, eGPU/Qualcomm targets, commit history. |
| **Discourse Forum** | `community.sunnypilot.ai`<br>Endpoints: `/search.json`, `/c/9.json`, `/tag/model-drop.json`, `/t/<id>.json` | Official announcement OP, author, vehicle testing compatibility, poll score (5-star / 10-point scale), voter count, lateral & longitudinal poll breakdowns, positive/negative quotes. |
| **Discord Feedback** | Local dumps in `data/discord_feedback/*.json`<br>Live browser: `chrome-devtools-mcp` | Real user sentiment (`great`, `good`, `ok`, `bad`), message volume, community score, unfiltered driving feedback, vehicle-specific quirks. |
| **Local Wiki Database** | `data/models.json` & localized `data/models.<locale>.json` | The versioned catalog of driving models rendered in `app/models/page.tsx` and `components/ModelLibrary.tsx`. |

---

## Workflow: Step-by-Step

### Step 1: Run GitHub Scanner Check

Run the automated scanner in check mode to compare remote GitHub manifests against the current local catalog:

```bash
npm run scan:models -- --check
```

This will report:
- Total remote models in Chestnut and Qualcomm manifests
- Total matching local models
- Any uncatalogued or newly dropped models

> [!TIP]
> You can also check the latest commit history on GitHub directly:
> ```bash
> gh api "repos/sunnypilot/sunnypilot-models/commits?sha=gh-pages&per_page=5" --jq '.[] | "\(.commit.committer.date) \(.commit.message | split("\n")[0])"'
> ```

---

### Step 2: Automated Research on Models

To run the automated research engine on all new models (or a specific model):

```bash
# Research all newly detected models
npm run scan:models -- --research

# Or research a specific model
npm run scan:models -- --research "BMRLNAP Model v6"
```

The script automatically:
1. Queries the Discourse search and Category 9 (Model drops) APIs.
2. Extracts OP notes, release announcements, and author comments.
3. Parses structured polls:
   - `overall` poll -> computes 0-100 score and `{ great, good, ok, bad }` sentiment breakdown.
   - `lateral` and `longitudinal` polls -> extracts top positive strengths and negative quirks.
   - `steering` poll -> extracts dominant steering control profile.
4. Searches local Discord feedback archives in `data/discord_feedback/` for keyword sentiment and community quotes.

---

### Step 3: Live Discord Inspection (If Needed)

If a new model was released recently and is not yet included in the local `data/discord_feedback/` JSON dumps:
1. Use `call_mcp_tool` with `chrome-devtools-mcp` to inspect open Chrome tabs:
   - Check if `https://discord.com` is open (`list_pages`).
   - Navigate to or select the sunnypilot server or comma.ai community server.
   - Locate the `#driving-model-discussion` channel or active model thread.
2. Extract the latest user messages:
   ```javascript
   (() => {
     const messages = Array.from(document.querySelectorAll('[id^="chat-messages-"]'));
     return messages.slice(-15).map(m => ({
       author: m.querySelector('[class*="username_"]')?.innerText,
       text: m.querySelector('[id^="message-content-"]')?.innerText
     }));
   })()
   ```
3. Synthesize the driver feedback for:
   - Lateral stability / curve behavior / oscillations
   - Longitudinal acceleration / stop line behavior
   - Specific vehicle make/model reports (e.g. Honda, Hyundai, Toyota)

---

### Step 4: Synthesize & Format Model Profile

Every model entry in `data/models.json` conforms to the following schema:

```json
{
  "name": "Model Name",
  "date": "Month DD, YYYY",
  "badge": "New Release",
  "tags": ["Chestnut eGPU", "Experimental"],
  "communityScore": 75,
  "totalVotes": 15,
  "sentiment": {
    "great": 45,
    "good": 35,
    "ok": 15,
    "bad": 5
  },
  "bestFor": "Target use case (e.g. Highway cruising, city traffic, mountain curves).",
  "steeringFeel": "Description of torque, centering authority, and road feel.",
  "positives": [
    "Positive feature 1",
    "Positive feature 2"
  ],
  "negatives": [
    "Quirk or issue 1",
    "Quirk or issue 2"
  ],
  "testedOn": [
    "Vehicle 1",
    "Vehicle 2"
  ],
  "forumUrl": "https://community.sunnypilot.ai/t/..."
}
```

#### Category Assignment Guidelines:
- **`chestnut_gpu`**: Any model bundled in `driving_models_chestnut_*.json` (BMRLNAP series, Sad Model, Tee Time, Lebowski).
- **`world_2026`**: Modern 2026 Qualcomm models (WMI V10-V12, Macrostiff, SC Model).
- **`opm`**: Off-Policy models (OP Model 10 series, OPM v1-v5).
- **`aggressive_exp`**: High-acceleration/close following (Dark Souls series, Firehose).
- **`comfort`**: Relaxed, passenger-friendly models (Down to Ride / DTR, Kumars Vibe, Space Lab).
- **`tomb_raider`**: Experimental TR/Trash Folder runs.

---

### Step 5: Applying to Database & Syncing Translations

To apply researched models automatically:

```bash
npm run scan:models -- --apply
```

This will:
1. Append the new models to the appropriate category in `data/models.json`.
2. Update `totalModels` and `lastUpdated` timestamp.
3. Automatically execute `node scripts/sync_models.mjs` to propagate the structural changes to all 5 localized files:
   - `data/models.de.json`
   - `data/models.es.json`
   - `data/models.fr.json`
   - `data/models.ko.json`
   - `data/models.zh.json`

---

### Step 6: Validation & Health Check

Always verify database integrity after updates:

1. **Audit Skill Ratings & Percentages**:
   ```bash
   npm run ratings:audit
   ```
   Ensures sentiment percentages sum to 100% and scores are within 0-100 range.

2. **Validate Next.js Build**:
   ```bash
   npm run build
   ```
   Ensures static routes, schema parsing, and model library views render without error.
