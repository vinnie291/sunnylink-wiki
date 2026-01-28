# Deploying to Google Cloud Run

Based on your project settings, here is how to deploy this application.

## Prerequisites

Since `gcloud` is not installed on your system, you need to install the **Google Cloud SDK**:
1. [Download Google Cloud SDK Installer](https://cloud.google.com/sdk/docs/install#windows)
2. Run the installer and follow the instructions.
3. Make sure to check the box **"Start Google Cloud SDK Shell"** at the end, or open a new PowerShell window after installation.

## Deployment Steps

Run these commands in your project folder (`sunnylink-wiki`):

### 1. Login to Google Cloud
```powershell
gcloud auth login
```
*A browser window will open. Sign in with your Google account.*

### 2. Set Project ID
```powershell
gcloud config set project sunnylink-wiki
```

### 3. Enable Required Services
Enable Cloud Build and Cloud Run APIs:
```powershell
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

### 4. Build the Container (in the Cloud)
This uploads your source code to Google Cloud Build and creates a Docker container image.
```powershell
gcloud builds submit --tag gcr.io/sunnylink-wiki/wiki-app:latest .
```
*Note: This might take 2-3 minutes.*

### 5. Deploy to Cloud Run
This deploys the container to a live URL.
```powershell
gcloud run deploy sunnylink-wiki-service --image gcr.io/sunnylink-wiki/wiki-app:latest --platform managed --region us-central1 --allow-unauthenticated --port 3000
```

## Success!
Once the command finishes, it will print a **Service URL** (e.g., `https://sunnylink-wiki-service-xyz.a.run.app`).
Click that link to see your live app!
