# =========================================================
# Max Global Private Bank System - Google Cloud Run Deployer
# =========================================================

param (
    [string]$ProjectId,
    [string]$Region = "asia-south1",
    [string]$ServiceName = "max-global-bank"
)

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  Max Global Private Bank - Google Cloud Deployment  " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# Check if gcloud is installed
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'gcloud' CLI is not found on your system PATH." -ForegroundColor Red
    Write-Host "Please install Google Cloud SDK from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Prompt for Project ID if not provided
if (-not $ProjectId) {
    $currentProj = gcloud config get-value project 2>$null
    if ($currentProj) {
        $confirm = Read-Host "Use active GCP Project '$currentProj'? (Y/n)"
        if ($confirm -eq '' -or $confirm -match '^[Yy]') {
            $ProjectId = $currentProj
        }
    }
    if (-not $ProjectId) {
        $ProjectId = Read-Host "Enter your Google Cloud Project ID"
    }
}

if (-not $ProjectId) {
    Write-Host "No Project ID provided. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "`nTarget Project: $ProjectId" -ForegroundColor Green
Write-Host "Target Region:  $Region" -ForegroundColor Green
Write-Host "Target Service: $ServiceName`n" -ForegroundColor Green

# Set project
Write-Host "[1/4] Setting active GCP project..." -ForegroundColor Cyan
gcloud config set project $ProjectId

# Enable required Google Cloud APIs
Write-Host "[2/4] Enabling required GCP APIs (Cloud Run, Cloud Build, Artifact Registry)..." -ForegroundColor Cyan
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com

# Build and deploy using Google Cloud Build & Cloud Run
Write-Host "[3/4] Building container and deploying to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars NODE_ENV=production,DB_TYPE=auto

Write-Host "`n[4/4] Fetching service URL..." -ForegroundColor Cyan
$ServiceUrl = gcloud run services describe $ServiceName --region $Region --format 'value(status.url)'

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT SUCCESSFUL! 🚀" -ForegroundColor Green
Write-Host "  Your Bank Management System is live at:" -ForegroundColor White
Write-Host "  $ServiceUrl" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Green
