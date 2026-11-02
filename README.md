# Max Global Private Bank — Core Enterprise Banking Platform

A high-performance, enterprise-grade banking web platform built with Node.js, Express, high-concurrency SQL engines, Google Cloud Run integration, and Google Cloud Gemini AI assistance. Regulated under Reserve Bank of India (RBI) Scheduled Commercial Bank standards with full DICGC deposit insurance compliance.

---

## Architecture Overview

Max Global Private Bank delivers three strictly segregated, purpose-built portals alongside public high-net-worth banking showcases:

1. **Public Showcase & RBI Compliance Portal**:
   - Comprehensive web pages: Personal Banking, Wealth & Deposits, Loans & Mortgages, Cards, Offers & Privileges, and Security & RBI Compliance.
   - Interactive Live Term Deposit Calculator & Instant Loan EMI Sanction Simulator.
   - Dynamic real-time interest rates and active promotional campaigns managed directly from the database.

2. **Customer Private Wealth NetBanking**:
   - Liquid asset overview with pre-approved credit lines and instant sanctioning.
   - High-yield Term Fixed Deposits (7.85% p.a.) with automated certificate generation.
   - Contactless Visa Infinite / Platinum Debit Card with 1-click cyber freeze/unfreeze controls.
   - 24/7 Instant Atomic Ledger Fund Transfers with real-time balance reconciliation.
   - Integrated **Aura Wealth AI Concierge** powered by Google Cloud Gemini.

3. **Employee Branch Operations (Nexus Ops)**:
   - Simplified operational interface for Tellers and Branch Officers.
   - Fast customer KYC search, lookup, and onboarding.
   - Teller cash counter for instant deposits and cash withdrawals with atomic double-entry validation.
   - Branch daily transaction ledger and operational copilot powered by **Nexus Ops AI**.

4. **Chief Administrator Executive Command Terminal (Sentinel Core)**:
   - Futuristic cyber HUD terminal with root administrative authority ("Sabhi Ka Baap").
   - Live Rates, Web Content & Promotional Offers Manager with instant updates across the public banking site.
   - Staff Governance Console: Grant or revoke Branch Officer and Teller credentials in real-time.
   - Account Master Override: Freeze/unfreeze any account, adjust emergency liquidity reserves with audit logging.
   - Real-time institutional telemetry and **Sentinel Core AI** executive risk officer.

---

## Technical Specifications

- **Runtime**: Node.js v20+ / v24+
- **Backend**: Express.js with Helmet security headers, CSRF protection, and cryptographically signed session cookies (`mgpb.sid`).
- **Dual-Engine Database Layer**:
  - Primary Enterprise: MySQL 8+ / Google Cloud SQL.
  - Zero-Configuration Embedded: High-speed native `node:sqlite` fallback (`data/max_global_bank.sqlite`).
- **Artificial Intelligence**: Google Cloud Vertex AI / Gemini 2.5 Flash API with intelligent autonomous fallback.
- **Cloud Infrastructure**: Google Cloud Run serverless deployment, Cloud Build CI/CD pipelines, Docker containerized.

---

## Quick Start (Local Run)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   # Copy sample environment configuration
   cp .env.example .env
   ```
   *(Optional: Add your Google Cloud Gemini API Key to `GEMINI_API_KEY` in `.env` for live Google Cloud LLM responses).*

3. **Start the Banking Server**:
   ```bash
   npm start
   ```

4. **Access the Portal**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## Credentials

- **Customer NetBanking**: `aarav` / `Customer123!`
- **Branch Teller / Officer**: `teller` / `Teller123!`
- **Chief Administrator**: `admin` / `Admin123!`

---

## Google Cloud Deployment

Deploy directly to Google Cloud Run with single-command deployment:
```powershell
./deploy-gcp.ps1 -ProjectId your-google-cloud-project-id
```
Or with Google Cloud Build:
```bash
gcloud builds submit --config cloudbuild.yaml
```

---

## Regulatory & Compliance

Max Global Private Bank operates under Reserve Bank of India License `RBI/2026/MGPB-8842` as a Scheduled Commercial Bank. All customer deposits are protected under the Deposit Insurance and Credit Guarantee Corporation (DICGC) up to ₹5,00,000 per depositor.
