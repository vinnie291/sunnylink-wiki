---
description: Deploy the application to Google Cloud Run (sunnylink.wiki)
---

This workflow deploys the sunnylink-wiki application to the correct production service mapped to `sunnylink.wiki`.

1. **Check Git Status**
   Ensure all changes are committed.
   ```bash
   git status
   ```

2. **Push to GitHub**
   Push changes to the remote repository.
   ```bash
   git push
   ```

3. **Submit Cloud Build**
   Build the container image using Google Cloud Build.
   // turbo
   ```bash
   gcloud builds submit --tag gcr.io/sunnylink-wiki/sunnylink-wiki --project sunnylink-wiki
   ```

4. **Deploy to Cloud Run (Production Service)**
   Deploy the built image to the `sunnylink-wiki-service` (IMPORTANT: This is the one mapped to sunnylink.wiki).
   // turbo
   ```bash
   gcloud run deploy sunnylink-wiki-service --image gcr.io/sunnylink-wiki/sunnylink-wiki --platform managed --region us-central1 --allow-unauthenticated --project sunnylink-wiki
   ```
