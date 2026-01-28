$ErrorActionPreference = "Stop"

Write-Host "Checking for Google Cloud SDK..." -ForegroundColor Cyan
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "gcloud is not installed or not in your PATH."
    Write-Host "Please install the Google Cloud SDK:" -ForegroundColor Yellow
    Write-Host "1. Download: https://cloud.google.com/sdk/docs/install#windows"
    Write-Host "2. Run the installer"
    Write-Host "3. Restart your terminal/computer"
    exit 1
}

Write-Host "Building container (this may take a few minutes)..." -ForegroundColor Cyan
# Submit build to Cloud Build
gcloud builds submit --tag gcr.io/sunnylink-wiki/wiki-app:latest .

Write-Host "Deploying to Cloud Run..." -ForegroundColor Cyan
# Deploy to Cloud Run
gcloud run deploy sunnylink-wiki-service `
    --image gcr.io/sunnylink-wiki/wiki-app:latest `
    --platform managed `
    --region us-central1 `
    --allow-unauthenticated `
    --port 3000

Write-Host "Deployment Successful!" -ForegroundColor Green
