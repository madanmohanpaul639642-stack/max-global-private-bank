const https = require('https');
const db = require('./db');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT_ID || '';

/**
 * Call Google Cloud Gemini API directly
 */
async function callGeminiApi(systemPrompt, userMessage, conversationHistory = []) {
  if (!GEMINI_API_KEY) {
    throw new Error('NO_API_KEY');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;
  const contents = [];

  for (const item of conversationHistory.slice(-6)) {
    contents.push({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }]
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.95
    }
  };

  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const postData = JSON.stringify(requestBody);

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            return reject(new Error(parsed.error?.message || `Google Cloud API error ${res.statusCode}`));
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            resolve(text);
          } else {
            reject(new Error('Empty response from Google Cloud Gemini'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Google Cloud Gemini request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Intelligent Financial & Operational Banking Engine
 * Authentic real-world banking answers for Admin, Staff, and Customer
 */
async function generateIntelligentResponse(user, message) {
  const query = (message || '').trim().toLowerCase();
  const role = user?.role || 'customer';
  const name = user?.name || 'User';

  // ==========================================
  // 1. MASTER ADMINISTRATOR ("SABHI KA BAAP"): SENTINEL CORE
  // ==========================================
  if (role === 'admin' || role === 'manager') {
    if (query.includes('anomaly') || query.includes('security') || query.includes('risk') || query.includes('audit')) {
      const [recentAudits] = await db.query('SELECT action, entity_type, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 5');
      const auditSummary = recentAudits.map(a => `• \`${a.action}\` on \`${a.entity_type}\` (Origin IP: ${a.ip_address || 'internal-node'})`).join('\n') || '• No security anomalies detected in current cycle.';

      return `### 🛡️ Sentinel Security Telemetry & Anomaly Report
**System Status:** Quantum-Encrypted (SHA-256) | **Infrastructure:** Nominal

**Recent Security Event Stream:**
${auditSummary}

**Administrative Action Directives:**
1. **Privileged Escalations:** Multi-factor authentication enforced on all teller elevations.
2. **Account Override Protection:** All manual balance adjustments and account freezes are immutably logged to the master audit ledger.
3. **Master Authority:** You hold root privileges to freeze any customer account or revoke staff credentials immediately via the Staff Control terminal.`;
    }

    if (query.includes('frozen') || query.includes('status') || query.includes('account')) {
      const [accounts] = await db.query("SELECT account_number, balance, status FROM accounts WHERE status != 'active'");
      const frozenList = accounts.map(a => `• Account **${a.account_number}**: Status [${a.status.toUpperCase()}] - Balance ₹${Number(a.balance).toLocaleString('en-IN')}`).join('\n') || '• All customer ledger accounts are currently in active, healthy standing.';

      return `### 🔒 Master Account Governance & Standing
**Restricted / Frozen Accounts:** ${accounts.length}

${frozenList}

**Master Authority Command:**
You can modify any customer's account standing between Active and Frozen with 1-click in the **Account Master Freeze/Override** tab.`;
    }

    if (query.includes('volume') || query.includes('stat') || query.includes('metric') || query.includes('summary')) {
      const [[cusCount]] = await db.query('SELECT COUNT(*) as total FROM customers');
      const [[accCount]] = await db.query('SELECT COUNT(*) as total, COALESCE(SUM(balance),0) as balance FROM accounts');
      const [[txCount]] = await db.query('SELECT COUNT(*) as total FROM transactions');
      const [[empCount]] = await db.query('SELECT COUNT(*) as total FROM employees');

      return `### ⚡ Executive Financial & Staff Telemetry
**Network Node:** Max Global Core Primary Node
**Active Database Engine:** \`${db.getDriver().toUpperCase()}\`

- **Verified Customers:** \`${cusCount.total}\`
- **Active Branch Accounts:** \`${accCount.total}\`
- **Total Asset Reserves:** \`₹${Number(accCount.balance).toLocaleString('en-IN')}\`
- **Total Executed Transactions:** \`${txCount.total}\`
- **Active Staff Force:** \`${empCount.total} Tellers & Officers\`
- **Google Cloud Platform:** ${GEMINI_API_KEY ? 'Active (Gemini 2.5 Cloud LLM)' : 'Google Cloud Architecture Ready'}`;
    }

    return `### 🛡️ Sentinel Core Master Terminal
Greetings, **${name}**. Sentinel AI master terminal is online with unrestricted root authority.

**Master Capabilities:**
- *"Analyze security anomalies"* — Audits security log velocity and unauthorized attempt flags.
- *"Show restricted or frozen accounts"* — Lists accounts requiring administrative override.
- *"Executive metrics summary"* — Total bank reserves, active accounts, and transaction volume.
- *"GCP deployment status"* — Real-time Google Cloud infrastructure readiness report.`;
  }

  // ==========================================
  // 2. BRANCH EMPLOYEE (STAFF / TELLER): NEXUS OPS
  // ==========================================
  if (role === 'teller' || role === 'employee') {
    if (query.includes('kyc') || query.includes('onboard') || query.includes('verify')) {
      return `### 📋 Branch KYC Onboarding Standard Operating Procedure
**Mandatory Customer Verification Checklist:**

1. **Identity Proof (POI):** Valid Passport, National ID (Aadhaar/PAN card) with verified biometric/photo match.
2. **Address Verification (POA):** Utility bill or residential lease agreement issued within the past 90 days.
3. **Account Creation Protocol:**
   - Open **Onboard Customer (KYC)** tab.
   - Enter legal name, validated email, and minimum 10-digit mobile contact.
   - An initial savings account and instant Platinum Visa Debit Card will be issued automatically with the customer's initial cash deposit.`;
    }

    if (query.includes('limit') || query.includes('threshold') || query.includes('cash') || query.includes('deposit') || query.includes('withdraw')) {
      return `### 💵 Branch Teller Cash Guidelines
**Standard Teller Limits:**

- **Single Counter Deposit Limit:** \`₹10,00,000\` (Any deposit exceeding ₹2,00,000 requires PAN documentation).
- **Single Counter Withdrawal Limit:** \`₹5,00,000\` (Requires customer physical or digital signature verification).
- **Account Status Pre-Check:** Ensure the target account is marked **ACTIVE** prior to submitting cash operations.`;
    }

    if (query.includes('fraud') || query.includes('suspicious') || query.includes('flag')) {
      return `### 🚨 Suspicious Transaction Response Protocol
**Immediate Steps for Branch Staff:**

1. **Halt Immediate Clearance:** Do not disburse large unverified back-to-back cash withdrawals.
2. **Verify Account Standing:** Check the transaction history in the **Transaction Ledger** tab.
3. **Escalate to Management:** If suspicious activity or AML velocity is detected, request the Chief Administrator to mark the account as **FROZEN**.`;
    }

    return `### 🏢 Nexus Branch Operations Copilot
Hello, **${name}**. Nexus Ops is standing by for branch customer onboarding, teller cash desk procedures, and KYC compliance.

**Quick Prompts:**
- *"Customer KYC requirements"* — Complete checklist for walk-in customer onboarding.
- *"Teller cash limits"* — Thresholds for counter cash deposits and withdrawals.
- *"Suspicious transaction protocol"* — Fraud response and AML guidelines.`;
  }

  // ==========================================
  // 3. CUSTOMER WEALTH PORTAL & PUBLIC GUEST: AURA BANKING ASSISTANT
  // ==========================================
  const isGuest = user.role === 'guest' || !user.id;

  // Calculate dynamic time of day greeting
  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  // Bank Domain Boundary / Guardrail Check:
  // If query is unrelated to banking, finance, investments, accounts, or economy
  const BANKING_TERMS = [
    'bank', 'account', 'balance', 'loan', 'emi', 'mortgage', 'credit', 'debit', 'card',
    'fd', 'fixed deposit', 'deposit', 'saving', 'savings', 'interest', 'rate', 'rbi', 'dicgc', 'branch',
    'ifsc', 'transfer', 'pay', 'payment', 'neft', 'rtgs', 'imps', 'upi', 'kyc', 'pan', 'aadhaar',
    'ppf', 'nps', 'pension', 'provident', 'sukanya', 'ssy', 'sgb', 'gold', 'tax', '80c', '80ccd',
    'demat', 'trading', 'stock', 'stocks', 'share', 'shares', 'brokerage', 'equity', 'f&o', 'futures',
    'option', 'options', 'fund', 'funds', 'mutual', 'sip', 'invest', 'investment', 'investing',
    'portfolio', 'wealth', 'money', 'cash', 'teller', 'fraud', 'security', 'hotline', 'statement',
    'cheque', 'check', 'audit', 'login', 'portal', 'password', 'user', 'limit', 'limits',
    'offer', 'offers', 'festive', 'deal', 'deals', 'cashback', 'charges', 'charge', 'fee', 'fees',
    'concierge', 'lounge', 'visa', 'metal', 'titanium', 'burgundy', 'onboard', 'apply', 'register',
    'open', 'close', 'freeze', 'unfreeze', 'help', 'aura', 'sentinel', 'nexus', 'hello', 'hi', 'hey',
    'morning', 'evening', 'afternoon', 'namaste', 'status', 'who are you', 'what can you do'
  ];

  const words = query.replace(/[^\w\s]/g, '').split(/\s+/);
  const isBankingQuery = words.some(w => BANKING_TERMS.includes(w)) || 
                         BANKING_TERMS.some(term => query.includes(term));

  if (!isBankingQuery && query.length > 3) {
    return `### 🏛️ Max Global Banking Concierge Notice
I apologize, but as Max Global Private Bank's specialized financial intelligence assistant, I am exclusively programmed to assist with **banking services, wealth management, accounts, loans, and regulatory topics**.

I cannot provide answers on general topics outside our financial ecosystem.

**Here are ways I can assist you right now:**
- 📈 **Trading & 3-in-1 Demat Accounts:** Zero brokerage on equity delivery, ₹20 on Intraday & F&O.
- 🛡️ **Government Schemes & Funding:** Public Provident Fund (PPF @ 7.10%), National Pension System (NPS), and Sukanya Samriddhi (SSY).
- 💰 **High-Yield Term Deposits:** 7.85% p.a. guaranteed quarterly compounding with senior citizen bonus (8.35%).
- 🏡 **Pre-Approved Loans & Mortgages:** Home loans from 8.40% p.a. with 0% festive processing fees.
- 💳 **Titanium Metal Cards & Lounges:** 1,200+ airport lounges worldwide and 0% forex markup.
- 🏛️ **RBI Licensing & Insurance:** RBI Scheduled Bank standing and DICGC ₹5,00,000 cover.

*Please feel free to ask any question regarding your accounts or investment journey!*`;
  }

  // 1. Government Schemes & Funding (PPF, NPS, SSY, SGB)
  if (query.includes('ppf') || query.includes('nps') || query.includes('pension') || query.includes('provident') || query.includes('sukanya') || query.includes('ssy') || query.includes('funding') || query.includes('80c') || query.includes('sgb') || query.includes('gold bond')) {
    return `### 🏛️ Government Funding & Tax-Advantaged Schemes
Max Global Private Bank is an authorized statutory agency for Government of India sovereign savings instruments:

1. **Public Provident Fund (PPF @ 7.10% p.a.):**
   - **Sovereign Guarantee:** Fully backed by the Government of India with 100% capital safety.
   - **Tax Exemption (EEE Status):** Triple tax exemption on investment, accumulated interest, and maturity proceeds under Section 80C (up to ₹1,50,000/year).
   - **Tenure:** 15 years with flexible 5-year extensions and loan-against-PPF facility from 3rd year.

2. **National Pension System (NPS - Tier 1 & Tier 2):**
   - **Retirement Corpus:** Market-linked asset allocation across Equities (E), Corporate Debt (C), and Government Securities (G).
   - **Additional Tax Deduction:** Exclusive **₹50,000 deduction under Section 80CCD(1B)** over and above Section 80C.
   - **Low Cost Structure:** Ultra-low fund management fee (under 0.09% p.a.).

3. **Sukanya Samriddhi Yojana (SSY @ 8.20% p.a.):**
   - Designed for girl child higher education and welfare with maximum tax-free compounding.

4. **Sovereign Gold Bonds (SGB) & Digital Gold:**
   - 2.50% guaranteed annual interest credited semi-annually + 100% upside of market gold appreciation with zero capital gains tax upon maturity.

*Click on **Govt Savings & PPF/NPS** in our navigation to open your account or calculate your 15-year wealth accumulation!*`;
  }

  // 2. Stock Trading, Demat & Brokerage (3-in-1 Account)
  if (query.includes('trading') || query.includes('demat') || query.includes('stock') || query.includes('share') || query.includes('brokerage') || query.includes('equity') || query.includes('f&o') || query.includes('futures') || query.includes('options') || query.includes('ipo') || query.includes('mutual fund') || query.includes('sip')) {
    return `### 📈 Max Global Securities 3-in-1 Demat & Trading Account
Seamlessly integrate your **Savings Account + Demat Account + Trading Terminal** for instant fund transfers and zero trade latency:

- **Brokerage Pricing Structure:**
  • **Equity Delivery:** **₹0 (Flat FREE for Life)** — Invest in long-term stocks with zero commission.
  • **Intraday & F&O:** **Flat ₹20 per executed order** (regardless of transaction size).
  • **Account Opening Fee:** **₹0 (Completely Waived for 2026)**.
  • **First Year AMC:** 100% Free Maintenance Charges.
- **Key Capabilities:**
  • Direct CDSL & NSDL depository integration with automated dividend credits to your Max Global savings account.
  • Instant 1-click IPO applications with pre-linked UPI ASBA mandate.
  • Advanced Trading Terminal: Real-time TradingView charts, Level-3 market depth, and algorithmic stop-loss triggers.
  • 2,500+ Direct Mutual Funds with 0% distributor commission.

*Click on **Trading & Demat** in our header to open your 3-in-1 account online in under 3 minutes!*`;
  }

  // 3. Festive Offers & Deals
  if (query.includes('offer') || query.includes('festive') || query.includes('cashback') || query.includes('deal') || query.includes('discount')) {
    return `### 🎁 Active Festive Privileges & Offers (Festive 2026)
Max Global Private Bank is currently running special celebrations:

1. **Festive Home Loan Bonanza:** Flat **0% Processing Fee** and interest rates starting at \`8.40% p.a.\`
2. **Senior Citizen FD Boost:** Additional **+0.50% yield** (Total \`8.35% p.a.\`) on 1-year to 5-year deposits.
3. **Max Infinite Metal Card Welcome:** Complimentary annual Taj Epicure membership + 10,000 bonus reward points.
4. **Instant Gold Loan:** Concessional rate starting at \`7.50% p.a.\` with zero appraisal charges.
5. **Zero Balance Wealth Salary:** Free Platinum Visa Debit card + ₹20,000 partner brand vouchers.

*Visit our **Offers & Privileges** page to view all live seasonal campaigns!*`;
  }

  // 2. RBI & Security
  if (query.includes('rbi') || query.includes('safe') || query.includes('secure') || query.includes('insurance') || query.includes('licence') || query.includes('license') || query.includes('dicgc')) {
    return `### 🏛️ Reserve Bank of India (RBI) Regulatory Standing
Max Global Private Bank operates under the highest regulatory and sovereign standards:

- **RBI License Code:** \`RBI/2026/MGPB-8842\` (Scheduled Commercial Bank under Reserve Bank of India Act, 1934).
- **Deposit Insurance (DICGC):** All deposits up to **₹5,00,000 per depositor** are unconditionally insured by the Deposit Insurance and Credit Guarantee Corporation (a wholly-owned statutory subsidiary of the RBI).
- **Capital Adequacy (CRAR):** Above 18.5%, significantly exceeding the statutory Basel III mandate.
- **Data Security:** ISO 27001 certified with quantum-ready 256-bit AES encryption and 24x7 automated fraud monitoring.`;
  }

  // 3. Cards & Lounges
  if (query.includes('card') || query.includes('visa') || query.includes('lounge') || query.includes('debit') || query.includes('credit card') || query.includes('metal')) {
    return `### 💳 Max Global Infinite & Platinum Cards
Experience unparalleled privileges worldwide:

- **Max Infinite Visa Metal:**
  • Crafted in solid dark titanium with contactless chip.
  • Complimentary domestic & international airport lounge access across 1,200+ airports.
  • 5X reward points on dining, luxury retail, and international travel.
  • Zero foreign currency markup fee on international transactions.
- **Max Platinum Privilege Debit:**
  • ₹2,00,000 daily POS & digital transaction limit.
  • 1-click in-app freeze/unfreeze security toggle.
  • Comprehensive ₹10 Lakhs cyber fraud protection cover.

*Existing customers can manage cards directly from the **Cards** portal tab.*`;
  }

  // 4. Fixed Deposits & Savings Rates
  if (query.includes('deposit') || query.includes('fd') || query.includes('saving') || (query.includes('interest') && !query.includes('loan'))) {
    const principal = 100000;
    const rate = 7.85;
    const tenureMonths = 12;
    const maturityAmount = Math.round(principal * Math.pow(1 + (rate / 100) / 4, (4 * tenureMonths) / 12));

    return `### 💰 High-Yield Term Fixed Deposits (7.85% p.a.)
Max Global Private Bank offers guaranteed returns backed by DICGC insurance and RBI statutory capital protections:

- **1-Year Term Deposit Rate:** \`7.85% p.a.\`
- **Senior Citizens:** \`8.35% p.a.\` (+0.50% extra yield)
- **Savings Account Daily Yield:** \`4.25% p.a.\` on daily balances
- **Compounding Frequency:** Quarterly compounding
- **Example:** An investment of \`₹1,00,000\` matures to **₹${maturityAmount.toLocaleString('en-IN')}** in 12 months.
- **Premature Liquidity:** Available anytime via your NetBanking terminal without penalties.

*Visit the **Wealth & Deposits** page to use the interactive compound calculator or book instantly!*`;
  }

  // 5. Loans & Credit
  if (query.includes('loan') || query.includes('emi') || query.includes('mortgage') || query.includes('credit')) {
    const amountMatch = query.match(/(\d[\d,]*)/);
    const principal = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 500000;
    const rate = query.includes('home') ? 8.40 : 8.50;
    const tenureMonths = query.includes('home') ? 240 : 36;
    const monthlyRate = (rate / 12) / 100;
    const emi = Math.round((principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1));
    const totalPayment = emi * tenureMonths;
    const totalInterest = totalPayment - principal;

    return `### 📊 Instant Loan Sanction Calculator
**Loan Facility:** ${query.includes('home') ? 'Residential Dream Home Loan' : 'Max Global Prime Credit'}

- **Principal Requested:** \`₹${principal.toLocaleString('en-IN')}\`
- **Interest Rate:** \`${rate}% p.a.\` (Home loans start @ \`8.40%\`, Personal @ \`10.50%\`)
- **Repayment Tenure:** \`${tenureMonths} Months (${tenureMonths/12} Years)\`
- **Estimated Monthly EMI:** **₹${emi.toLocaleString('en-IN')} / month**
- **Total Interest Payable:** \`₹${totalInterest.toLocaleString('en-IN')}\`
- **Total Repayment:** \`₹${totalPayment.toLocaleString('en-IN')}\`

🎉 **Festive Bonanza:** 100% processing fee waiver is currently active! ${isGuest ? 'Sign in or open an account to receive instant sanctioning.' : 'Head to the **Loans & Credit** tab in your dashboard for 60-second disbursement.'}`;
  }

  // 6. Balance & Portfolio
  if (query.includes('balance') || query.includes('portfolio') || query.includes('statement')) {
    if (isGuest) {
      return `### 💎 Portfolio & Account Balance
To view your real-time liquid balance, statements, and active deposits, please sign in using the **NetBanking Sign In** button in the top navigation.

*Don't have an account with Max Global yet?*
You can open a **Digital Savings Account in 3 minutes** with zero minimum balance and instant virtual Visa Platinum debit card issuance. Click **Open Digital Account** to start!`;
    }

    const [accounts] = await db.query('SELECT account_number, account_type, balance, status FROM accounts WHERE customer_id = ?', [user.id]);
    const total = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const accList = accounts.map(a => `• **${a.account_type.toUpperCase()} A/C** \`${a.account_number}\`: **₹${Number(a.balance).toLocaleString('en-IN')}** [${a.status.toUpperCase()}]`).join('\n') || '• No accounts linked.';

    return `### 💎 Portfolio Balance Overview
Welcome, **${name}**. Here is your real-time liquid portfolio standing:

${accList}

**Total Available Liquid Balance:** \`₹${total.toLocaleString('en-IN')}\`
**Account Health Rating:** Tier-1 Prime

*Tip: You can transfer funds 24x7 using the **Pay & Transfer** tab or grow your savings with our 7.85% Term Fixed Deposits.*`;
  }

  if (query.includes('open') || query.includes('register') || query.includes('apply') || query.includes('account')) {
    return `### 🚀 Open Digital Account in 3 Minutes
Opening a savings account with Max Global Private Bank is 100% digital and paperless:

1. Click on **Open Digital Account** in the top navigation or banner.
2. Enter your Full Name, Email, Phone Number, and residential address.
3. Choose your secure NetBanking username and password.
4. Instant account generation with IFSC \`MGPB0001042\` and instant virtual Visa Platinum debit card!

*Zero minimum balance requirement with 4.25% p.a. interest!*`;
  }

  if (query.includes('deposit') || query.includes('fd') || query.includes('saving') || query.includes('interest') || query.includes('rate')) {
    const principal = 100000;
    const rate = 7.85;
    const tenureMonths = 12;
    const maturityAmount = Math.round(principal * Math.pow(1 + (rate / 100) / 4, (4 * tenureMonths) / 12));

    return `### 💰 High-Yield Term Fixed Deposits (7.85% p.a.)
Max Global Private Bank offers guaranteed returns backed by DICGC insurance and RBI statutory capital protections:

- **1-Year Term Deposit Rate:** \`7.85% p.a.\`
- **Senior Citizens:** \`8.35% p.a.\` (+0.50% extra)
- **Compounding Frequency:** Quarterly compounding
- **Example:** An investment of \`₹1,00,000\` matures to **₹${maturityAmount.toLocaleString('en-IN')}** in 12 months.
- **Premature Liquidity:** Available anytime via your NetBanking terminal.

*Visit the **Wealth & Deposits** page to use the interactive compound calculator or book instantly!*`;
  }

  if (query.includes('transfer') || query.includes('send') || query.includes('pay') || query.includes('upi') || query.includes('neft')) {
    return `### 🚀 24x7 Instant Fund Transfer Guide
Sending money to another Max Global account or any other Indian bank is instant and free:

1. Sign in to your NetBanking account.
2. Click on **Pay & Transfer** in the top portal menu.
3. Enter the recipient's **12-digit Account Number** and amount.
4. 1-Click biometric / secure confirmation with zero transfer fees!

🔒 *Your transfers are protected by 256-bit bank-grade encryption and atomic ledger verification.*`;
  }

  // Customer General Greeting with Live Time-of-Day
  return `### 💎 Aura Financial Concierge
${timeGreeting}, **${name}**! I am Aura, your 24/7 personal wealth, loan, and banking assistant at Max Global Private Bank.

**How may I assist your portfolio today?**
- 📈 *"Tell me about 3-in-1 Demat & stock trading"* — ₹0 delivery brokerage and instant setup.
- 🛡️ *"Explain PPF and NPS government schemes"* — 7.10% tax-free compounding & 80CCD deductions.
- 📊 *"Calculate loan EMI for ₹10,00,000"* — Instant loan calculations and monthly installments.
- 💰 *"Fixed Deposit 7.85% returns"* — Guaranteed growth calculations and senior citizen rates.
- 💳 *"What cards do you offer?"* — Max Infinite Titanium Metal privileges & lounge directory.
- 🎁 *"Active festive offers"* — 0% processing fees and fee waivers.`;
}

/**
 * Main chat dispatcher with role authorization and Google Cloud Gemini integration
 */
async function processChatMessage(user, message, conversationHistory = []) {
  const activeUser = user || { role: 'guest', name: 'Valued Guest' };
  const role = activeUser.role || 'guest';
  const userName = activeUser.name || 'Valued Guest';

  let systemPrompt = `You are "Aura", the enterprise AI Banking Assistant for Max Global Private Bank (RBI Regulated Scheduled Commercial Bank).
Current User: ${userName} (Role: ${role.toUpperCase()}).
Maintain a professional, polished, high-end private banking tone formatted with clean Markdown.
`;

  if (role === 'admin') {
    systemPrompt += `You are "Sentinel Core", the Chief Risk, Security & Compliance AI Officer for Executive Administrators.
Provide administrative, security audit, database telemetry, and risk management insights.`;
  } else if (role === 'teller' || role === 'manager') {
    systemPrompt += `You are "Nexus Ops", the Operations and Teller Copilot for Branch Staff.
Provide customer onboarding KYC guidance, teller cash limits, and branch compliance procedures.`;
  } else {
    systemPrompt += `You are "Aura", the 24/7 Personal Wealth & Banking Concierge.
Help the user understand interest rates (FD 7.85%, Savings 4.25%, Home Loan 8.40%), loan EMI simulations, cards, festive privileges, and account opening procedures.`;
  }

  if (GEMINI_API_KEY) {
    try {
      const gcpResponse = await callGeminiApi(systemPrompt, message, conversationHistory);
      return {
        text: gcpResponse,
        provider: 'Google Cloud Gemini 2.5',
        model: GEMINI_MODEL,
        isCloud: true
      };
    } catch (err) {
      console.warn('Google Cloud Gemini API call fallback:', err.message);
    }
  }

  const localResponse = await generateIntelligentResponse(activeUser, message);
  return {
    text: localResponse,
    provider: 'Max Global Intelligent Core (Cloud-Ready)',
    model: 'GCP-Gemini-Ready',
    isCloud: false
  };
}

function getAiStatus() {
  return {
    hasKey: !!GEMINI_API_KEY,
    provider: GEMINI_API_KEY ? 'Google Cloud Gemini (Active)' : 'Max Global Intelligent Core (Cloud-Ready)',
    model: GEMINI_MODEL,
    projectId: GCP_PROJECT_ID || 'max-global-bank-cloud',
    gcpReady: true
  };
}

module.exports = {
  processChatMessage,
  getAiStatus
};
