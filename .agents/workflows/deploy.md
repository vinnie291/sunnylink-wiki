---
description: Deploy the application to Google Cloud Run and merge to main
---

This workflow automates the process of pushing current changes to the main branch and deploying the dockerized Next.js application to Google Cloud Run.

// turbo-all

1. Ensure all your working files are committed.
```bash
git add .
git commit -m "chore: prepare for deployment" || true
```

2. Checkout the `main` branch and pull the latest changes.
```bash
git checkout main
git pull origin main
```

3. Merge your working branch (assuming you were on a feature branch prior). If you were already on main, this will just do nothing.
```bash
git merge -
```

4. Push the `main` branch to GitHub.
```bash
git push origin main
```

5. Authenticate with Google Cloud (Make sure you have GCP CLI installed and configured).
```bash
gcloud auth configure-docker gcr.io
```

6. Build the Docker image for the linux/amd64 architecture (required for Cloud Run) and push it to Google Container Registry.
```bash
docker buildx build --platform linux/amd64 -t gcr.io/sunnylink-wiki/wiki-app:latest --push .
```

7. Deploy the new image to Google Cloud Run.
```bash
gcloud run deploy sunnylink-wiki-service \
  --image gcr.io/sunnylink-wiki/wiki-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

8. Switch back to your previous working branch.
```bash
git checkout -
```

9. Confirm the deployment is live at https://sunnylink.wiki
