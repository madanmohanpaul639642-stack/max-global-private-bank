# 🌐 Google Cloud Integration & Deployment Guide

This guide details how to connect the **Max Global Private Bank Management System** to **Google Cloud Platform (GCP)**, configure **Google Cloud Gemini AI**, and deploy serverless on **Google Cloud Run**.

---

## 🌟 1. Google Cloud Gemini AI Integration

The system comes with built-in Google Cloud Gemini AI models (`gemini-2.5-flash` and `gemini-1.5-flash`) providing specialized copilot capabilities for all three user personas:

- **Admin Copilot ("Sentinel Core")**: Security anomaly analysis, audit monitoring, user access reviews, risk telemetry.
- **Bank Employee Copilot ("Nexus Ops")**: Customer onboarding KYC checklist, cash transaction thresholds, AML suspicious reporting rules.
- **Customer AI Banker ("Aura")**: Real-time balance insights, smart savings advice, simulated loan EMI calculator, transfer guidance.

### Quick Setup:
1. Obtain a Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey) or Google Cloud Vertex AI.
2. Open your `.env` file and add:
   ```env
   GEMINI_API_KEY=your_google_cloud_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   GOOGLE_CLOUD_PROJECT_ID=max-global-bank-cloud
   ```
3. Restart the server (`npm start`). The AI Assistant will instantly connect directly to Google Cloud Gemini!
*(Note: If no key is provided, the application runs on its built-in Local Hybrid AI Engine with full banking intelligence).*

---

## 🚀 2. Deploying to Google Cloud Run (Serverless)

Google Cloud Run allows you to host this containerized full-stack application globally with automatic scaling (including scaling to 0 when idle to save costs).

### Prerequisites:
1. Install [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install).
2. Authenticate:
   ```bash
   gcloud auth login
   ```
3. Set your project:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

### Method A: One-Click Automated Script
- **Windows (PowerShell)**:
  ```powershell
  .\deploy-gcp.ps1
  ```
- **macOS / Linux**:
  ```bash
  chmod +x deploy-gcp.sh
  ./deploy-gcp.sh
  ```

### Method B: Manual gcloud CLI Deployment
Run directly from this repository root:
```bash
gcloud run deploy max-global-bank \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,DB_TYPE=auto
```

Google Cloud will automatically build your Docker container using Google Cloud Build, push it to Google Artifact Registry, and provide you with a live HTTPS production URL (e.g. `https://max-global-bank-xyz.a.run.app`).

---

## 🗄️ 3. Connecting Google Cloud SQL (MySQL 8.4)

You can link this app to a managed **Google Cloud SQL for MySQL** instance.

1. **Create Cloud SQL Instance**:
   ```bash
   gcloud sql instances create max-global-db \
     --database-version=MYSQL_8_0 \
     --tier=db-f1-micro \
     --region=asia-south1
   ```
2. **Create Database & User**:
   ```bash
   gcloud sql databases create max_global_bank --instance=max-global-db
   gcloud sql users set-password root --instance=max-global-db --prompt-for-password
   ```
3. **Get Connection Name**:
   ```bash
   gcloud sql instances describe max-global-db --format='value(connectionName)'
   # Format: PROJECT_ID:REGION:INSTANCE_NAME
   ```
4. **Update `.env`**:
   ```env
   DB_TYPE=mysql
   CLOUD_SQL_CONNECTION_NAME=your-project:asia-south1:max-global-db
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=max_global_bank
   ```
5. **Connect Cloud Run to Cloud SQL**:
   ```bash
   gcloud run services update max-global-bank \
     --add-cloudsql-instances YOUR_PROJECT:asia-south1:max-global-db \
     --region asia-south1
   ```

---

## 🛡️ Fail-Safe Database Engine (SQLite Fallback)
If Cloud SQL or local MySQL is offline or undergoing maintenance, the application automatically engages its **Embedded SQLite Engine** (`data/max_global_bank.sqlite`). Your banking application **will never crash due to database outages**, guaranteeing 100% uptime!
