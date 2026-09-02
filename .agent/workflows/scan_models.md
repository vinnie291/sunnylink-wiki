---
description: Automatically scan GitHub for new driving models, research Discourse and Discord sentiment, and sync models.json
---

# Scan and Research New Models

Run this workflow periodically to discover newly released driving models from the sunnypilot ecosystem, pull community sentiment and polls, and prepare them for the wiki database.

1. **Scan for New Models on GitHub**
   Run the scanner in check mode to detect new models vs local database:
   ```bash
   npm run scan:models -- --check
   ```

2. **Research Detected Models**
   Run automated research across Discourse forums and Discord:
   ```bash
   npm run scan:models -- --research
   ```
   Or research a specific model:
   ```bash
   npm run scan:models -- --research "<Model Name>"
   ```

3. **Check Live Discord Discussions (If Needed)**
   If you have Discord open in Chrome, inspect `#driving-model-discussion` for the latest unexported feedback.

4. **Apply Updates to Database**
   Automatically add researched models to `data/models.json` and sync localized versions:
   ```bash
   npm run scan:models -- --apply
   ```

5. **Verify Catalog Integrity**
   Verify skill ratings and audit data:
   ```bash
   npm run ratings:audit
   ```
