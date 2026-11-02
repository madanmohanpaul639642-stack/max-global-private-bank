#!/usr/bin/env bash
# =========================================================
# Max Global Private Bank System - Google Cloud Run Deployer
# =========================================================
set -e

REGION="asia-south1"
SERVICE_NAME="max-global-bank"

echo "========================================================="
echo "  Max Global Private Bank - Google Cloud Deployment  "
echo "========================================================="

if ! command -v gcloud &> /dev/null; then
    echo "Error: 'gcloud' CLI is not found on your system PATH."
    echo "Install Google Cloud SDK from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
    echo "No Project ID provided. Aborting."
    exit 1
fi

echo "Target Project: $PROJECT_ID"
echo "Target Region:  $REGION"
echo "Target Service: $SERVICE_NAME"
echo ""

echo "[1/4] Setting active GCP project..."
gcloud config set project "$PROJECT_ID"

echo "[2/4] Enabling required GCP APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com

echo "[3/4] Building container and deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production,DB_TYPE=auto

echo "[4/4] Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')

echo ""
echo "========================================================="
echo "  DEPLOYMENT SUCCESSFUL! 🚀"
echo "  Your Bank Management System is live at:"
echo "  $SERVICE_URL"
echo "========================================================="
