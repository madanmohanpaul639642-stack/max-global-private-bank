/**
 * Max Global Private Bank — Enterprise Multi-Portal Application
 * Scheduled Commercial Bank Regulated by the Reserve Bank of India (RBI)
 */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

let currentUser = null;
let csrfToken = '';
let activePortalChoice = 'customer';
let activePublicPage = 'home';
let activeCustomerView = 'accounts';
let activeEmployeeView = 'search';
let activeAdminView = 'telemetry';
let publicContent = { settings: {}, offers: [] };
let cachedCustomerData = null;
let aiChatHistory = [];
let soundOn = true;

// ========================================================
// 1. SYNTHESIZED AUDIO FEEDBACK (WEB AUDIO API)
// ========================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(type = 'click') {
  if (!soundOn) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (_) {}
}

function toggleAudio() {
  soundOn = !soundOn;
  $('#soundIcon').textContent = soundOn ? '🔊' : '🔇';
  if (soundOn) playTone('click');
}

// ========================================================
// 2. HTTP API COMMUNICATION LAYER & AUTONOMOUS ENGINE
// ========================================================
let autonomousMode = false;

function initAutonomousStorage() {
  if (!localStorage.getItem('mgpb_settings')) {
    localStorage.setItem('mgpb_settings', JSON.stringify({
      bank_name: 'Max Global Private Bank',
      savings_rate: '4.25',
      fd_rate: '7.85',
      home_loan_rate: '8.40',
      personal_loan_rate: '10.50',
      car_loan_rate: '8.75',
      rbi_license: 'RBI/2026/MGPB-8842',
      dicgc_insured: '₹5,00,000 per depositor',
      customer_count: '28,40,000+'
    }));
  }

  if (!localStorage.getItem('mgpb_offers')) {
    localStorage.setItem('mgpb_offers', JSON.stringify([
      { id: 1, title: 'Festive Home Loan Bonanza', category: 'Loans', discount_badge: '0% Processing Fee', rate_headline: '8.40% p.a.', description: 'Zero processing charges and immediate sanction for luxury home purchases.', promo_code: 'FESTIVEHOME26' },
      { id: 2, title: 'Senior Citizen Term Deposit Booster', category: 'Wealth', discount_badge: '+0.50% Extra Yield', rate_headline: '8.35% p.a.', description: 'Special high-yield quarterly compounding deposit for senior citizens.', promo_code: 'SENIOR835' },
      { id: 3, title: 'Max Infinite Metal Card Welcome', category: 'Cards', discount_badge: 'Taj Epicure Membership', rate_headline: '5X Reward Points', description: 'Handcrafted titanium metal chip card with zero foreign exchange markup.', promo_code: 'METALVIP26' },
      { id: 4, title: 'Commercial SME Capital Line', category: 'Loans', discount_badge: 'Concessional 9.25%', rate_headline: '9.25% p.a.', description: 'Fast-track working capital line for expanding businesses with digital appraisal.', promo_code: 'SMECREDIT' },
      { id: 5, title: 'Direct Equity Demat Welcome', category: 'Wealth', discount_badge: '₹0 Commission', rate_headline: 'Flat ₹0 Delivery', description: 'Zero brokerage on equity delivery with complimentary Level-3 trading charts.', promo_code: 'ZEROBROKER' },
      { id: 6, title: 'Instant Sovereign Gold Bond Allocation', category: 'Wealth', discount_badge: '2.50% Annual Coupon', rate_headline: 'Zero Tax on Gains', description: 'Sovereign guaranteed wealth preservation with bi-annual coupon payouts.', promo_code: 'GOLDBOND26' }
    ]));
  }

  if (!localStorage.getItem('mgpb_accounts')) {
    localStorage.setItem('mgpb_accounts', JSON.stringify([
      { id: 1, account_number: '100000000001', customer_id: 1, account_type: 'savings', balance: 1250000, status: 'active', ifsc_code: 'MGPB0000042' },
      { id: 2, account_number: '100000000002', customer_id: 1, account_type: 'current', balance: 250000, status: 'active', ifsc_code: 'MGPB0000042' }
    ]));
  }

  if (!localStorage.getItem('mgpb_transactions')) {
    localStorage.setItem('mgpb_transactions', JSON.stringify([
      { id: 1, reference_code: 'TXN-SAL-8821', from_account_id: null, to_account_id: 1, transaction_type: 'deposit', amount: 350000, description: 'Monthly Executive Salary Credit - Tech Corp', status: 'completed', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 2, reference_code: 'TXN-DIV-9430', from_account_id: null, to_account_id: 1, transaction_type: 'deposit', amount: 500000, description: 'Quarterly Mutual Fund Dividend Payout', status: 'completed', created_at: new Date(Date.now() - 86400000 * 5).toISOString() }
    ]));
  }

  if (!localStorage.getItem('mgpb_customers')) {
    localStorage.setItem('mgpb_customers', JSON.stringify([
      { id: 1, customer_code: 'CUS1001', full_name: 'Aarav Sharma', username: 'aarav', password: 'Customer123!', email: 'aarav.sharma@maxglobalbank.com', phone: '+91 98200 12345', address: '42 Altamount Road, Mumbai', status: 'active' },
      { id: 2, customer_code: 'CUS1002', full_name: 'Priya Patel', username: 'priya', password: 'Customer123!', email: 'priya.patel@maxglobalbank.com', phone: '+91 98765 12345', address: '12 Nariman Point, Mumbai', status: 'active' }
    ]));
  }

  if (!localStorage.getItem('mgpb_employees')) {
    localStorage.setItem('mgpb_employees', JSON.stringify([
      { id: 1, employee_code: 'EMP1001', full_name: 'Chief Administrator', username: 'admin', role: 'admin', branch: 'Global Headquarters', status: 'active' },
      { id: 2, employee_code: 'EMP1002', full_name: 'Senior Branch Teller', username: 'teller', role: 'teller', branch: 'Mumbai BKC Financial Center', status: 'active' }
    ]));
  }
}

// Autonomous in-browser fallback engine for static deployments (Netlify, GitHub Pages, Vercel)
async function handleAutonomousApi(url, options = {}) {
  initAutonomousStorage();
  const cleanUrl = url.split('?')[0];
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};

  // Public Content
  if (cleanUrl === '/api/public/content') {
    return {
      settings: JSON.parse(localStorage.getItem('mgpb_settings') || '{}'),
      offers: JSON.parse(localStorage.getItem('mgpb_offers') || '[]')
    };
  }

  // Active Session
  if (cleanUrl === '/api/auth/me') {
    const user = JSON.parse(localStorage.getItem('mgpb_session_user') || 'null');
    return { user, csrfToken: 'autonomous-live-csrf-token' };
  }

  // Login
  if (cleanUrl === '/api/auth/login') {
    const { username, password, portal } = body;
    if (portal === 'admin') {
      if (username === 'admin' && password === 'Admin123!') {
        const user = { id: 1, name: 'Chief Administrator', username: 'admin', role: 'admin', employeeCode: 'EMP1001' };
        localStorage.setItem('mgpb_session_user', JSON.stringify(user));
        return { ok: true, user };
      }
      throw new Error('Invalid administrator credentials.');
    }
    if (portal === 'employee') {
      if ((username === 'teller' && password === 'Teller123!') || (username === 'admin' && password === 'Admin123!')) {
        const user = { id: 2, name: 'Senior Branch Teller', username: 'teller', role: 'teller', employeeCode: 'EMP1002' };
        localStorage.setItem('mgpb_session_user', JSON.stringify(user));
        return { ok: true, user };
      }
      throw new Error('Invalid branch staff credentials.');
    }
    // Customer
    const customers = JSON.parse(localStorage.getItem('mgpb_customers') || '[]');
    const match = customers.find(c => c.username.toLowerCase() === (username || '').toLowerCase() && c.password === password);
    if (match) {
      const user = { id: match.id, name: match.full_name, username: match.username, role: 'customer', customerCode: match.customer_code };
      localStorage.setItem('mgpb_session_user', JSON.stringify(user));
      return { ok: true, user };
    }
    throw new Error('Invalid Customer NetBanking credentials.');
  }

  // Register
  if (cleanUrl === '/api/auth/register') {
    const { fullName, username, password, email, phone, address, panNumber } = body;
    const customers = JSON.parse(localStorage.getItem('mgpb_customers') || '[]');
    const newId = customers.length ? Math.max(...customers.map(c => c.id)) + 1 : 1;
    const customerCode = 'CUS' + (1000 + newId);
    const accountNumber = '1000' + Math.floor(10000000 + Math.random() * 90000000);

    const newCust = { id: newId, customer_code: customerCode, full_name: fullName, username, password, email, phone, address, panNumber, status: 'active' };
    customers.push(newCust);
    localStorage.setItem('mgpb_customers', JSON.stringify(customers));

    const accounts = JSON.parse(localStorage.getItem('mgpb_accounts') || '[]');
    accounts.push({ id: accounts.length + 1, account_number: accountNumber, customer_id: newId, account_type: 'savings', balance: 100000, status: 'active', ifsc_code: 'MGPB0000042' });
    localStorage.setItem('mgpb_accounts', JSON.stringify(accounts));

    return { ok: true, accountNumber, customerCode };
  }

  // Logout
  if (cleanUrl === '/api/auth/logout') {
    localStorage.removeItem('mgpb_session_user');
    return { ok: true };
  }

  // Customer Accounts
  if (cleanUrl === '/api/customer/accounts') {
    const user = JSON.parse(localStorage.getItem('mgpb_session_user') || '{}');
    const accounts = JSON.parse(localStorage.getItem('mgpb_accounts') || '[]');
    const userAccs = accounts.filter(a => a.customer_id === (user.id || 1));
    return { accounts: userAccs.length ? userAccs : accounts };
  }

  // Customer Transactions
  if (cleanUrl === '/api/customer/transactions') {
    const txs = JSON.parse(localStorage.getItem('mgpb_transactions') || '[]');
    return { transactions: txs };
  }

  // Customer Transfer
  if (cleanUrl === '/api/customer/transfer') {
    const { fromAccountId, toAccountNumber, amount, description } = body;
    const pAmt = parseFloat(amount || 0);
    const accounts = JSON.parse(localStorage.getItem('mgpb_accounts') || '[]');
    const src = accounts.find(a => a.id === parseInt(fromAccountId) || a.account_number === fromAccountId) || accounts[0];
    if (!src || src.balance < pAmt) throw new Error('Insufficient funds in selected account.');

    src.balance -= pAmt;
    localStorage.setItem('mgpb_accounts', JSON.stringify(accounts));

    const txs = JSON.parse(localStorage.getItem('mgpb_transactions') || '[]');
    const ref = 'TXN-TRF-' + Math.floor(10000 + Math.random() * 90000);
    txs.unshift({ id: txs.length + 1, reference_code: ref, from_account_id: src.id, to_account_id: toAccountNumber, transaction_type: 'transfer', amount: pAmt, description: description || 'Instant Fund Transfer', status: 'completed', created_at: new Date().toISOString() });
    localStorage.setItem('mgpb_transactions', JSON.stringify(txs));

    return { ok: true, referenceCode: ref };
  }

  // Customer FD Booking
  if (cleanUrl === '/api/customer/fd/create') {
    const { fromAccountId, principal, tenureMonths, interestRate } = body;
    const p = parseFloat(principal || 0);
    const accounts = JSON.parse(localStorage.getItem('mgpb_accounts') || '[]');
    const src = accounts.find(a => a.id === parseInt(fromAccountId)) || accounts[0];
    if (src && src.balance >= p) {
      src.balance -= p;
      localStorage.setItem('mgpb_accounts', JSON.stringify(accounts));
    }
    const fdNo = 'FD-MGPB-' + Math.floor(1000 + Math.random() * 9000);
    return { ok: true, fdNumber: fdNo };
  }

  // Customer Loan Apply
  if (cleanUrl === '/api/customer/loan/apply') {
    const { targetAccountId, principal } = body;
    const p = parseFloat(principal || 0);
    const accounts = JSON.parse(localStorage.getItem('mgpb_accounts') || '[]');
    const dest = accounts.find(a => a.id === parseInt(targetAccountId)) || accounts[0];
    if (dest) {
      dest.balance += p;
      localStorage.setItem('mgpb_accounts', JSON.stringify(accounts));
    }
    const loanNo = 'LN-MGPB-' + Math.floor(1000 + Math.random() * 9000);
    return { ok: true, loanNumber: loanNo };
  }

  // Customer Card Lock
  if (cleanUrl === '/api/customer/card/toggle-lock') {
    const isLocked = localStorage.getItem('mgpb_card_locked') === 'true';
    localStorage.setItem('mgpb_card_locked', String(!isLocked));
    return { isLocked: !isLocked };
  }

  // Employee Search
  if (cleanUrl === '/api/employee/search') {
    const customers = JSON.parse(localStorage.getItem('mgpb_customers') || '[]');
    return { customers };
  }

  // Employee Cash Operation
  if (cleanUrl === '/api/employee/cash-transaction') {
    const { accountNumber, transactionType, amount, description } = body;
    const p = parseFloat(amount || 0);
    const accounts = JSON.parse(localStorage.getItem('mgpb_accounts') || '[]');
    const acc = accounts.find(a => a.account_number === accountNumber) || accounts[0];
    if (transactionType === 'withdrawal' && acc.balance < p) throw new Error('Insufficient funds.');
    if (transactionType === 'deposit') acc.balance += p;
    else acc.balance -= p;
    localStorage.setItem('mgpb_accounts', JSON.stringify(accounts));
    return { ok: true, referenceCode: 'TXN-CSH-' + Math.floor(10000 + Math.random() * 90000) };
  }

  // Employee Ledger
  if (cleanUrl === '/api/employee/ledger') {
    return { ledger: JSON.parse(localStorage.getItem('mgpb_transactions') || '[]') };
  }

  // Admin Stats
  if (cleanUrl === '/api/admin/system-stats') {
    return { totalVolume: '₹4,820 Cr', activeUsers: '28,40,000+', tier1Ratio: '18.5%' };
  }

  // Admin Employees
  if (cleanUrl === '/api/admin/employees') {
    return { employees: JSON.parse(localStorage.getItem('mgpb_employees') || '[]') };
  }

  // Admin Rates Update
  if (cleanUrl === '/api/admin/rates') {
    const current = JSON.parse(localStorage.getItem('mgpb_settings') || '{}');
    const updated = { ...current, ...body };
    localStorage.setItem('mgpb_settings', JSON.stringify(updated));
    return { ok: true };
  }

  // Admin Offers Update / Delete
  if (cleanUrl.startsWith('/api/admin/offers')) {
    let offers = JSON.parse(localStorage.getItem('mgpb_offers') || '[]');
    if (method === 'POST') {
      const newOffer = { id: offers.length + 1, ...body };
      offers.unshift(newOffer);
      localStorage.setItem('mgpb_offers', JSON.stringify(offers));
      return { ok: true, message: 'Offer created successfully.' };
    }
    if (method === 'DELETE') {
      const id = parseInt(cleanUrl.split('/').pop());
      offers = offers.filter(o => o.id !== id);
      localStorage.setItem('mgpb_offers', JSON.stringify(offers));
      return { ok: true, message: 'Offer deleted successfully.' };
    }
  }

  // AI Assistant Chat (Autonomous in-browser response)
  if (cleanUrl === '/api/ai/chat') {
    const msg = (body.message || '').trim().toLowerCase();
    const user = JSON.parse(localStorage.getItem('mgpb_session_user') || 'null');
    const name = user ? user.name : 'Valued Client';
    const hour = new Date().getHours();
    const timeWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const BANK_TERMS = ['bank','account','balance','loan','emi','mortgage','credit','debit','card','fd','deposit','saving','rate','interest','rbi','dicgc','ppf','nps','sukanya','ssy','sgb','gold','tax','80c','demat','trading','stock','brokerage','f&o','offer','festive','transfer','pay','hello','hi','hey','who are you'];
    const isBankQuery = BANK_TERMS.some(t => msg.includes(t));

    if (!isBankQuery && msg.length > 3) {
      return {
        text: `### 🏛️ Max Global Banking Concierge Notice\nI apologize, but as Max Global Private Bank's specialized financial intelligence assistant, I am exclusively programmed to assist with **banking services, wealth management, accounts, loans, and regulatory topics**.\n\n**Available facilities right now:**\n- 📈 **Trading & 3-in-1 Demat:** Zero brokerage on equity delivery, ₹20 on Intraday & F&O.\n- 🛡️ **Government Schemes:** PPF (@ 7.10% tax-free), NPS Tier-1/2, and Sukanya Samriddhi (@ 8.20%).\n- 💰 **High-Yield Term Deposits:** 7.85% p.a. guaranteed with senior citizen bonus (8.35%).\n- 🏡 **Pre-Approved Loans:** Home loans from 8.40% with 0% festive processing fees.\n- 💳 **Titanium Metal Cards:** 1,200+ airport lounges worldwide and 0% forex markup.`
      };
    }

    if (msg.includes('ppf') || msg.includes('nps') || msg.includes('govt') || msg.includes('sukanya') || msg.includes('scheme')) {
      return {
        text: `### 🏛️ Government Funding & Tax-Advantaged Schemes\n${timeWord}, **${name}**! Max Global Private Bank is an authorized statutory agency for sovereign instruments:\n\n1. **Public Provident Fund (PPF @ 7.10% p.a.):** Triple EEE tax exemption under Section 80C (up to ₹1,50,000/year).\n2. **National Pension System (NPS):** Exclusive extra ₹50,000 tax deduction under Section 80CCD(1B).\n3. **Sukanya Samriddhi Yojana (SSY @ 8.20% p.a.):** India's highest sovereign rate for girl children.\n4. **Sovereign Gold Bonds (SGB):** 2.50% annual coupon + 100% gold appreciation with zero capital gains tax.`
      };
    }

    if (msg.includes('trading') || msg.includes('demat') || msg.includes('stock') || msg.includes('brokerage')) {
      return {
        text: `### 📈 Max Global Securities 3-in-1 Demat & Trading\n${timeWord}, **${name}**! Seamlessly integrate Savings + Demat + Trading with zero latency:\n\n- **Equity Delivery Brokerage:** **Flat ₹0 (FREE for Life)**\n- **Intraday & F&O Commission:** **Flat ₹20 per executed order**\n- **Account Opening & 1st Year AMC:** **100% Free**\n- **Direct CDSL/NSDL Depository Integration** with instant ASBA IPO applications.`
      };
    }

    return {
      text: `### 💎 Aura Financial Concierge\n${timeWord}, **${name}**! I am Aura, your personal wealth, loan, and investment assistant at Max Global Private Bank.\n\n- *"Tell me about 3-in-1 Demat & stock trading"* — Flat ₹0 delivery brokerage.\n- *"Explain PPF and NPS government schemes"* — 7.10% tax-free compounding.\n- *"Fixed Deposit 7.85% returns"* — Guaranteed returns calculation.\n- *"Home Loan EMI Calculator"* — Pre-approved credit from 8.40% p.a.`
    };
  }

  return { ok: true };
}

async function api(url, options = {}) {
  if (autonomousMode) {
    return handleAutonomousApi(url, options);
  }

  const opts = {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.headers || {}) }
  };

  if (opts.body && typeof opts.body !== 'string') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }

  if (opts.method && !['GET', 'HEAD'].includes(opts.method.toUpperCase()) && csrfToken) {
    opts.headers['X-CSRF-Token'] = csrfToken;
  }

  let response;
  try {
    response = await fetch(url, opts);
  } catch (err) {
    console.warn('Backend API unreachable. Activating Autonomous Client Engine for deployment resilience.');
    autonomousMode = true;
    return handleAutonomousApi(url, options);
  }

  const contentType = response.headers.get('content-type') || '';

  // If server returns 404 HTML (e.g. Netlify / Vercel default 404 page for missing serverless endpoints) or 502/504
  if (!response.ok && (response.status === 404 || response.status === 502 || response.status === 504 || contentType.includes('text/html'))) {
    if (url.startsWith('/api/')) {
      console.warn(`Endpoint ${url} returned ${response.status}. Switching to Autonomous Engine.`);
      autonomousMode = true;
      return handleAutonomousApi(url, options);
    }
  }

  if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
    logoutClient();
    openPortalModal('customer');
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (contentType.includes('text/csv')) {
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'statement.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    return { ok: true };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    playTone('error');
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

function escapeHtml(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function money(v) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(v || 0));
}

function date(v) {
  return v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function notify(message, type = 'success', targetPortal = 'cust') {
  let noticeEl = null;
  if (targetPortal === 'cust') noticeEl = $('#custNotice');
  else if (targetPortal === 'emp') noticeEl = $('#empNotice');
  else if (targetPortal === 'admin') noticeEl = $('#adminNotice');

  if (!noticeEl) return;
  noticeEl.textContent = message;
  noticeEl.className = 'portal-notice ' + type;
  noticeEl.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (type === 'success') playTone('success');
  else playTone('error');
  setTimeout(() => noticeEl.classList.add('hidden'), 5000);
}

// ========================================================
// 3. PUBLIC WEBSITE DYNAMIC PAGES ROUTING
// ========================================================
async function loadPublicContent() {
  try {
    publicContent = await api('/api/public/content');
    const s = publicContent.settings || {};
    if (s.savings_rate) $('#ribbonSavingsRate').textContent = s.savings_rate + '% p.a.';
    if (s.fd_rate) $('#ribbonFdRate').textContent = s.fd_rate + '% p.a.';
    if (s.home_loan_rate) $('#ribbonHomeLoanRate').textContent = s.home_loan_rate + '% p.a.';
    if (s.personal_loan_rate) $('#ribbonPersonalLoanRate').textContent = s.personal_loan_rate + '% p.a.';
  } catch (_) {}
}

function renderPublicPage(pageName = 'home') {
  playTone('click');
  activePublicPage = pageName;
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.publicPage === pageName));
  $$('.fly-link').forEach(el => el.classList.toggle('active', el.dataset.publicPage === pageName));
  $('#mobileFlyout').classList.add('hidden');

  const container = $('#publicPageContainer');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (pageName === 'home') renderPageHome(container);
  else if (pageName === 'personal') renderPagePersonal(container);
  else if (pageName === 'wealth') renderPageWealth(container);
  else if (pageName === 'govtsavings') renderPageGovtSavings(container);
  else if (pageName === 'trading') renderPageTrading(container);
  else if (pageName === 'loans') renderPageLoans(container);
  else if (pageName === 'cards') renderPageCards(container);
  else if (pageName === 'offers') renderPageOffers(container);
  else if (pageName === 'security') renderPageSecurity(container);
}

// --- Page 1: Home Overview ---
function renderPageHome(c) {
  const s = publicContent.settings || {};
  const fdRate = s.fd_rate || '7.85';
  const homeRate = s.home_loan_rate || '8.40';
  const savRate = s.savings_rate || '4.25';
  const customerCount = s.customer_count || '28,40,000+';

  c.innerHTML = `
    <!-- 1. Landing Hero Section -->
    <section class="landing-hero">
      <div class="hero-container">
        <div class="hero-left">
          <div class="hero-badge">
            <span class="badge-dot"></span> RBI SCHEDULED COMMERCIAL BANK • ${customerCount} CLIENTS
          </div>
          <h1 class="hero-title">
            Banking Engineered for <span class="text-gradient-gold">Private Wealth Growth.</span>
          </h1>
          <p class="hero-lead">
            Welcome to Max Global Private Bank. Experience sovereign-grade capital protection, term deposits yielding up to <strong>${fdRate}% p.a.</strong>, pre-approved credit lines, and 24x7 intelligent digital transfers.
          </p>

          <div class="hero-cta-row">
            <button class="btn btn-primary-large" id="heroOpenAccountBtn" onclick="openInstantAccountModal('savings')">
              <span>Open Digital Account (3 Mins)</span> <span>↗</span>
            </button>
            <button class="btn btn-secondary-large" id="heroSignInBtn" onclick="openPortalModal('customer')">
              <span>Sign In to NetBanking</span>
            </button>
          </div>

          <div class="hero-highlights">
            <div class="hl-box">
              <span class="hl-val">${fdRate}%</span>
              <span class="hl-lbl">Annual FD Returns</span>
            </div>
            <div class="hl-box">
              <span class="hl-val">₹0</span>
              <span class="hl-lbl">Zero Balance Accounts</span>
            </div>
            <div class="hl-box">
              <span class="hl-val">${homeRate}%</span>
              <span class="hl-lbl">Home Loan Interest</span>
            </div>
            <div class="hl-box">
              <span class="hl-val">DICGC</span>
              <span class="hl-lbl">Insured up to ₹5 Lakh</span>
            </div>
          </div>
        </div>

        <div class="hero-right">
          <!-- Real Visa Card Showcase -->
          <div class="visa-card-showcase">
            <div class="visa-card-inner">
              <div class="vc-top">
                <span class="vc-bank">MAX GLOBAL PRIVATE BANK</span>
                <span class="vc-visa">VISA</span>
              </div>
              <div class="vc-chip-row">
                <div class="emv-gold-chip"></div>
                <span class="contactless-symbol">)))</span>
              </div>
              <div class="vc-number">4532 •••• •••• 8901</div>
              <div class="vc-bottom">
                <div>
                  <small>AUTHORIZED HOLDER</small>
                  <strong>AARAV SHARMA</strong>
                </div>
                <div>
                  <small>VALID THRU</small>
                  <strong>12/30</strong>
                </div>
                <div class="vc-tier">INFINITE METAL</div>
              </div>
            </div>
          </div>

          <div class="floating-promo-card promo-left" onclick="openDepositBookingModal('regular', '${fdRate}')" style="cursor:pointer;" title="Click to book Term Deposit">
            <div class="promo-icon gold">💰</div>
            <div>
              <div class="promo-title">Sovereign Term Deposit</div>
              <div class="promo-sub">${fdRate}% p.a. for 12 months • Zero risk</div>
            </div>
          </div>

          <div class="floating-promo-card promo-right" onclick="openLoanApplicationModal('Instant Personal Credit', '10.50')" style="cursor:pointer;" title="Click to apply for instant credit">
            <div class="promo-icon green">⚡</div>
            <div>
              <div class="promo-title">Instant Loan Sanction</div>
              <div class="promo-sub">Direct disbursement in 60 seconds</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. FESTIVE SEASON 2026 MEGA AD BILLBOARD -->
    <section class="landing-section" style="padding-top:20px; padding-bottom:10px;">
      <div class="festive-mega-banner">
        <div>
          <span class="festive-badge">🎉 FESTIVE DHAMAKA 2026 CELEBRATION</span>
          <h2 class="festive-title">Exclusive Festive Privileges & Zero Processing Fee Bonanza</h2>
          <p class="festive-text">
            Celebrate this season with Max Global Private Bank. Enjoy complete fee waivers on home & car loans, an extra <strong>+0.50% interest bonus</strong> for senior citizens, and luxury dining cashback across India.
          </p>
          <div class="festive-perks-row">
            <div class="festive-perk-pill">✨ 0% Loan Processing Fee</div>
            <div class="festive-perk-pill">💰 8.15% Senior Citizen FD Rate</div>
            <div class="festive-perk-pill">🏨 ₹25,000 Taj Hotels Luxury Voucher</div>
            <div class="festive-perk-pill">✈️ Unlimited VIP Lounge Access</div>
          </div>
          <div class="festive-actions">
            <button class="btn btn-customer-login" onclick="renderPublicPage('offers')" style="background:#fbbf24; color:#06101e; font-weight:800;">
              Explore All 5 Festive Deals →
            </button>
            <button class="btn btn-secondary-large" onclick="openInstantAccountModal('festive')" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.5); color:#fff; backdrop-filter:blur(4px);">
              Open Account & Claim
            </button>
          </div>
        </div>

        <div class="festive-visual-col">
          <div class="festive-card-graphic" onclick="openInstantAccountModal('festive')" style="cursor:pointer;" title="Click to claim festive pass">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; letter-spacing:1px; color:#fef08a; font-weight:800;">MAX FESTIVE PASS</span>
              <span style="font-weight:900; color:#fff;">2026</span>
            </div>
            <div>
              <div style="font-size:1.3rem; font-weight:800; color:#fff; text-shadow:0 2px 4px rgba(0,0,0,0.6);">₹50,000 BONUS</div>
              <div style="font-size:0.75rem; color:#fde68a;">Complimentary Privileges Included</div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#cbd5e1;">
              <span>VALID PAN-INDIA</span>
              <span style="color:#fbbf24;">LIMITED TIME</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. COMMERCIAL ADVERTISEMENTS & HIGH-YIELD SHOWCASE (REAL LUXURY IMAGES) -->
    <section class="landing-section">
      <div class="section-header-center">
        <span class="sub-heading">FEATURED BANKING CAMPAIGNS</span>
        <h2>Curated Wealth & Financing Solutions</h2>
        <p>Premium banking engineered with sovereign stability and institutional speed.</p>
      </div>

      <div class="promo-ads-grid">
        <!-- Ad 1: Dream Home Mortgages -->
        <div class="ad-card">
          <div class="ad-card-img" style="background-image:url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80');">
            <span class="ad-badge">FESTIVE 0% PROCESSING</span>
          </div>
          <div class="ad-body">
            <div class="ad-rate-highlight">${homeRate}% <small style="font-size:0.8rem; color:#64748b; font-weight:600;">p.a.</small></div>
            <h3>Residential Dream Home Mortgages</h3>
            <p>Finance your luxury villa or penthouse with digital sanction in 4 hours, up to 30 years flexible tenure, and zero hidden foreclosure fees.</p>
            <button class="btn btn-customer-login w-100" onclick="openLoanApplicationModal('Residential Home Mortgage', '${homeRate}')">Apply for Home Mortgage →</button>
          </div>
        </div>

        <!-- Ad 2: High-Yield Term Deposits -->
        <div class="ad-card">
          <div class="ad-card-img" style="background-image:url('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80');">
            <span class="ad-badge" style="background:#10b981; color:#fff;">DICGC INSURED</span>
          </div>
          <div class="ad-body">
            <div class="ad-rate-highlight" style="color:#059669;">${fdRate}% <small style="font-size:0.8rem; color:#64748b; font-weight:600;">p.a.</small></div>
            <h3>Sovereign Term Fixed Deposits</h3>
            <p>Guaranteed returns with quarterly compounding. Premature liquidity anytime with 0 penalties and senior citizen rates up to 8.35% p.a.</p>
            <button class="btn btn-customer-login w-100" onclick="openDepositBookingModal('regular', '${fdRate}')" style="background:#059669;">Book Fixed Deposit Online →</button>
          </div>
        </div>

        <!-- Ad 3: Max Infinite Visa Metal -->
        <div class="ad-card">
          <div class="ad-card-img" style="background-image:url('https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80');">
            <span class="ad-badge" style="background:#1e40af; color:#fff;">VIP AIRPORT ACCESS</span>
          </div>
          <div class="ad-body">
            <div class="ad-rate-highlight" style="color:#1e40af;">5X <small style="font-size:0.8rem; color:#64748b; font-weight:600;">Reward Points</small></div>
            <h3>Max Infinite Visa Metal Card</h3>
            <p>Crafted in solid dark titanium. Unlimited access to 1,200+ global airport lounges, luxury hotel upgrades, and zero international FX markup.</p>
            <button class="btn btn-customer-login w-100" onclick="openCardApplicationModal('infinite_metal')">Apply for Metal Card →</button>
          </div>
        </div>

        <!-- Ad 4: Digital Wealth Savings Account -->
        <div class="ad-card">
          <div class="ad-card-img" style="background-image:url('https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=800&q=80');">
            <span class="ad-badge" style="background:#f59e0b; color:#06101e;">ZERO MINIMUM BALANCE</span>
          </div>
          <div class="ad-body">
            <div class="ad-rate-highlight" style="color:#d97706;">${savRate}% <small style="font-size:0.8rem; color:#64748b; font-weight:600;">p.a. Daily</small></div>
            <h3>Executive Digital Wealth Account</h3>
            <p>3-minute paperless setup, free unlimited instant IMPS/NEFT/RTGS transfers, and immediate virtual Platinum debit card issuance.</p>
            <button class="btn btn-customer-login w-100" onclick="openInstantAccountModal('savings')">Open Account Online →</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. INSTITUTIONAL CREDIBILITY & STATS BAR -->
    <section class="landing-section" style="background:#f8fafc; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:48px 32px;">
      <div class="hero-container" style="text-align:center; display:block;">
        <span class="sub-heading" style="color:var(--bank-navy);">INSTITUTIONAL INTEGRITY & CAPITAL STRENGTH</span>
        <h2 style="margin:10px 0 24px; color:var(--bank-navy);">Backed by the Reserve Bank of India Framework</h2>
        <div class="hero-highlights" style="grid-template-columns:repeat(4, 1fr); max-width:1100px; margin:0 auto;">
          <div class="hl-box" style="background:#fff;">
            <span class="hl-val">28,40,000+</span>
            <span class="hl-lbl">Verified Active Customers</span>
          </div>
          <div class="hl-box" style="background:#fff;">
            <span class="hl-val">₹4,800+ Cr</span>
            <span class="hl-lbl">Tier-1 Capital Reserves</span>
          </div>
          <div class="hl-box" style="background:#fff;">
            <span class="hl-val">480+</span>
            <span class="hl-lbl">Branches Across India</span>
          </div>
          <div class="hl-box" style="background:#fff;">
            <span class="hl-val">RBI Regulated</span>
            <span class="hl-lbl">License: 042-MGPB</span>
          </div>
        </div>
      </div>
    </section>
  `;

  $('#heroOpenAccountBtn').onclick = () => openInstantAccountModal('savings');
  $('#heroSignInBtn').onclick = () => openPortalModal('customer');
}

// --- Page 2: Personal Banking ---
function renderPagePersonal(c) {
  const s = publicContent.settings || {};
  const savRate = s.savings_rate || '4.25';

  c.innerHTML = `
    <div class="page-hero-banner banner-personal">
      <div class="page-hero-content">
        <span class="sub-heading">RETAIL & SALARY BANKING</span>
        <h1>Digital Savings Accounts Yielding ${savRate}% p.a.</h1>
        <p>Experience hassle-free everyday banking with zero balance requirements, instant virtual Visa debit card issuance, and free unlimited NEFT, RTGS & IMPS transfers.</p>
        <button class="btn btn-customer-login" onclick="openInstantAccountModal('savings')" style="background:#fbbf24; color:#06101e; font-weight:800;">
          Open Digital Account Online (3 Mins) →
        </button>
      </div>
    </div>

    <section class="landing-section">
      <div class="service-cards-grid">
        <div class="service-card">
          <div class="sc-wallpaper wallpaper-personal" style="background-image:url('https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag blue">ZERO CHARGES</span>
            <h3>Zero Minimum Balance Freedom</h3>
            <p>No monthly average balance penalties. Enjoy complete freedom of liquidity without hidden maintenance charges or surprise fees.</p>
            <button class="sc-btn" onclick="openInstantAccountModal('zero_balance')">Open Instant Account →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-savings" style="background-image:url('https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag gold">HIGH YIELD</span>
            <h3>Daily Interest Compounding @ ${savRate}%</h3>
            <p>Earn ${savRate}% p.a. calculated on end-of-day balances and credited directly into your account every quarter with full transparency.</p>
            <button class="sc-btn" onclick="openPortalModal('customer')">Access NetBanking →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-security" style="background-image:url('https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag green">SOVEREIGN COVER</span>
            <h3>DICGC Insurance up to ₹5,00,000</h3>
            <p>All deposits are guaranteed and insured under statutory DICGC laws established by the Reserve Bank of India.</p>
            <button class="sc-btn" onclick="renderPublicPage('security')">Verify RBI Compliance →</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

// --- Page 3: Wealth & Deposits (with Interactive Calculator) ---
function renderPageWealth(c) {
  const s = publicContent.settings || {};
  const fdRate = parseFloat(s.fd_rate || '7.85');

  c.innerHTML = `
    <div class="page-hero-banner banner-wealth">
      <div class="page-hero-content">
        <span class="sub-heading">HIGH-YIELD CAPITAL ACCUMULATION</span>
        <h1>Term Fixed Deposits with ${fdRate}% p.a. Guaranteed Return</h1>
        <p>Maximize your savings with quarterly compounding interest. Fully liquid with instant in-app premature closure or loan against FD.</p>
        <button class="btn btn-customer-login" onclick="openDepositBookingModal('regular', '${fdRate}')" style="background:#10b981; color:#fff; font-weight:800;">
          Book Fixed Deposit Online →
        </button>
      </div>
    </div>

    <section class="landing-section">
      <!-- Interactive FD Calculator -->
      <div class="cust-panel" style="max-width:960px; margin:0 auto 40px; padding:36px; box-shadow:var(--shadow-md);">
        <h3 style="font-size:1.4rem; color:var(--bank-navy); margin-bottom:8px;">Interactive Fixed Deposit Return Calculator</h3>
        <p style="color:#64748b; font-size:0.9rem; margin-bottom:24px;">Calculate your maturity amount with 100% precision with quarterly compounding</p>

        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:36px; align-items:center;">
          <div>
            <div class="auth-field">
              <label>Investment Amount: <strong id="fdCalcAmountDisplay" style="color:var(--bank-emerald)">₹1,00,000</strong></label>
              <input type="range" id="fdAmountRange" min="10000" max="2500000" step="10000" value="100000" style="width:100%;">
            </div>

            <div class="auth-field" style="margin-top:20px;">
              <label>Tenure: <strong id="fdCalcTenureDisplay">12 Months (1 Year)</strong></label>
              <select id="fdTenureSelect" style="padding:10px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
                <option value="12" selected>12 Months (Special Rate ${fdRate}% p.a.)</option>
                <option value="24">24 Months (7.70% p.a.)</option>
                <option value="36">36 Months (7.50% p.a.)</option>
                <option value="60">60 Months (7.25% p.a. Tax Saver)</option>
              </select>
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px; text-align:center;">
            <small style="color:#64748b; font-weight:700;">ESTIMATED MATURITY VALUE</small>
            <div id="fdCalcMaturityResult" style="font-family:var(--font-heading); font-size:2.4rem; font-weight:800; color:#059669; margin:10px 0;">
              ₹1,08,085
            </div>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:14px;">Total Interest Earned: <strong id="fdCalcInterestEarned" style="color:#0f172a">₹8,085</strong></div>
            <button class="btn btn-customer-login w-100" onclick="openDepositBookingModal('regular', '${fdRate}')" style="background:#059669;">
              Invest Now at ${fdRate}% →
            </button>
          </div>
        </div>
      </div>

      <!-- Feature Tiles Grid with Real Images -->
      <div class="service-cards-grid">
        <div class="service-card">
          <div class="sc-wallpaper wallpaper-fd" style="background-image:url('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag green">QUARTERLY COMPOUNDING</span>
            <h3>Regular Term Growth</h3>
            <p>Flexible deposit tenures from 7 days up to 10 years. Automated certificate generation available upon instant booking.</p>
            <button class="sc-btn" onclick="openDepositBookingModal('regular', '${fdRate}')">Book Regular Term FD →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-gold" style="background-image:url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag gold">EXTRA 0.50% BONUS</span>
            <h3>Senior Citizen Privileges</h3>
            <p>Enhanced interest yield of 8.35% p.a. tailored for golden years security with monthly and quarterly payout choices.</p>
            <button class="sc-btn" onclick="openDepositBookingModal('senior', '8.35')">Avail Senior FD (8.35%) →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-wealth" style="background-image:url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag blue">TAX SAVER 80C</span>
            <h3>5-Year Tax Advantage FD</h3>
            <p>Save up to ₹46,800 in tax deductions under Section 80C with locked-in risk-free guaranteed maturity returns.</p>
            <button class="sc-btn" onclick="openDepositBookingModal('tax_saver', '7.25')">Explore Tax Saver 80C →</button>
          </div>
        </div>
      </div>
    </section>
  `;

  // Calculator Logic
  const amountSlider = $('#fdAmountRange');
  const tenureSelect = $('#fdTenureSelect');
  function updateFdCalc() {
    const p = parseFloat(amountSlider.value);
    const m = parseInt(tenureSelect.value);
    let r = fdRate;
    if (m === 24) r = 7.70;
    if (m === 36) r = 7.50;
    if (m === 60) r = 7.25;

    $('#fdCalcAmountDisplay').textContent = money(p);
    $('#fdCalcTenureDisplay').textContent = `${m} Months (${m/12} Year${m>12?'s':''})`;

    const maturity = Math.round(p * Math.pow(1 + (r / 100) / 4, (4 * m) / 12));
    const interest = maturity - p;

    $('#fdCalcMaturityResult').textContent = money(maturity);
    $('#fdCalcInterestEarned').textContent = money(interest);
  }

  amountSlider.oninput = updateFdCalc;
  tenureSelect.onchange = updateFdCalc;
  updateFdCalc();
}

// --- Page 3B: Government Savings & Sovereign Funding (PPF, NPS, SSY, SGB) ---
function renderPageGovtSavings(c) {
  c.innerHTML = `
    <div class="page-hero-banner banner-govtsavings">
      <div class="page-hero-content">
        <span class="sub-heading">SOVEREIGN STATUTORY WEALTH SCHEMES</span>
        <h1>Government of India Savings: PPF, NPS & Sovereign Gold</h1>
        <p>100% capital security backed by the sovereign guarantee of the Government of India. Enjoy maximum tax exemptions under Section 80C and Section 80CCD(1B) with quarterly compounding returns.</p>
        <button class="btn btn-customer-login" onclick="openGovtSchemeModal('PPF')" style="background:#fbbf24; color:#06101e; font-weight:800;">
          Open Sovereign Scheme Account Online →
        </button>
      </div>
    </div>

    <section class="landing-section">
      <!-- Interactive 15-Year PPF & NPS Wealth Growth Calculator -->
      <div class="cust-panel" style="max-width:960px; margin:0 auto 40px; padding:36px; box-shadow:var(--shadow-md);">
        <h3 style="font-size:1.4rem; color:var(--bank-navy); margin-bottom:8px;">Interactive Sovereign PPF & NPS Wealth Calculator</h3>
        <p style="color:#64748b; font-size:0.9rem; margin-bottom:24px;">Simulate your 15-year compounding wealth and total tax deductions under Section 80C and 80CCD(1B)</p>

        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:36px; align-items:center;">
          <div>
            <div class="auth-field">
              <label>Scheme Type:</label>
              <select id="ppfSchemeSelect" style="padding:10px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
                <option value="ppf" selected>Public Provident Fund (PPF @ 7.10% Tax-Free)</option>
                <option value="nps">National Pension System (NPS @ 10.25% Market-Linked)</option>
                <option value="ssy">Sukanya Samriddhi Yojana (SSY @ 8.20% Girl Child)</option>
              </select>
            </div>

            <div class="auth-field" style="margin-top:16px;">
              <label>Monthly Contribution: <strong id="ppfMonthlyDisplay" style="color:var(--bank-emerald)">₹10,000 / month</strong></label>
              <input type="range" id="ppfMonthlyRange" min="500" max="12500" step="500" value="10000" style="width:100%;">
            </div>

            <div class="auth-field" style="margin-top:16px;">
              <label>Investment Horizon: <strong id="ppfYearsDisplay">15 Years (Maturity Period)</strong></label>
              <input type="range" id="ppfYearsRange" min="15" max="30" step="5" value="15" style="width:100%;">
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px; text-align:center;">
            <small style="color:#64748b; font-weight:700;">ESTIMATED MATURITY WEALTH</small>
            <div id="ppfMaturityResult" style="font-family:var(--font-heading); font-size:2.3rem; font-weight:800; color:#059669; margin:10px 0;">
              ₹31,55,720
            </div>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:6px;">Total Invested Capital: <strong id="ppfTotalInvested" style="color:#0f172a">₹18,00,000</strong></div>
            <div style="font-size:0.85rem; color:#059669; font-weight:700; margin-bottom:14px;">Total Tax-Free Interest: <span id="ppfTotalInterest">₹13,55,720</span></div>
            <button class="btn btn-customer-login w-100" id="ppfInvestCtaBtn" onclick="openGovtSchemeModal('PPF')" style="background:#059669;">
              Open PPF Account Online →
            </button>
          </div>
        </div>
      </div>

      <!-- Feature Tiles Grid -->
      <div class="service-cards-grid">
        <div class="service-card">
          <div class="sc-wallpaper wallpaper-ppf" style="background-image:url('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag green">EEE TAX EXEMPTION</span>
            <h3>Public Provident Fund (PPF)</h3>
            <p>Government guaranteed 7.10% p.a. returns. 100% tax-free at investment, accumulation, and maturity with loan against PPF available from Year 3.</p>
            <button class="sc-btn" onclick="openGovtSchemeModal('PPF')">Open PPF Account →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-wealth" style="background-image:url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag blue">RETIREMENT CORPUS</span>
            <h3>National Pension System (NPS)</h3>
            <p>Tier-1 & Tier-2 retirement funding with flexible Equity/Debt asset allocation and exclusive extra ₹50,000 tax deduction under Section 80CCD(1B).</p>
            <button class="sc-btn" onclick="openGovtSchemeModal('NPS')">Register for NPS →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-gold" style="background-image:url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag gold">8.20% HIGHEST YIELD</span>
            <h3>Sukanya Samriddhi (SSY)</h3>
            <p>Special welfare scheme for girl children offering India's highest sovereign rate of 8.20% p.a. with full Section 80C tax relief.</p>
            <button class="sc-btn" onclick="openGovtSchemeModal('Sukanya Samriddhi')">Open SSY Account →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-personal" style="background-image:url('https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag green">2.50% FIXED + GOLD UPSIDE</span>
            <h3>Sovereign Gold Bonds (SGB)</h3>
            <p>Earn 2.50% annual coupon interest paid semi-annually plus 100% upside of market gold appreciation with zero capital gains tax at redemption.</p>
            <button class="sc-btn" onclick="openGovtSchemeModal('Sovereign Gold Bond')">Subscribe to Gold Bonds →</button>
          </div>
        </div>
      </div>
    </section>
  `;

  // Calculator Logic
  const schemeSel = $('#ppfSchemeSelect');
  const monthSlider = $('#ppfMonthlyRange');
  const yearsSlider = $('#ppfYearsRange');

  function updatePpfCalc() {
    const sType = schemeSel.value;
    const m = parseFloat(monthSlider.value);
    const yrs = parseInt(yearsSlider.value);
    let r = 7.10;
    if (sType === 'nps') r = 10.25;
    if (sType === 'ssy') r = 8.20;

    $('#ppfMonthlyDisplay').textContent = money(m) + ' / month';
    $('#ppfYearsDisplay').textContent = `${yrs} Years`;

    const annualContribution = m * 12;
    const totalInvested = annualContribution * yrs;
    const annualRate = r / 100;
    // Compounded future value of annuity
    const maturity = Math.round(annualContribution * ((Math.pow(1 + annualRate, yrs) - 1) / annualRate) * (1 + annualRate));
    const totalInterest = maturity - totalInvested;

    $('#ppfMaturityResult').textContent = money(maturity);
    $('#ppfTotalInvested').textContent = money(totalInvested);
    $('#ppfTotalInterest').textContent = money(totalInterest);

    const cta = $('#ppfInvestCtaBtn');
    if (sType === 'ppf') cta.textContent = 'Open PPF Account Online →';
    else if (sType === 'nps') cta.textContent = 'Register for NPS Online →';
    else cta.textContent = 'Open Sukanya Account Online →';
  }

  schemeSel.onchange = updatePpfCalc;
  monthSlider.oninput = updatePpfCalc;
  yearsSlider.oninput = updatePpfCalc;
  updatePpfCalc();
}

// --- Page 3C: Trading & Demat Securities (3-in-1 Account) ---
function renderPageTrading(c) {
  c.innerHTML = `
    <div class="page-hero-banner banner-trading">
      <div class="page-hero-content">
        <span class="sub-heading">MAX GLOBAL SECURITIES • 3-IN-1 ACCOUNT</span>
        <h1>Flat ₹0 Equity Delivery & ₹20 Intraday Brokerage</h1>
        <p>Seamlessly integrate your Savings, Demat, and High-Speed Trading accounts with direct CDSL/NSDL depository access, real-time Level-3 market depth, and algorithmic order execution.</p>
        <button class="btn btn-customer-login" onclick="openDematApplicationModal('All Segments')" style="background:#10b981; color:#fff; font-weight:800;">
          Open 3-in-1 Demat Account (Zero Fees) →
        </button>
      </div>
    </div>

    <section class="landing-section">
      <!-- Brokerage Savings Calculator -->
      <div class="cust-panel" style="max-width:960px; margin:0 auto 40px; padding:36px; box-shadow:var(--shadow-md);">
        <h3 style="font-size:1.4rem; color:var(--bank-navy); margin-bottom:8px;">Live Brokerage Savings Calculator</h3>
        <p style="color:#64748b; font-size:0.9rem; margin-bottom:24px;">See how much you save every year with Max Global Securities Flat ₹0 / ₹20 pricing</p>

        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:36px; align-items:center;">
          <div>
            <div class="auth-field">
              <label>Monthly Delivery Trades: <strong id="trdDeliveryDisplay" style="color:var(--bank-blue)">20 Trades</strong></label>
              <input type="range" id="trdDeliveryRange" min="5" max="100" step="5" value="20" style="width:100%;">
            </div>

            <div class="auth-field" style="margin-top:16px;">
              <label>Monthly Intraday & F&O Orders: <strong id="trdIntradayDisplay" style="color:var(--bank-emerald)">40 Orders</strong></label>
              <input type="range" id="trdIntradayRange" min="0" max="200" step="10" value="40" style="width:100%;">
            </div>

            <div class="auth-field" style="margin-top:16px;">
              <label>Average Order Value: <strong id="trdOrderValDisplay">₹50,000</strong></label>
              <input type="range" id="trdOrderValRange" min="10000" max="200000" step="10000" value="50000" style="width:100%;">
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px; text-align:center;">
            <small style="color:#64748b; font-weight:700;">ESTIMATED ANNUAL BROKERAGE SAVINGS</small>
            <div id="trdSavingsResult" style="font-family:var(--font-heading); font-size:2.3rem; font-weight:800; color:#059669; margin:10px 0;">
              ₹54,400
            </div>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:6px;">Traditional Broker Fee: <strong id="trdTradFee" style="color:#dc2626">₹64,000 / yr</strong></div>
            <div style="font-size:0.85rem; color:#059669; font-weight:700; margin-bottom:14px;">Max Global Fee: <span id="trdMgFee">₹9,600 / yr</span></div>
            <button class="btn btn-customer-login w-100" onclick="openDematApplicationModal('All Segments')" style="background:#059669;">
              Claim 100% Free Account Now →
            </button>
          </div>
        </div>
      </div>

      <!-- Feature Tiles Grid -->
      <div class="service-cards-grid">
        <div class="service-card">
          <div class="sc-wallpaper wallpaper-trading" style="background-image:url('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag green">ZERO COMMISSION</span>
            <h3>Flat ₹0 Equity Delivery</h3>
            <p>Buy and hold shares of India's leading NSE & BSE enterprises with absolute ₹0 brokerage commission for life.</p>
            <button class="sc-btn" onclick="openDematApplicationModal('Equity Delivery')">Trade Equity for Free →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-business" style="background-image:url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag blue">FLAT ₹20 HIGH SPEED</span>
            <h3>Intraday & F&O Terminal</h3>
            <p>Lightning-fast execution engine equipped with Level-3 depth, TradingView charts, and flat ₹20 per executed derivative contract.</p>
            <button class="sc-btn" onclick="openDematApplicationModal('Derivatives F&O')">Explore F&O Terminal →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-gold" style="background-image:url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag gold">2,500+ DIRECT FUNDS</span>
            <h3>Direct Mutual Funds & IPOs</h3>
            <p>Invest in zero-commission direct mutual funds with automated daily or monthly SIPs and 1-click ASBA UPI IPO applications.</p>
            <button class="sc-btn" onclick="openDematApplicationModal('Mutual Funds & IPOs')">Start 0% Commission SIP →</button>
          </div>
        </div>
      </div>
    </section>
  `;

  // Calculator Logic
  const delSlider = $('#trdDeliveryRange');
  const intraSlider = $('#trdIntradayRange');
  const valSlider = $('#trdOrderValRange');

  function updateTrdCalc() {
    const delTrades = parseInt(delSlider.value);
    const intraOrders = parseInt(intraSlider.value);
    const orderVal = parseFloat(valSlider.value);

    $('#trdDeliveryDisplay').textContent = `${delTrades} Trades / mo`;
    $('#trdIntradayDisplay').textContent = `${intraOrders} Orders / mo`;
    $('#trdOrderValDisplay').textContent = money(orderVal);

    // Traditional broker: 0.30% on delivery, 0.03% on intraday
    const tradDeliveryCost = (delTrades * orderVal * 0.003) * 12;
    const tradIntraCost = (intraOrders * orderVal * 0.0003) * 12;
    const tradTotal = Math.round(tradDeliveryCost + tradIntraCost);

    // Max Global: ₹0 on delivery, ₹20 on intraday
    const mgDeliveryCost = 0;
    const mgIntraCost = (intraOrders * 20) * 12;
    const mgTotal = Math.round(mgDeliveryCost + mgIntraCost);

    const savings = Math.max(0, tradTotal - mgTotal);

    $('#trdSavingsResult').textContent = money(savings);
    $('#trdTradFee').textContent = money(tradTotal) + ' / yr';
    $('#trdMgFee').textContent = money(mgTotal) + ' / yr';
  }

  delSlider.oninput = updateTrdCalc;
  intraSlider.oninput = updateTrdCalc;
  valSlider.oninput = updateTrdCalc;
  updateTrdCalc();
}

// --- Page 4: Loans & Mortgages (with Live EMI Calculator) ---
function renderPageLoans(c) {
  const s = publicContent.settings || {};
  const homeRate = parseFloat(s.home_loan_rate || '8.40');
  const personalRate = parseFloat(s.personal_loan_rate || '10.50');
  const carRate = parseFloat(s.car_loan_rate || '8.75');

  c.innerHTML = `
    <div class="page-hero-banner banner-loans">
      <div class="page-hero-content">
        <span class="sub-heading">PRE-APPROVED CREDIT FACILITIES</span>
        <h1>Home, Personal & Auto Loans from ${homeRate}% p.a.</h1>
        <p>Realize your dream home or finance personal growth with zero hidden charges, transparent digital processing, and immediate disbursal.</p>
        <button class="btn btn-customer-login" onclick="openLoanApplicationModal('Residential Home Mortgage', '${homeRate}')" style="background:#fbbf24; color:#06101e; font-weight:800;">
          Apply for Pre-Approved Credit →
        </button>
      </div>
    </div>

    <section class="landing-section">
      <!-- Live Interactive Loan EMI Calculator -->
      <div class="cust-panel" style="max-width:960px; margin:0 auto 40px; padding:36px; box-shadow:var(--shadow-md);">
        <h3 style="font-size:1.4rem; color:var(--bank-navy); margin-bottom:8px;">Live Interactive Loan EMI Calculator</h3>
        <p style="color:#64748b; font-size:0.9rem; margin-bottom:24px;">Adjust the sliders to view your exact monthly installment (EMI) with zero processing fees</p>

        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:36px; align-items:center;">
          <div>
            <div class="auth-field">
              <label>Select Loan Type</label>
              <select id="emiLoanTypeSelect" style="padding:10px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
                <option value="${homeRate}" selected>Residential Home Loan (${homeRate}% p.a.)</option>
                <option value="${personalRate}">Personal Growth Loan (${personalRate}% p.a.)</option>
                <option value="${carRate}">Automobile Vehicle Loan (${carRate}% p.a.)</option>
              </select>
            </div>

            <div class="auth-field" style="margin-top:20px;">
              <label>Loan Principal Amount: <strong id="emiAmountDisplay" style="color:var(--bank-navy)">₹25,00,000</strong></label>
              <input type="range" id="emiAmountRange" min="50000" max="10000000" step="50000" value="2500000" style="width:100%;">
            </div>

            <div class="auth-field" style="margin-top:20px;">
              <label>Tenure: <strong id="emiTenureDisplay" style="color:var(--bank-navy)">20 Years (240 Months)</strong></label>
              <input type="range" id="emiTenureRange" min="1" max="30" step="1" value="20" style="width:100%;">
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px; text-align:center;">
            <small style="color:#64748b; font-weight:700;">ESTIMATED MONTHLY INSTALLMENT (EMI)</small>
            <div id="emiMonthlyResult" style="font-family:var(--font-heading); font-size:2.4rem; font-weight:800; color:#b45309; margin:10px 0;">
              ₹21,538
            </div>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:6px;">Total Interest: <strong id="emiTotalInterest" style="color:#0f172a">₹26,69,120</strong></div>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:14px;">Total Repayment: <strong id="emiTotalRepayment" style="color:#0f172a">₹51,69,120</strong></div>
            <button class="btn btn-customer-login w-100" onclick="openLoanApplicationModal('Selected Loan', '8.40')" style="background:#b45309;">
              Get Instant Approval Online →
            </button>
          </div>
        </div>
      </div>

      <!-- Feature Tiles Grid with Real Images -->
      <div class="service-cards-grid">
        <div class="service-card">
          <div class="sc-wallpaper wallpaper-loan" style="background-image:url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag gold">HOME MORTGAGE</span>
            <h3>Luxury Villa & Home Loans</h3>
            <p>Turn your dream property into reality with interest rates starting at ${homeRate}% p.a., 0% processing fee, and minimal paperwork.</p>
            <button class="sc-btn" onclick="openLoanApplicationModal('Residential Home Mortgage', '${homeRate}')">Apply for Home Mortgage →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-personal" style="background-image:url('https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag blue">INSTANT CREDIT</span>
            <h3>Personal Growth Lines</h3>
            <p>Pre-approved liquidity up to ₹25,00,000 credited directly into your account in under 60 seconds with 1-click in-app sanction.</p>
            <button class="sc-btn" onclick="openLoanApplicationModal('Personal Growth Line', '${personalRate}')">Get Instant Personal Loan →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-business" style="background-image:url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag green">BUSINESS CAPITAL</span>
            <h3>Corporate & SME Financing</h3>
            <p>Working capital lines and commercial asset financing to power business growth and cross-border trade transactions.</p>
            <button class="sc-btn" onclick="openLoanApplicationModal('Corporate & SME Credit', '9.25')">Apply for SME Line →</button>
          </div>
        </div>
      </div>
    </section>
  `;

  // EMI Calculator logic
  const typeSelect = $('#emiLoanTypeSelect');
  const amountRange = $('#emiAmountRange');
  const tenureRange = $('#emiTenureRange');

  function updateEmiCalc() {
    const rate = parseFloat(typeSelect.value);
    const p = parseFloat(amountRange.value);
    const years = parseInt(tenureRange.value);
    const months = years * 12;

    $('#emiAmountDisplay').textContent = money(p);
    $('#emiTenureDisplay').textContent = `${years} Year${years>1?'s':''} (${months} Months)`;

    const monthlyRate = (rate / 12) / 100;
    const emi = Math.round((p * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
    const totalPayment = emi * months;
    const totalInterest = totalPayment - p;

    $('#emiMonthlyResult').textContent = money(emi) + '/mo';
    $('#emiTotalInterest').textContent = money(totalInterest);
    $('#emiTotalRepayment').textContent = money(totalPayment);
  }

  typeSelect.onchange = updateEmiCalc;
  amountRange.oninput = updateEmiCalc;
  tenureRange.oninput = updateEmiCalc;
  updateEmiCalc();
}

// --- Page 5: Cards & Privileges ---
function renderPageCards(c) {
  c.innerHTML = `
    <div class="page-hero-banner banner-cards">
      <div class="page-hero-content">
        <span class="sub-heading">PREMIUM PAYMENT CHIPS</span>
        <h1>Max Infinite Metal Visa & Platinum Cards</h1>
        <p>Curated for discerning global travelers and lifestyle enthusiasts. Enjoy zero foreign exchange markup on international transactions and 24x7 personal concierge service.</p>
        <button class="btn btn-customer-login" onclick="openCardApplicationModal('infinite_metal')" style="background:#fbbf24; color:#06101e; font-weight:800;">
          Apply for Card Privileges →
        </button>
      </div>
    </div>

    <section class="landing-section">
      <div class="service-cards-grid">
        <div class="service-card">
          <div class="sc-wallpaper wallpaper-card" style="background-image:url('https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag blue">TITANIUM CRAFTSMANSHIP</span>
            <h3>Max Infinite Visa Metal</h3>
            <p>Solid metal card with 5X reward points on dining and luxury shopping, zero FX markup, and comprehensive ₹10 Lakhs cyber fraud cover.</p>
            <button class="sc-btn" onclick="showMetalCardSpecsModal()">View Metal Privileges →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-lounge" style="background-image:url('https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag gold">VIP HOSPITALITY</span>
            <h3>1,200+ Global Airport Lounges</h3>
            <p>Complimentary Priority Pass membership providing unlimited access to premier departure lounges across domestic and international terminals.</p>
            <button class="sc-btn" onclick="showLoungeNetworkModal()">Browse Lounge Network →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-personal" style="background-image:url('https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=800&q=80');"></div>
          <div class="sc-content">
            <span class="sc-tag green">INSTANT CYBER LOCK</span>
            <h3>1-Tap Security Controls</h3>
            <p>Instantly freeze your card, toggle contactless tap-to-pay, or reset domestic and international transaction limits from your NetBanking dashboard.</p>
            <button class="sc-btn" onclick="proceedToCardManagement()">Manage Your Card →</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

// --- Page 6: Offers & Festive Privileges (Dynamically loaded from DB) ---
function renderPageOffers(c) {
  const offers = publicContent.offers || [];

  c.innerHTML = `
    <div class="page-hero-banner banner-offers">
      <div class="page-hero-content">
        <span class="sub-heading">PRIVILEGES & FESTIVE REWARDS</span>
        <h1>Exclusive Festive Offers & Client Privileges</h1>
        <p>Celebrating over 2.8 million customer relationships nationwide with curated benefits across shopping, travel, dining, and investments.</p>
      </div>
    </div>

    <section class="landing-section">
      <div class="service-cards-grid">
        ${offers.length ? offers.map(o => {
          const code = o.promo_code || o.offer_code || ('OFFER' + o.id);
          const title = o.title || 'Privilege Offer';
          const badge = o.discount_badge || o.badge || 'EXCLUSIVE OFFER';
          const desc = o.description || 'Special benefit available for Max Global account holders.';
          const headline = o.rate_headline || o.discount_badge || 'Exclusive Benefit';
          return `
          <div class="service-card" style="justify-content:space-between;">
            <div class="sc-wallpaper wallpaper-festive"></div>
            <div class="sc-content" style="flex:1; justify-content:space-between;">
              <div>
                <span class="sc-tag gold">${escapeHtml(badge)}</span>
                <h3 style="margin:10px 0 6px;">${escapeHtml(title)}</h3>
                <div style="font-size:1.15rem; font-weight:800; color:var(--bank-blue); margin-bottom:8px;">${escapeHtml(headline)}</div>
                <p style="font-size:0.88rem; color:#64748b; margin-bottom:16px;">${escapeHtml(desc)}</p>
              </div>
              <div style="border-top:1px solid #e2e8f0; padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <small style="color:#94a3b8; display:block; font-size:0.7rem;">OFFER CODE</small>
                  <code style="font-weight:700; color:var(--bank-navy); font-size:0.85rem;">${escapeHtml(code)}</code>
                </div>
                <button class="btn btn-customer-login" onclick="claimOfferById(${o.id})">Claim Deal →</button>
              </div>
            </div>
          </div>
        `;
        }).join('') : '<div style="grid-column:1/-1; text-align:center; padding:40px;">No promotional offers currently listed.</div>'}
      </div>
    </section>
  `;
}

// --- Page 7: Security & RBI Compliance ---
function renderPageSecurity(c) {
  const s = publicContent.settings || {};
  const license = s.rbi_license || 'RBI/2026/MGPB-8842';
  const insured = s.dicgc_insured || '₹5,00,000 per depositor';

  c.innerHTML = `
    <div class="page-hero-banner banner-security">
      <div class="page-hero-content">
        <span class="sub-heading">STATUTORY REGULATORY INTEGRITY</span>
        <h1>Regulated by the Reserve Bank of India</h1>
        <p>Operating as a full-fledged Scheduled Commercial Bank in strict adherence to RBI guidelines, Banking Regulation Act 1949, and ISO 27001 data protection standards.</p>
      </div>
    </div>

    <section class="landing-section">
      <div class="service-cards-grid" style="margin-bottom:36px;">
        <div class="service-card">
          <div class="sc-wallpaper wallpaper-security"></div>
          <div class="sc-content">
            <span class="sc-tag green">RBI CHARTER</span>
            <h3>Scheduled Commercial Bank</h3>
            <p>Operating under Section 22 of the Banking Regulation Act, 1949.<br><strong>License Identifier:</strong> <code>${license}</code></p>
            <button class="sc-btn" onclick="showRbiCharterModal()">View Official RBI Charter →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-gold"></div>
          <div class="sc-content">
            <span class="sc-tag gold">DICGC GUARANTEED</span>
            <h3>₹5,00,000 Deposit Insurance</h3>
            <p>Every depositor is unconditionally insured up to ${insured} by the Deposit Insurance and Credit Guarantee Corporation.</p>
            <button class="sc-btn" onclick="showDicgcModal()">Verify Deposit Protection →</button>
          </div>
        </div>

        <div class="service-card">
          <div class="sc-wallpaper wallpaper-business"></div>
          <div class="sc-content">
            <span class="sc-tag blue">MILITARY ENCRYPTION</span>
            <h3>256-Bit Quantum TLS & ISO 27001</h3>
            <p>End-to-end atomic database verification and biometric security ensuring your funds and identity remain completely secure.</p>
            <button class="sc-btn" onclick="showSecuritySpecsModal()">Inspect 256-Bit Architecture →</button>
          </div>
        </div>
      </div>

      <div class="cust-panel" style="padding:32px; box-shadow:var(--shadow-md);">
        <h3 style="color:var(--bank-navy); margin-bottom:12px;">Customer Grievance Redressal & Citizen Charter</h3>
        <p style="font-size:0.9rem; color:#64748b; line-height:1.6; margin-bottom:16px;">
          In accordance with the Banking Ombudsman Scheme, we maintain a dedicated 24x7 Ombudsman cell and Senior Citizen assistance desk.
        </p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px;">
          <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer;" onclick="showFraudHotlineModal()" title="Click to open emergency hotline dialog">
            <small style="color:#94a3b8; font-weight:700;">24X7 FRAUD HELPLINE</small>
            <div style="font-weight:700; color:var(--bank-navy); margin-top:4px;">1800-420-9900 (Toll Free) 🚨</div>
            <span style="font-size:0.8rem; color:#dc2626; font-weight:600; display:inline-block; margin-top:6px;">Tap to open hotline dialog →</span>
          </div>
          <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer;" onclick="showNodalOfficerModal()" title="Click to view Grievance Redressal Directory">
            <small style="color:#94a3b8; font-weight:700;">PRINCIPAL NODAL OFFICER</small>
            <div style="font-weight:700; color:var(--bank-navy); margin-top:4px;">nodalofficer@maxglobalbank.com</div>
            <span style="font-size:0.8rem; color:var(--bank-blue); font-weight:600; display:inline-block; margin-top:6px;">Tap to view redressal matrix →</span>
          </div>
          <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer;" onclick="showSecuritySpecsModal()" title="Click to inspect 256-Bit TLS Security">
            <small style="color:#94a3b8; font-weight:700;">CYBERSECURITY PROTOCOL</small>
            <div style="font-weight:700; color:#10b981; margin-top:4px;">256-Bit Quantum TLS 1.3 Active</div>
            <span style="font-size:0.8rem; color:#059669; font-weight:600; display:inline-block; margin-top:6px;">Tap to inspect encryption specs →</span>
          </div>
        </div>
      </div>
    </section>
      </div>
    </section>
  `;
}

// ========================================================
// 4. INTERACTIVE FEATURE MODALS & SPECIFICATION DIALOGS
// ========================================================
function openFeatureModal(htmlContent) {
  playTone('click');
  $('#featureModalContent').innerHTML = htmlContent;
  $('#featureModalBackdrop').classList.remove('hidden');
}

function closeFeatureModal() {
  $('#featureModalBackdrop').classList.add('hidden');
}

function showMetalCardSpecsModal() {
  openFeatureModal(`
    <div style="text-align:left;">
      <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#fbbf24; background:rgba(251,191,36,0.15); padding:4px 10px; border-radius:12px; border:1px solid rgba(251,191,36,0.3);">VISA INFINITE EXCLUSIVE</span>
      <h2 style="font-size:1.6rem; color:var(--bank-navy); margin:8px 0 4px;">Max Infinite Metal Card Specifications</h2>
      <p style="color:#64748b; font-size:0.88rem; margin-bottom:18px;">Handcrafted precision engineering for high-net-worth individuals</p>

      <div style="background:linear-gradient(135deg, #06101e 0%, #172554 100%); border-radius:12px; padding:20px; color:#fff; margin-bottom:20px; border:1px solid rgba(212,175,55,0.4);">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:0.85rem;">
          <div><strong style="color:#fbbf24;">Material:</strong> 16g Brushed Dark Titanium</div>
          <div><strong style="color:#fbbf24;">Card Network:</strong> Visa Infinite Global</div>
          <div><strong style="color:#fbbf24;">Forex Markup:</strong> 0.00% (Zero FX Markup)</div>
          <div><strong style="color:#fbbf24;">Daily POS Limit:</strong> ₹10,00,000 / day</div>
          <div><strong style="color:#fbbf24;">Airport Lounges:</strong> 1,200+ Free Global Visits</div>
          <div><strong style="color:#fbbf24;">Concierge:</strong> 24x7 Dedicated Relationship Exec</div>
        </div>
      </div>

      <div style="margin-bottom:22px;">
        <h4 style="font-size:0.95rem; color:var(--bank-navy); margin-bottom:10px;">Complimentary Privileges & Welcome Perks:</h4>
        <ul style="color:#475569; font-size:0.88rem; line-height:1.6; padding-left:20px;">
          <li>Annual Taj Epicure Preferred Membership with ₹10,000 dining credits.</li>
          <li>Comprehensive ₹10,00,000 air accident & cyber fraud protection coverage.</li>
          <li>1-Click instant biometric card lock & contactless limit controls via NetBanking.</li>
        </ul>
      </div>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-customer-login w-100" onclick="openCardApplicationModal('infinite_metal');" style="background:#fbbf24; color:#06101e; font-weight:800;">
          Apply for Titanium Card Now →
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);
}

const GLOBAL_LOUNGES = [
  { city: 'Mumbai (BOM)', airport: 'Chhatrapati Shivaji Maharaj Intl Airport', lounge: 'Adani Lounge & Travel Club', terminal: 'Terminal 2 (Domestic & Intl)' },
  { city: 'Delhi (DEL)', airport: 'Indira Gandhi International Airport', lounge: 'Encalm Privé & Plaza Premium', terminal: 'Terminal 3 (International)' },
  { city: 'Bengaluru (BLR)', airport: 'Kempegowda International Airport', lounge: '080 Transit & Domestic Lounge', terminal: 'Terminal 1 & Terminal 2' },
  { city: 'Dubai (DXB)', airport: 'Dubai International Airport', lounge: 'Marhaba Lounge & Ahlan First Class', terminal: 'Concourse A, B & D' },
  { city: 'London (LHR)', airport: 'London Heathrow Airport', lounge: 'Plaza Premium Lounge & Club Aspire', terminal: 'Terminal 2, 4 & 5' },
  { city: 'Singapore (SIN)', airport: 'Singapore Changi Airport', lounge: 'Ambassador Transit & SATS Lounge', terminal: 'Terminal 1, 2 & 3' },
  { city: 'Frankfurt (FRA)', airport: 'Frankfurt Airport', lounge: 'Primeclass & Luxx Lounge', terminal: 'Terminal 1 & 2' },
  { city: 'New York (JFK)', airport: 'John F. Kennedy Intl Airport', lounge: 'Wingtips & Primeclass Lounge', terminal: 'Terminal 1 & 4' }
];

function showLoungeNetworkModal() {
  function renderLoungeRows(query = '') {
    const q = query.toLowerCase().trim();
    const filtered = GLOBAL_LOUNGES.filter(l => l.city.toLowerCase().includes(q) || l.airport.toLowerCase().includes(q) || l.lounge.toLowerCase().includes(q));
    if (!filtered.length) {
      return '<div style="text-align:center; padding:20px; color:#94a3b8;">No matching lounges found. All Priority Pass hubs are covered.</div>';
    }
    return filtered.map(l => `
      <div style="padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="color:var(--bank-navy); font-size:0.92rem;">${l.city}</strong>
          <div style="font-size:0.8rem; color:#64748b;">${l.airport} • ${l.terminal}</div>
          <div style="font-size:0.82rem; color:#059669; font-weight:600; margin-top:2px;">✨ ${l.lounge}</div>
        </div>
        <span style="font-size:0.75rem; background:#eff6ff; color:#1e40af; padding:3px 8px; border-radius:12px; font-weight:700; flex-shrink:0;">UNLIMITED ACCESS</span>
      </div>
    `).join('');
  }

  openFeatureModal(`
    <div style="text-align:left;">
      <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#1e40af; background:#eff6ff; padding:4px 10px; border-radius:12px;">PRIORITY PASS NETWORK</span>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:8px 0 4px;">1,200+ Global Airport Lounges Directory</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">Complimentary access with your Max Infinite Visa Metal Card</p>

      <div style="margin-bottom:16px;">
        <input type="text" id="loungeSearchInput" placeholder="Search city or airport (e.g. Mumbai, Dubai, London)..." style="width:100%; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.9rem;">
      </div>

      <div id="loungeResultsContainer" style="max-height:280px; overflow-y:auto; padding-right:4px;">
        ${renderLoungeRows()}
      </div>

      <div style="margin-top:20px; display:flex; gap:12px; align-items:center;">
        <button class="btn btn-customer-login w-100" onclick="closeFeatureModal(); openPortalModal('customer');">
          Activate Your Digital Lounge Pass →
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);

  $('#loungeSearchInput').oninput = e => {
    $('#loungeResultsContainer').innerHTML = renderLoungeRows(e.target.value);
  };
}

function showOfferClaimModal(code, title, badge, desc, rate) {
  openFeatureModal(`
    <div style="text-align:left;">
      <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#b45309; background:#fef3c7; padding:4px 10px; border-radius:12px;">${escapeHtml(badge || 'EXCLUSIVE PRIVILEGE')}</span>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:8px 0 4px;">${escapeHtml(title)}</h2>
      <div style="font-size:1.15rem; font-weight:800; color:#1e40af; margin-bottom:10px;">${escapeHtml(rate || 'Special Benefit')}</div>
      <p style="color:#64748b; font-size:0.88rem; line-height:1.6; margin-bottom:20px;">${escapeHtml(desc)}</p>

      <div style="background:#f1f5f9; border:2px dashed #cbd5e1; border-radius:10px; padding:18px; text-align:center; margin-bottom:20px;">
        <small style="color:#64748b; font-weight:700; display:block; margin-bottom:4px;">YOUR DIGITAL PROMO VOUCHER CODE</small>
        <div id="promoCodeVal" style="font-family:monospace; font-size:1.6rem; font-weight:800; color:var(--bank-navy); letter-spacing:2px; margin-bottom:10px;">
          ${escapeHtml(code)}
        </div>
        <button class="btn btn-sm btn-customer-login" id="copyPromoBtn" style="padding:6px 16px;">
          📋 Copy Voucher Code
        </button>
      </div>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-customer-login w-100" onclick="closeFeatureModal(); openPortalModal('customer');">
          Apply in NetBanking Dashboard →
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);

  $('#copyPromoBtn').onclick = () => {
    navigator.clipboard.writeText(code).then(() => {
      $('#copyPromoBtn').textContent = '✅ Copied to Clipboard!';
      playTone('success');
      setTimeout(() => $('#copyPromoBtn').textContent = '📋 Copy Voucher Code', 2000);
    }).catch(() => {
      notify('Code: ' + code, 'info');
    });
  };
}

function showFraudHotlineModal() {
  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
        <span style="font-size:1.6rem;">🚨</span>
        <div>
          <h2 style="font-size:1.5rem; color:#dc2626; margin:0;">24x7 Security & Fraud Emergency Desk</h2>
          <small style="color:#64748b;">Instant Card Hotlisting & Transaction Disputing</small>
        </div>
      </div>

      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:16px; margin-bottom:20px;">
        <strong style="color:#991b1b; display:block; margin-bottom:6px;">Suspect Unauthorized Activity on your Account or Card?</strong>
        <p style="color:#7f1d1d; font-size:0.85rem; line-height:1.5; margin:0;">
          Our automated fraud engine monitors unusual velocity 24 hours a day. Call our emergency response desk or lock your card immediately.
        </p>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:22px; font-size:0.88rem;">
        <div style="background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
          <small style="color:#94a3b8; font-weight:700;">NATIONAL TOLL-FREE</small>
          <div style="font-size:1.1rem; font-weight:800; color:var(--bank-navy); margin-top:2px;">1800-420-9900</div>
          <div style="font-size:0.75rem; color:#10b981; font-weight:600;">Active 24 Hours / 365 Days</div>
        </div>
        <div style="background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
          <small style="color:#94a3b8; font-weight:700;">INTERNATIONAL HOTLINE</small>
          <div style="font-size:1.1rem; font-weight:800; color:var(--bank-navy); margin-top:2px;">+91 22 6900 8800</div>
          <div style="font-size:0.75rem; color:#64748b;">For overseas travelers</div>
        </div>
        <div style="background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
          <small style="color:#94a3b8; font-weight:700;">FRAUD CYBER CELL</small>
          <div style="font-size:0.92rem; font-weight:700; color:var(--bank-navy); margin-top:2px;">fraud-alert@maxglobalbank.com</div>
        </div>
        <div style="background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
          <small style="color:#94a3b8; font-weight:700;">RBI OMBUDSMAN CELL</small>
          <div style="font-size:0.92rem; font-weight:700; color:var(--bank-navy); margin-top:2px;">ombudsman@rbi.org.in</div>
        </div>
      </div>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-customer-login w-100" onclick="closeFeatureModal(); openPortalModal('customer');" style="background:#dc2626; color:#fff;">
          Sign In to Freeze Card Instantly →
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);
}

function claimOfferById(id) {
  playTone('click');
  const offers = publicContent.offers || [];
  const o = offers.find(x => x.id === id) || offers[0] || {};
  const code = o.promo_code || o.offer_code || 'FESTIVEMAX';
  const title = o.title || 'Exclusive Festive Offer';
  const badge = o.discount_badge || o.badge || 'EXCLUSIVE PRIVILEGE';
  const desc = o.description || 'Special benefit available across all Max Global banking channels.';
  const rate = o.rate_headline || o.discount_badge || 'Special Rate';
  showOfferClaimModal(code, title, badge, desc, rate);
}

function openInstantAccountModal(accountType = 'savings') {
  playTone('click');
  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 10px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">INSTANT DIGITAL ONBOARDING</span>
        <span style="font-size:0.75rem; font-weight:700; color:#64748b;">STEP 1 OF 2</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 6px;">Open Digital Savings Account</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:18px;">Zero minimum balance freedom, instant virtual Visa debit card, and 4.25% daily interest yield.</p>

      <form id="instantAccForm" onsubmit="handleInstantAccountSubmit(event)">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Full Legal Name (as per Aadhaar)</label>
            <input name="fullName" required placeholder="e.g. Rahul Sharma" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Mobile Number</label>
            <input name="phone" required placeholder="+91 98765 43210" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Email Address</label>
            <input name="email" type="email" required placeholder="name@domain.com" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">PAN Card Number</label>
            <input name="pan" required placeholder="ABCDE1234F" maxlength="10" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%; text-transform:uppercase;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Preferred Home Branch</label>
            <select name="branch" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
              <option value="Mumbai BKC">Mumbai BKC Financial Center</option>
              <option value="Delhi Connaught Place">Delhi Connaught Place Hub</option>
              <option value="Bengaluru MG Road">Bengaluru MG Road Center</option>
              <option value="Hyderabad Hitech City">Hyderabad Hitech Financial Hub</option>
            </select>
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Debit Card Type</label>
            <select name="cardChoice" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
              <option value="Infinite Metal">Max Infinite Visa Metal (Titanium)</option>
              <option value="Platinum EMV">Max Platinum Chip Card</option>
              <option value="Virtual Only">Virtual Instant Card Only (₹0)</option>
            </select>
          </div>
        </div>

        <div class="auth-field" style="margin-bottom:16px;">
          <label style="font-size:0.8rem; font-weight:700;">Set Desired Internet Banking Password</label>
          <input name="password" type="password" required minlength="6" placeholder="Choose a secure NetBanking password" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:18px; font-size:0.8rem; color:#475569;">
          🛡️ <strong>Statutory Regulatory Compliance:</strong> By proceeding, your identity is verified via simulated UIDAI & NSDL databases under RBI Master Direction 2026.
        </div>

        <div id="instantAccNotice" class="portal-notice error hidden" style="margin-bottom:12px;"></div>

        <div style="display:flex; gap:12px;">
          <button type="submit" id="instantAccSubmitBtn" class="btn btn-customer-login w-100" style="background:#059669; padding:12px; font-weight:700;">
            Verify KYC & Open Account Instantly →
          </button>
          <button type="button" class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Cancel</button>
        </div>
      </form>
    </div>
  `);
}

async function handleInstantAccountSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = $('#instantAccSubmitBtn');
  const notice = $('#instantAccNotice');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing Instant Application…';
  }

  try {
    const fullName = f.get('fullName').trim();
    const email = f.get('email').trim();
    const phone = f.get('phone').trim();
    const pan = (f.get('pan') || 'ABCDE1234F').toUpperCase();
    const password = f.get('password');
    const branch = f.get('branch');
    const cardChoice = f.get('cardChoice');

    const username = fullName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) + Math.floor(100 + Math.random() * 900);

    const result = await api('/api/auth/register', {
      method: 'POST',
      body: {
        username,
        password,
        fullName,
        email,
        phone,
        address: `${branch} Area`,
        panNumber: pan,
        aadhaarNumber: '554433221100'
      }
    });

    playTone('success');

    openFeatureModal(`
      <div style="text-align:center; padding:10px 0;">
        <div style="font-size:3rem; margin-bottom:10px;">🎉</div>
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 12px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">ACCOUNT ACTIVATED</span>
        <h2 style="font-size:1.6rem; color:var(--bank-navy); margin:10px 0 6px;">Welcome to Max Global Private Bank</h2>
        <p style="color:#64748b; font-size:0.88rem; margin-bottom:20px;">Your Digital Savings Account has been successfully provisioned on the core banking ledger.</p>

        <div style="background:linear-gradient(135deg, #06101e 0%, #0f2744 100%); border-radius:12px; padding:20px; color:#fff; text-align:left; margin-bottom:20px; border:1px solid rgba(251,191,36,0.4); box-shadow:0 10px 25px rgba(0,0,0,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
            <strong style="color:#fbbf24; font-size:0.9rem;">OFFICIAL ACCOUNT MANDATE</strong>
            <span style="font-size:0.75rem; background:rgba(16,185,129,0.2); color:#34d399; padding:2px 8px; border-radius:8px;">STATUS: ACTIVE</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.85rem;">
            <div><small style="color:#94a3b8; display:block;">ACCOUNT NUMBER</small><strong style="font-size:1.05rem; letter-spacing:1px; color:#fff;">${escapeHtml(result.accountNumber)}</strong></div>
            <div><small style="color:#94a3b8; display:block;">CUSTOMER ID (CIF)</small><strong style="font-size:1.05rem; color:#fff;">${escapeHtml(result.customerCode)}</strong></div>
            <div><small style="color:#94a3b8; display:block;">NETBANKING USERNAME</small><strong style="color:#fbbf24;">${escapeHtml(username)}</strong></div>
            <div><small style="color:#94a3b8; display:block;">IFSC ROUTING CODE</small><strong style="color:#fff;">MGPB000042</strong></div>
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:20px; text-align:left; font-size:0.85rem;">
          <div style="color:var(--bank-navy); font-weight:700; margin-bottom:4px;">💳 Debit Card Dispatched: ${escapeHtml(cardChoice)}</div>
          <div style="color:#64748b;">A virtual card has been issued to your NetBanking profile with full contactless limits enabled.</div>
        </div>

        <div style="display:flex; gap:12px;">
          <button class="btn btn-customer-login w-100" onclick="closeFeatureModal(); openPortalModal('customer');" style="background:#059669; padding:12px; font-weight:700;">
            Sign In to NetBanking with ${escapeHtml(username)} →
          </button>
          <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
        </div>
      </div>
    `);
  } catch (err) {
    if (notice) {
      notice.textContent = err.message;
      notice.classList.remove('hidden');
    } else {
      alert(err.message);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Verify KYC & Open Account Instantly →';
    }
  }
}

function openDepositBookingModal(depositPlan = 'regular', defaultRate = '7.85') {
  playTone('click');
  const s = publicContent.settings || {};
  const baseRate = parseFloat(defaultRate || s.fd_rate || '7.85');

  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 10px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">SOVEREIGN CAPITAL PRESERVATION</span>
        <span style="font-size:0.75rem; font-weight:700; color:#64748b;">QUARTERLY COMPOUNDING</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 4px;">Sovereign Fixed Deposit Booking Desk</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:18px;">Lock in guaranteed maturity returns backed unconditionally by statutory DICGC deposit insurance.</p>

      <form id="fdBookingModalForm" onsubmit="handleFdBookingSubmit(event)">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Deposit Scheme</label>
            <select id="modalFdScheme" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;" onchange="updateModalFdCalc()">
              <option value="7.85" ${depositPlan === 'regular' ? 'selected' : ''}>Regular Term Growth (7.85% p.a.)</option>
              <option value="8.35" ${depositPlan === 'senior' ? 'selected' : ''}>Senior Citizen Privilege (8.35% p.a.)</option>
              <option value="7.25" ${depositPlan === 'tax_saver' ? 'selected' : ''}>5-Year Tax Saver 80C (7.25% p.a.)</option>
            </select>
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Tenure Period</label>
            <select id="modalFdTenure" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;" onchange="updateModalFdCalc()">
              <option value="12" selected>12 Months (1 Year)</option>
              <option value="24">24 Months (2 Years)</option>
              <option value="36">36 Months (3 Years)</option>
              <option value="60">60 Months (5 Years)</option>
            </select>
          </div>
        </div>

        <div class="auth-field" style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <label style="font-size:0.8rem; font-weight:700;">Principal Deposit Amount</label>
            <strong id="modalFdAmountLabel" style="color:#059669; font-size:0.95rem;">₹1,00,000</strong>
          </div>
          <input type="range" id="modalFdAmountRange" min="10000" max="2500000" step="10000" value="100000" style="width:100%;" oninput="updateModalFdCalc()">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Depositor Full Name</label>
            <input name="depositorName" required placeholder="e.g. Aarav Sharma" value="${currentUser ? escapeHtml(currentUser.name) : ''}" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Nominee Full Name & Relation</label>
            <input name="nomineeName" required placeholder="e.g. Sunita Sharma (Spouse)" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
        </div>

        <!-- Live Calculation Box -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:18px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:center;">
            <div>
              <small style="color:#64748b; font-weight:700;">ESTIMATED MATURITY AMOUNT</small>
              <div id="modalFdMaturityDisplay" style="font-size:1.6rem; font-weight:800; color:#059669; margin-top:2px;">₹1,08,085</div>
            </div>
            <div>
              <small style="color:#64748b; font-weight:700;">GUARANTEED INTEREST YIELD</small>
              <div id="modalFdInterestDisplay" style="font-size:1.6rem; font-weight:800; color:var(--bank-navy); margin-top:2px;">₹8,085</div>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:12px;">
          <button type="submit" class="btn btn-customer-login w-100" style="background:#059669; padding:12px; font-weight:700;">
            Confirm & Issue Term Deposit Certificate →
          </button>
          <button type="button" class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Cancel</button>
        </div>
      </form>
    </div>
  `);

  window.updateModalFdCalc = function() {
    const schemeEl = $('#modalFdScheme');
    const tenureEl = $('#modalFdTenure');
    const rangeEl = $('#modalFdAmountRange');
    if (!schemeEl || !tenureEl || !rangeEl) return;
    const rate = parseFloat(schemeEl.value);
    const months = parseInt(tenureEl.value);
    const p = parseFloat(rangeEl.value);

    $('#modalFdAmountLabel').textContent = money(p);
    const maturity = Math.round(p * Math.pow(1 + (rate / 100) / 4, (4 * months) / 12));
    const interest = maturity - p;

    $('#modalFdMaturityDisplay').textContent = money(maturity);
    $('#modalFdInterestDisplay').textContent = money(interest);
  };
}

async function handleFdBookingSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const depositorName = f.get('depositorName').trim();
  const nomineeName = f.get('nomineeName').trim();
  const schemeRate = $('#modalFdScheme').value;
  const months = parseInt($('#modalFdTenure').value);
  const p = parseFloat($('#modalFdAmountRange').value);
  const maturity = Math.round(p * Math.pow(1 + (parseFloat(schemeRate) / 100) / 4, (4 * months) / 12));

  let fdCertNum = 'MGPB-FD-' + Math.floor(100000 + Math.random() * 900000);
  if (currentUser && currentUser.role === 'customer') {
    try {
      const res = await api('/api/customer/fd/create', {
        method: 'POST',
        body: { principal: p, tenureMonths: months }
      });
      if (res.fdNum) fdCertNum = res.fdNum;
    } catch (_) {}
  }

  const matDate = new Date();
  matDate.setMonth(matDate.getMonth() + months);
  const formattedMatDate = matDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  playTone('success');

  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 10px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">TERM DEPOSIT CERTIFICATE ISSUED</span>
        <span style="font-size:0.75rem; color:#64748b;">OFFICIAL RECORD</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 6px;">Fixed Deposit Term Advice</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">Statutory certificate generated under Reserve Bank of India Master Direction 2026.</p>

      <div style="background:#ffffff; border:2px solid #059669; border-radius:12px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.06); margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:12px;">
          <div>
            <span style="font-size:0.7rem; color:#94a3b8; font-weight:700;">CERTIFICATE NUMBER</span>
            <div style="font-family:monospace; font-size:1.1rem; font-weight:800; color:var(--bank-navy);">${escapeHtml(fdCertNum)}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:0.7rem; color:#94a3b8; font-weight:700;">APPLICABLE RATE</span>
            <div style="font-size:1.1rem; font-weight:800; color:#059669;">${schemeRate}% p.a.</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.88rem; margin-bottom:12px;">
          <div><small style="color:#64748b; display:block;">DEPOSITOR NAME</small><strong>${escapeHtml(depositorName)}</strong></div>
          <div><small style="color:#64748b; display:block;">REGISTERED NOMINEE</small><strong>${escapeHtml(nomineeName)}</strong></div>
          <div><small style="color:#64748b; display:block;">PRINCIPAL SUM</small><strong style="font-size:1.1rem; color:var(--bank-navy);">${money(p)}</strong></div>
          <div><small style="color:#64748b; display:block;">MATURITY PROCEEDS</small><strong style="font-size:1.15rem; color:#059669;">${money(maturity)}</strong></div>
          <div><small style="color:#64748b; display:block;">TENURE</small><strong>${months} Months</strong></div>
          <div><small style="color:#64748b; display:block;">MATURITY DATE</small><strong>${formattedMatDate}</strong></div>
        </div>

        <div style="background:#f8fafc; border-radius:6px; padding:10px; font-size:0.78rem; color:#64748b; display:flex; justify-content:space-between; align-items:center;">
          <span>🛡️ DICGC Insured up to ₹5,00,000</span>
          <span>Compounded Quarterly</span>
        </div>
      </div>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-customer-login w-100" onclick="window.print()" style="background:#059669; font-weight:700;">
          🖨️ Print Deposit Advice
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);
}

function openCardApplicationModal(cardTier = 'infinite_metal') {
  playTone('click');
  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#b45309; background:#fef3c7; padding:4px 10px; border-radius:12px; border:1px solid rgba(180,83,9,0.3);">EXCLUSIVE TITANIUM ISSUANCE</span>
        <span style="font-size:0.75rem; font-weight:700; color:#64748b;">ZERO FX MARKUP</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 4px;">Max Infinite Visa Metal Card Application</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">Handcrafted 16g brushed titanium with custom gold laser engraving & worldwide VIP lounge privileges.</p>

      <!-- Live Metal Card Engraving Studio -->
      <div style="background:linear-gradient(135deg, #06101e 0%, #172554 100%); border-radius:12px; padding:20px; color:#fff; margin-bottom:18px; border:1px solid rgba(251,191,36,0.5); box-shadow:0 8px 24px rgba(0,0,0,0.3);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
          <span style="font-size:0.85rem; font-weight:800; letter-spacing:1.5px; color:#fbbf24;">MAX GLOBAL PRIVATE BANK</span>
          <span style="font-weight:900; font-size:1.1rem; color:#fff; letter-spacing:1px;">VISA</span>
        </div>
        <div style="font-family:monospace; font-size:1.25rem; letter-spacing:3px; color:#f1f5f9; margin-bottom:18px;">
          4532 •••• •••• 8901
        </div>
        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
          <div>
            <small style="color:#94a3b8; font-size:0.65rem; display:block; letter-spacing:1px;">ENGRAVED CARDHOLDER</small>
            <strong id="liveCardEngraveName" style="color:#fbbf24; font-size:0.95rem; letter-spacing:1px; text-transform:uppercase;">
              ${currentUser ? escapeHtml(currentUser.name) : 'YOUR NAME HERE'}
            </strong>
          </div>
          <div style="text-align:right;">
            <small style="color:#94a3b8; font-size:0.65rem; display:block;">VALID THRU</small>
            <span style="font-size:0.85rem; color:#fff;">12/30</span>
          </div>
          <span style="font-size:0.75rem; letter-spacing:1px; color:#fbbf24; font-weight:800;">INFINITE METAL</span>
        </div>
      </div>

      <form id="cardApplicationForm" onsubmit="handleCardApplicationSubmit(event)">
        <div class="auth-field" style="margin-bottom:12px;">
          <label style="font-size:0.8rem; font-weight:700;">Name to be Laser Engraved on Metal</label>
          <input name="cardholderName" id="cardholderInput" required placeholder="Enter your full name" value="${currentUser ? escapeHtml(currentUser.name) : ''}" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%; text-transform:uppercase;" oninput="$('#liveCardEngraveName').textContent = this.value.toUpperCase() || 'YOUR NAME HERE'">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Annual Income Bracket</label>
            <select name="income" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
              <option value="15-25L">₹15 Lakhs – ₹25 Lakhs / yr</option>
              <option value="25-50L" selected>₹25 Lakhs – ₹50 Lakhs / yr</option>
              <option value="50L+">₹50 Lakhs+ High Net Worth</option>
            </select>
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Select Welcome Privilege</label>
            <select name="welcomePerk" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
              <option value="Taj Dining Voucher">₹25,000 Taj Hotels Dining Voucher</option>
              <option value="12,000 Airline Miles">12,000 Complimentary Airline Miles</option>
              <option value="Priority Pass Unlimited">Unlimited 1,200+ Global Airport Lounges</option>
            </select>
          </div>
        </div>

        <div class="auth-field" style="margin-bottom:16px;">
          <label style="font-size:0.8rem; font-weight:700;">Delivery Vault Box Address & PIN Code</label>
          <input name="deliveryAddress" required placeholder="Apartment / Suite, Building, Street, City, PIN Code" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
        </div>

        <div style="display:flex; gap:12px;">
          <button type="submit" class="btn btn-customer-login w-100" style="background:#fbbf24; color:#06101e; font-weight:800; padding:12px;">
            Submit Application & Issue Titanium Card →
          </button>
          <button type="button" class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Cancel</button>
        </div>
      </form>
    </div>
  `);
}

function handleCardApplicationSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const name = f.get('cardholderName').trim().toUpperCase();
  const perk = f.get('welcomePerk');
  const trackId = 'BLUEDART-MGPB-' + Math.floor(100000 + Math.random() * 900000);

  playTone('success');

  openFeatureModal(`
    <div style="text-align:left;">
      <div style="text-align:center; margin-bottom:12px;">
        <span style="font-size:2.8rem;">✨</span>
        <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:8px 0 4px;">Max Infinite Visa Metal Approved!</h2>
        <p style="color:#059669; font-weight:700; font-size:0.9rem;">Your custom 16g Titanium Card is now in precision laser production.</p>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px; margin-bottom:18px; font-size:0.88rem;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div><small style="color:#64748b; display:block;">ENGRAVED NAME</small><strong style="color:var(--bank-navy);">${escapeHtml(name)}</strong></div>
          <div><small style="color:#64748b; display:block;">ACTIVE NETWORK</small><strong>Visa Infinite Global</strong></div>
          <div><small style="color:#64748b; display:block;">DISPATCH CONSIGNMENT</small><strong style="font-family:monospace; color:#0284c7;">${escapeHtml(trackId)}</strong></div>
          <div><small style="color:#64748b; display:block;">ESTIMATED DELIVERY</small><strong style="color:#059669;">48 Hours by Courier</strong></div>
        </div>
        <div style="border-top:1px solid #e2e8f0; margin-top:12px; padding-top:10px;">
          <small style="color:#64748b; display:block;">ACTIVATED WELCOME PRIVILEGE</small>
          <strong style="color:#b45309;">🎁 ${escapeHtml(perk)}</strong>
        </div>
      </div>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-customer-login w-100" onclick="closeFeatureModal(); openPortalModal('customer');" style="background:#fbbf24; color:#06101e; font-weight:800;">
          Access NetBanking Card Controls →
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);
}

function openLoanApplicationModal(loanType = 'Residential Home Mortgage', defaultRate = '8.40') {
  playTone('click');
  const s = publicContent.settings || {};
  const rate = parseFloat(defaultRate || s.home_loan_rate || '8.40');

  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#b45309; background:#fef3c7; padding:4px 10px; border-radius:12px; border:1px solid rgba(180,83,9,0.3);">PRE-APPROVED CREDIT DESK</span>
        <span style="font-size:0.75rem; font-weight:700; color:#059669;">0% PROCESSING FEE</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 4px;">Pre-Approved Digital Loan Application</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">Instant digital sanction in 4 hours with minimal documentation & zero foreclosure charges.</p>

      <form id="loanAppForm" onsubmit="handleLoanApplicationSubmit(event)">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Loan Category</label>
            <select id="modalLoanType" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;" onchange="updateModalLoanCalc()">
              <option value="8.40" ${loanType.includes('Home') ? 'selected' : ''}>Residential Home Mortgage (8.40% p.a.)</option>
              <option value="10.50" ${loanType.includes('Personal') ? 'selected' : ''}>Personal Growth Line (10.50% p.a.)</option>
              <option value="8.75" ${loanType.includes('Auto') ? 'selected' : ''}>Automobile Vehicle Loan (8.75% p.a.)</option>
              <option value="9.25" ${loanType.includes('SME') || loanType.includes('Corporate') ? 'selected' : ''}>Corporate & SME Credit (9.25% p.a.)</option>
            </select>
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Repayment Tenure</label>
            <select id="modalLoanTenure" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;" onchange="updateModalLoanCalc()">
              <option value="5">5 Years (60 Months)</option>
              <option value="10">10 Years (120 Months)</option>
              <option value="15">15 Years (180 Months)</option>
              <option value="20" selected>20 Years (240 Months)</option>
              <option value="30">30 Years (360 Months)</option>
            </select>
          </div>
        </div>

        <div class="auth-field" style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <label style="font-size:0.8rem; font-weight:700;">Required Principal Loan Amount</label>
            <strong id="modalLoanAmountLabel" style="color:#b45309; font-size:0.95rem;">₹25,00,000</strong>
          </div>
          <input type="range" id="modalLoanAmountRange" min="100000" max="10000000" step="50000" value="2500000" style="width:100%;" oninput="updateModalLoanCalc()">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Applicant Full Name</label>
            <input name="applicantName" required placeholder="e.g. Aarav Sharma" value="${currentUser ? escapeHtml(currentUser.name) : ''}" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Monthly In-Hand Income</label>
            <input name="monthlyIncome" required placeholder="e.g. ₹1,50,000" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:18px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:center;">
            <div>
              <small style="color:#64748b; font-weight:700;">ESTIMATED MONTHLY INSTALLMENT (EMI)</small>
              <div id="modalLoanEmiDisplay" style="font-size:1.6rem; font-weight:800; color:#b45309; margin-top:2px;">₹21,538/mo</div>
            </div>
            <div>
              <small style="color:#64748b; font-weight:700;">PROCESSING FEE WAIVER</small>
              <div style="font-size:1.6rem; font-weight:800; color:#059669; margin-top:2px;">₹0 (FREE)</div>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:12px;">
          <button type="submit" class="btn btn-customer-login w-100" style="background:#b45309; padding:12px; font-weight:700;">
            Submit Application & Generate Sanction Letter →
          </button>
          <button type="button" class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Cancel</button>
        </div>
      </form>
    </div>
  `);

  window.updateModalLoanCalc = function() {
    const typeEl = $('#modalLoanType');
    const tenureEl = $('#modalLoanTenure');
    const rangeEl = $('#modalLoanAmountRange');
    if (!typeEl || !tenureEl || !rangeEl) return;
    const rate = parseFloat(typeEl.value);
    const years = parseInt(tenureEl.value);
    const months = years * 12;
    const p = parseFloat(rangeEl.value);

    $('#modalLoanAmountLabel').textContent = money(p);
    const monthlyRate = (rate / 12) / 100;
    const emi = Math.round((p * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
    $('#modalLoanEmiDisplay').textContent = money(emi) + '/mo';
  };
}

function handleLoanApplicationSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const applicantName = f.get('applicantName').trim();
  const rate = parseFloat($('#modalLoanType').value);
  const years = parseInt($('#modalLoanTenure').value);
  const p = parseFloat($('#modalLoanAmountRange').value);
  const months = years * 12;
  const monthlyRate = (rate / 12) / 100;
  const emi = Math.round((p * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
  const sanctionRef = 'MGPB-SANCTION-2026-' + Math.floor(10000 + Math.random() * 90000);

  playTone('success');

  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 10px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">IN-PRINCIPLE APPROVAL GRANTED</span>
        <span style="font-size:0.75rem; color:#64748b;">SANCTION ADVICE</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 4px;">Digital Loan Sanction Letter</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">Formal in-principle approval issued under credit risk underwriting guidelines.</p>

      <div style="background:#ffffff; border:2px solid #b45309; border-radius:12px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.06); margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:12px;">
          <div>
            <small style="color:#94a3b8; font-weight:700;">SANCTION REFERENCE</small>
            <div style="font-family:monospace; font-size:1.05rem; font-weight:800; color:var(--bank-navy);">${escapeHtml(sanctionRef)}</div>
          </div>
          <div style="text-align:right;">
            <small style="color:#94a3b8; font-weight:700;">SANCTIONED AMOUNT</small>
            <div style="font-size:1.15rem; font-weight:800; color:#b45309;">${money(p)}</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.88rem; margin-bottom:12px;">
          <div><small style="color:#64748b; display:block;">APPLICANT</small><strong>${escapeHtml(applicantName)}</strong></div>
          <div><small style="color:#64748b; display:block;">APPROVED INTEREST RATE</small><strong style="color:#059669;">${rate}% p.a. (Fixed)</strong></div>
          <div><small style="color:#64748b; display:block;">MONTHLY EMI</small><strong style="color:#b45309;">${money(emi)} / month</strong></div>
          <div><small style="color:#64748b; display:block;">REPAYMENT TENURE</small><strong>${years} Years (${months} Mos)</strong></div>
          <div><small style="color:#64748b; display:block;">LOAN PROCESSING FEE</small><strong style="color:#059669;">₹0 (Festive Waiver)</strong></div>
          <div><small style="color:#64748b; display:block;">DISBURSAL TIMELINE</small><strong>Within 4 Hours</strong></div>
        </div>
      </div>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-customer-login w-100" onclick="window.print()" style="background:#b45309; font-weight:700;">
          🖨️ Print Sanction Letter
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);
}

// ========================================================
// 4B. GOVERNMENT SAVINGS SCHEME (PPF/NPS/SSY) MODAL WORKFLOW
// ========================================================
function openGovtSchemeModal(scheme = 'PPF') {
  playTone('click');
  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#1e40af; background:#eff6ff; padding:4px 10px; border-radius:12px; border:1px solid rgba(30,64,175,0.3);">SOVEREIGN STATUTORY SCHEME</span>
        <span style="font-size:0.75rem; font-weight:700; color:#64748b;">GOVT OF INDIA MANDATE</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 6px;">Open Sovereign Government Scheme</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:18px;">100% sovereign safety, maximum Section 80C & 80CCD tax exemptions, and risk-free compounding.</p>

      <form id="govtSchemeForm" onsubmit="handleGovtSchemeSubmit(event)">
        <div class="auth-field" style="margin-bottom:12px;">
          <label style="font-size:0.8rem; font-weight:700;">Select Sovereign Scheme</label>
          <select name="schemeChoice" id="govtModalSchemeChoice" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
            <option value="Public Provident Fund (PPF)" ${scheme==='PPF'?'selected':''}>Public Provident Fund (PPF @ 7.10% Tax-Free)</option>
            <option value="National Pension System (NPS)" ${scheme==='NPS'?'selected':''}>National Pension System (NPS Tier-1 + ₹50k Extra 80CCD)</option>
            <option value="Sukanya Samriddhi Yojana (SSY)" ${scheme==='Sukanya Samriddhi'?'selected':''}>Sukanya Samriddhi Yojana (SSY @ 8.20% Girl Child)</option>
            <option value="Sovereign Gold Bonds (SGB)" ${scheme==='Sovereign Gold Bond'?'selected':''}>Sovereign Gold Bonds (2.50% Coupon + Gold Upside)</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Subscriber Full Name</label>
            <input name="subscriberName" required placeholder="Full Name as per PAN" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">PAN Number</label>
            <input name="pan" required placeholder="ABCDE1234F" maxlength="10" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%; text-transform:uppercase;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Aadhaar Number (UIDAI)</label>
            <input name="aadhaar" required placeholder="12-digit Aadhaar" maxlength="12" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Initial Deposit Contribution</label>
            <input name="depositAmount" type="number" min="500" max="150000" step="500" value="10000" required style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Nominee Full Name</label>
            <input name="nominee" required placeholder="Nominee legal name" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Relationship</label>
            <select name="relationship" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
              <option value="Spouse">Spouse</option>
              <option value="Child">Child / Daughter / Son</option>
              <option value="Parent">Father / Mother</option>
              <option value="Sibling">Brother / Sister</option>
            </select>
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; font-size:0.8rem; color:#475569;">
          🛡️ <strong>Statutory Sovereign Cover:</strong> Your scheme account will be formally mapped to RBI statutory depository systems. All contributions qualify for Section 80C or Section 80CCD tax benefits.
        </div>

        <div style="display:flex; gap:12px;">
          <button type="submit" class="btn btn-customer-login w-100" style="background:#1e40af; padding:12px; font-weight:700;">
            Confirm & Issue Scheme Passbook →
          </button>
          <button type="button" class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Cancel</button>
        </div>
      </form>
    </div>
  `);
}

function handleGovtSchemeSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const schemeChoice = f.get('schemeChoice');
  const subscriberName = f.get('subscriberName').trim();
  const depositAmount = parseFloat(f.get('depositAmount') || '10000');
  const nominee = f.get('nominee').trim();
  const rel = f.get('relationship');
  const mandateId = 'MGPB-GOV-2026-' + Math.floor(100000 + Math.random() * 900000);
  const passbookNo = 'PPF-' + Math.floor(100000000 + Math.random() * 900000000);

  playTone('success');

  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 10px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">PASSBOOK & MANDATE PROVISIONED</span>
        <span style="font-size:0.75rem; font-weight:700; color:#059669;">STATUS: ACTIVE</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 4px;">Sovereign Scheme Passbook Certificate</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">Statutory certificate issued under Government of India Savings Bank Regulations.</p>

      <div style="background:linear-gradient(135deg, #06101e 0%, #1e3a8a 100%); border-radius:12px; padding:22px; color:#fff; box-shadow:0 6px 20px rgba(0,0,0,0.15); margin-bottom:18px; border:1px solid rgba(251,191,36,0.4);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:10px; margin-bottom:12px;">
          <div>
            <span style="font-size:0.72rem; color:#fde047; letter-spacing:1px; font-weight:800; display:block;">SCHEME CLASSIFICATION</span>
            <strong style="font-size:1.05rem; color:#fff;">${escapeHtml(schemeChoice)}</strong>
          </div>
          <div style="text-align:right;">
            <span style="font-size:0.72rem; color:#cbd5e1; letter-spacing:1px; display:block;">MANDATE CODE</span>
            <code style="color:#fde047; font-weight:800;">${escapeHtml(mandateId)}</code>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.85rem;">
          <div><small style="color:#94a3b8; display:block;">SUBSCRIBER NAME</small><strong style="color:#fff;">${escapeHtml(subscriberName)}</strong></div>
          <div><small style="color:#94a3b8; display:block;">PASSBOOK ACCOUNT NO</small><strong style="color:#fde047;">${escapeHtml(passbookNo)}</strong></div>
          <div><small style="color:#94a3b8; display:block;">INITIAL FUNDING</small><strong style="color:#34d399;">${money(depositAmount)}</strong></div>
          <div><small style="color:#94a3b8; display:block;">REGISTERED NOMINEE</small><strong style="color:#fff;">${escapeHtml(nominee)} (${escapeHtml(rel)})</strong></div>
          <div><small style="color:#94a3b8; display:block;">TAX DEDUCTION ELIGIBLE</small><strong style="color:#34d399;">Section 80C & 80CCD</strong></div>
          <div><small style="color:#94a3b8; display:block;">SERVICING BRANCH</small><strong style="color:#fff;">Max Global Central Hub (MGPB0000042)</strong></div>
        </div>
      </div>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-customer-login w-100" onclick="window.print()" style="background:#1e40af; font-weight:700;">
          🖨️ Print Passbook Mandate
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);
}

// ========================================================
// 4C. MAX GLOBAL SECURITIES 3-IN-1 DEMAT ONBOARDING WORKFLOW
// ========================================================
function openDematApplicationModal(segment = 'All Segments') {
  playTone('click');
  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 10px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">MAX GLOBAL SECURITIES</span>
        <span style="font-size:0.75rem; font-weight:700; color:#64748b;">3-IN-1 INTEGRATED TERMINAL</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 6px;">Open 3-in-1 Demat & Trading Account</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:18px;">Flat ₹0 delivery brokerage, direct CDSL/NSDL integration, and instant intraday margin.</p>

      <form id="dematAppForm" onsubmit="handleDematSubmit(event)">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Full Legal Name</label>
            <input name="traderName" required placeholder="Name as per PAN card" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">PAN Card Number</label>
            <input name="pan" required placeholder="ABCDE1234F" maxlength="10" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%; text-transform:uppercase;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Mobile Number</label>
            <input name="phone" required placeholder="+91 98765 43210" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Annual Income Slab</label>
            <select name="incomeSlab" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
              <option value="1-5 Lakhs">₹1,00,000 - ₹5,00,000</option>
              <option value="5-10 Lakhs" selected>₹5,00,000 - ₹10,00,000</option>
              <option value="10-25 Lakhs">₹10,00,000 - ₹25,00,000</option>
              <option value="Above 25 Lakhs">₹25,00,000+ (High Net Worth)</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Depository Preference</label>
            <select name="depository" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
              <option value="CDSL">CDSL (Central Depository Services)</option>
              <option value="NSDL">NSDL (National Securities Depository)</option>
            </select>
          </div>
          <div class="auth-field" style="margin:0;">
            <label style="font-size:0.8rem; font-weight:700;">Requested Trading Segment</label>
            <select name="segment" style="padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
              <option value="NSE/BSE Equity + F&O + IPOs" selected>All Segments (Equity, F&O, Mutual Funds, IPOs)</option>
              <option value="Equity Delivery Only">Equity Delivery Only (₹0 Brokerage)</option>
              <option value="Commodity & Currency Derivatives">Derivatives & Commodities</option>
            </select>
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; font-size:0.8rem; color:#475569;">
          ✨ <strong>Guaranteed Welcome Benefits:</strong> Lifetime ₹0 brokerage on equity delivery, flat ₹20 on Intraday/F&O, 1st year free AMC, and instant ₹5,00,000 intraday trading limits.
        </div>

        <div style="display:flex; gap:12px;">
          <button type="submit" class="btn btn-customer-login w-100" style="background:#059669; padding:12px; font-weight:700;">
            Activate 3-in-1 Demat Account Instantly →
          </button>
          <button type="button" class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Cancel</button>
        </div>
      </form>
    </div>
  `);
}

function handleDematSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const traderName = f.get('traderName').trim();
  const depository = f.get('depository') || 'CDSL';
  const segment = f.get('segment');
  const uccCode = 'MGPB-TRD-' + Math.floor(1000 + Math.random() * 9000);
  const dpId = 'IN304200';
  const dematNo = '12081600' + Math.floor(10000000 + Math.random() * 90000000);

  playTone('success');

  openFeatureModal(`
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 10px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">3-IN-1 ACCOUNT ACTIVATED</span>
        <span style="font-size:0.75rem; font-weight:700; color:#059669;">SEBI REGISTERED: INZ0002849</span>
      </div>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:0 0 4px;">Max Global Securities Welcome Kit</h2>
      <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">Your 3-in-1 Demat, Trading, and Investment terminal is provisioned on the exchange ledger.</p>

      <div style="background:linear-gradient(135deg, #06101e 0%, #064e3b 100%); border-radius:12px; padding:22px; color:#fff; box-shadow:0 6px 20px rgba(0,0,0,0.15); margin-bottom:18px; border:1px solid rgba(52,211,153,0.4);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:10px; margin-bottom:12px;">
          <div>
            <span style="font-size:0.72rem; color:#34d399; letter-spacing:1px; font-weight:800; display:block;">TRADING CLIENT CODE (UCC)</span>
            <code style="font-size:1.15rem; color:#fff; font-weight:800;">${escapeHtml(uccCode)}</code>
          </div>
          <div style="text-align:right;">
            <span style="font-size:0.72rem; color:#cbd5e1; letter-spacing:1px; display:block;">DEPOSITORY (${escapeHtml(depository)})</span>
            <strong style="color:#34d399;">DP ID: ${dpId}</strong>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.85rem;">
          <div><small style="color:#94a3b8; display:block;">ACCOUNT HOLDER</small><strong style="color:#fff;">${escapeHtml(traderName)}</strong></div>
          <div><small style="color:#94a3b8; display:block;">16-DIGIT DEMAT BO ID</small><code style="color:#fde047;">${escapeHtml(dematNo)}</code></div>
          <div><small style="color:#94a3b8; display:block;">EQUITY DELIVERY BROKERAGE</small><strong style="color:#34d399;">₹0 (Flat FREE for Life)</strong></div>
          <div><small style="color:#94a3b8; display:block;">INTRADAY & F&O COMMISSION</small><strong style="color:#fff;">Flat ₹20 / order</strong></div>
          <div><small style="color:#94a3b8; display:block;">PRE-APPROVED INTRADAY MARGIN</small><strong style="color:#34d399;">₹5,00,000 Active</strong></div>
          <div><small style="color:#94a3b8; display:block;">ACTIVE SEGMENTS</small><strong style="color:#fff;">${escapeHtml(segment)}</strong></div>
        </div>
      </div>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-customer-login w-100" onclick="window.print()" style="background:#059669; font-weight:700;">
          🖨️ Print Demat Welcome Kit
        </button>
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();" style="flex-shrink:0;">Close</button>
      </div>
    </div>
  `);
}

const openDepositModal = openDepositBookingModal;
const openLoanModal = openLoanApplicationModal;

function showRbiCharterModal() {
  playTone('click');
  const s = publicContent.settings || {};
  const license = s.rbi_license || 'RBI/2026/MGPB-8842';
  openFeatureModal(`
    <div style="text-align:left;">
      <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#059669; background:#ecfdf5; padding:4px 10px; border-radius:12px; border:1px solid rgba(5,150,105,0.3);">OFFICIAL STATUTORY CHARTER</span>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:8px 0 4px;">Reserve Bank of India Scheduled Status</h2>
      <p style="color:#64748b; font-size:0.88rem; margin-bottom:16px;">Scheduled Commercial Bank license under Section 22 of the Banking Regulation Act, 1949</p>

      <div style="background:linear-gradient(135deg, #06101e 0%, #0f2744 100%); border-radius:12px; padding:20px; color:#fff; margin-bottom:20px; border:1px solid rgba(251,191,36,0.3);">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; font-size:0.85rem;">
          <div><strong style="color:#fbbf24;">Statutory License No:</strong><br><code style="color:#e2e8f0; font-size:0.95rem;">${escapeHtml(license)}</code></div>
          <div><strong style="color:#fbbf24;">Regulatory Classification:</strong><br>Scheduled Commercial Bank</div>
          <div><strong style="color:#fbbf24;">Governing Act:</strong><br>Banking Regulation Act 1949</div>
          <div><strong style="color:#fbbf24;">Supervisory Authority:</strong><br>Reserve Bank of India, Mumbai</div>
        </div>
      </div>

      <div style="font-size:0.88rem; color:#475569; line-height:1.6; margin-bottom:20px;">
        Max Global Private Bank is enlisted in the Second Schedule to the Reserve Bank of India Act, 1934, satisfying all statutory liquidity ratios (SLR), cash reserve ratios (CRR), and Basel III capital adequacy requirements.
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();">Close Verification</button>
      </div>
    </div>
  `);
}

function showDicgcModal() {
  playTone('click');
  const s = publicContent.settings || {};
  const insured = s.dicgc_insured || '₹5,00,000 per depositor';
  openFeatureModal(`
    <div style="text-align:left;">
      <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#b45309; background:#fef3c7; padding:4px 10px; border-radius:12px;">DEPOSIT INSURANCE COVERAGE</span>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:8px 0 4px;">DICGC Sovereign Deposit Protection</h2>
      <div style="font-size:1.2rem; font-weight:800; color:#059669; margin-bottom:10px;">Insured up to ${escapeHtml(insured)}</div>
      <p style="color:#64748b; font-size:0.88rem; line-height:1.6; margin-bottom:18px;">
        Under the Deposit Insurance and Credit Guarantee Corporation Act, 1961, all cumulative deposits (Savings, Fixed, Recurring) held by every individual depositor are insured up to ₹5 Lakhs.
      </p>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:20px; font-size:0.85rem;">
        <ul style="color:#475569; line-height:1.7; padding-left:20px; margin:0;">
          <li>Principal and interest components are both covered up to the maximum limit of ₹5,00,000.</li>
          <li>Protected by the Deposit Insurance and Credit Guarantee Corporation (a wholly-owned subsidiary of RBI).</li>
          <li>Zero claim deduction or haircut for retail account holders.</li>
        </ul>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();">Close</button>
      </div>
    </div>
  `);
}

function showSecuritySpecsModal() {
  playTone('click');
  openFeatureModal(`
    <div style="text-align:left;">
      <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#1e40af; background:#eff6ff; padding:4px 10px; border-radius:12px;">CYBERSECURITY FRAMEWORK</span>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:8px 0 4px;">256-Bit Quantum TLS & ISO 27001 Infrastructure</h2>
      <p style="color:#64748b; font-size:0.88rem; margin-bottom:16px;">Defense-in-depth financial cryptographic safeguards</p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; font-size:0.85rem;">
        <div style="background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
          <strong style="color:var(--bank-navy);">Transport Encryption:</strong>
          <div style="color:#059669; font-weight:600; margin-top:2px;">TLS 1.3 (256-Bit AES-GCM)</div>
        </div>
        <div style="background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
          <strong style="color:var(--bank-navy);">ISMS Certification:</strong>
          <div style="color:var(--bank-blue); font-weight:600; margin-top:2px;">ISO/IEC 27001:2022 Verified</div>
        </div>
        <div style="background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
          <strong style="color:var(--bank-navy);">Data Integrity:</strong>
          <div style="color:#059669; font-weight:600; margin-top:2px;">Atomic ACID Transactions</div>
        </div>
        <div style="background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
          <strong style="color:var(--bank-navy);">Session Security:</strong>
          <div style="color:var(--bank-blue); font-weight:600; margin-top:2px;">HttpOnly + CSRF Protection</div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();">Close</button>
      </div>
    </div>
  `);
}

function showNodalOfficerModal() {
  playTone('click');
  openFeatureModal(`
    <div style="text-align:left;">
      <span style="font-size:0.75rem; letter-spacing:1.5px; font-weight:800; color:#1e40af; background:#eff6ff; padding:4px 10px; border-radius:12px;">GRIEVANCE REDRESSAL MECHANISM</span>
      <h2 style="font-size:1.5rem; color:var(--bank-navy); margin:8px 0 4px;">Principal Nodal Officer Directory</h2>
      <p style="color:#64748b; font-size:0.88rem; margin-bottom:16px;">Direct escalation channel under the Reserve Bank - Integrated Ombudsman Scheme, 2021</p>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px; margin-bottom:18px; font-size:0.88rem;">
        <div style="margin-bottom:10px;"><strong style="color:var(--bank-navy);">Name of Officer:</strong> Shri S. K. Venkatraman</div>
        <div style="margin-bottom:10px;"><strong style="color:var(--bank-navy);">Designation:</strong> Chief General Manager & Principal Nodal Officer</div>
        <div style="margin-bottom:10px;"><strong style="color:var(--bank-navy);">Office Address:</strong> Max Towers, 14th Floor, C-58, G-Block, BKC, Mumbai - 400051</div>
        <div style="margin-bottom:10px;"><strong style="color:var(--bank-navy);">Email:</strong> <a href="mailto:nodalofficer@maxglobalbank.com" style="color:var(--bank-blue); font-weight:700;">nodalofficer@maxglobalbank.com</a></div>
        <div><strong style="color:var(--bank-navy);">Direct Phone:</strong> +91 22 6900 8850 (Mon–Fri, 10:00 AM – 5:00 PM)</div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary-large" onclick="closeFeatureModal();">Close Directory</button>
      </div>
    </div>
  `);
}

function proceedToDeposit() {
  playTone('click');
  if (currentUser && currentUser.role === 'customer') {
    routeUserToPortal();
    renderCustomerView('deposits');
  } else {
    openDepositBookingModal('regular', '7.85');
  }
}

function proceedToLoan() {
  playTone('click');
  if (currentUser && currentUser.role === 'customer') {
    routeUserToPortal();
    renderCustomerView('loans');
  } else {
    openLoanApplicationModal('Residential Home Mortgage', '8.40');
  }
}

function proceedToCardManagement() {
  playTone('click');
  if (currentUser && currentUser.role === 'customer') {
    routeUserToPortal();
    renderCustomerView('cards');
  } else {
    openPortalModal('customer');
  }
}

// ========================================================
// 5. AUTHENTICATION & PORTAL ROUTING
// ========================================================
function openPortalModal(portal = 'customer') {
  playTone('click');
  activePortalChoice = portal;
  // Admin tab is only visible when accessed via URL route (#admin)
  if (portal === 'admin') {
    $('#adminModalTab').style.display = 'block';
  } else {
    $('#adminModalTab').style.display = 'none';
  }
  $('#mobileFlyout').classList.add('hidden');
  $('#authModal').classList.remove('hidden');
  renderAuthModal();
}

function closePortalModal() {
  $('#authModal').classList.add('hidden');
}

function renderAuthModal() {
  $$('.p-tab').forEach(t => t.classList.toggle('active', t.dataset.portal === activePortalChoice));
  const c = $('#authContent');

  if (activePortalChoice === 'register') {
    $('#authModalTitle').textContent = 'Open Digital Savings Account';
    $('#authModalSubtitle').textContent = 'Complete your digital KYC in under 3 minutes';

    c.innerHTML = `
      <form id="regForm">
        <div class="auth-field">
          <label>Full Legal Name (as per Identity Card)</label>
          <input name="fullName" required minlength="2" maxlength="120" placeholder="e.g. Aarav Sharma" autocomplete="name">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="auth-field">
            <label>Email Address</label>
            <input name="email" type="email" required maxlength="190" placeholder="name@email.com" autocomplete="email">
          </div>
          <div class="auth-field">
            <label>Mobile Contact</label>
            <input name="phone" required minlength="7" maxlength="25" placeholder="+91 98765 43210" autocomplete="tel">
          </div>
        </div>
        <div class="auth-field">
          <label>Residential Address</label>
          <input name="address" maxlength="255" placeholder="City, State, Pin Code">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="auth-field">
            <label>NetBanking Username</label>
            <input name="username" required minlength="4" maxlength="60" placeholder="e.g. aarav88" autocomplete="username">
          </div>
          <div class="auth-field">
            <label>Secure Password</label>
            <input name="password" type="password" required minlength="8" placeholder="••••••••••••" autocomplete="new-password">
          </div>
        </div>
        <button class="btn btn-customer-login auth-submit-btn" type="submit">Verify & Open Account →</button>
      </form>
    `;
    $('#regForm').onsubmit = handleRegister;
  } else {
    const isCustomer = activePortalChoice === 'customer';
    const isStaff = activePortalChoice === 'employee';
    const isAdmin = activePortalChoice === 'admin';

    if (isCustomer) {
      $('#authModalTitle').textContent = 'Sign In to Personal NetBanking';
      $('#authModalSubtitle').textContent = 'Access your savings, deposits, cards and transfers';
    } else if (isStaff) {
      $('#authModalTitle').textContent = 'Branch Staff & Teller Portal';
      $('#authModalSubtitle').textContent = 'Authorized branch operational sign-in';
    } else {
      $('#authModalTitle').textContent = 'Executive Administrator Terminal';
      $('#authModalSubtitle').textContent = 'Master infrastructure, rates manager & controls';
    }

    c.innerHTML = `
      <form id="signInForm">
        <div class="auth-field">
          <label>Username / User ID</label>
          <input name="username" required maxlength="60" placeholder="${isCustomer ? 'aarav' : (isStaff ? 'teller' : 'admin')}" autocomplete="username">
        </div>
        <div class="auth-field">
          <label>Password</label>
          <input name="password" type="password" required placeholder="••••••••••••" autocomplete="current-password">
        </div>
        <button class="btn ${isCustomer ? 'btn-customer-login' : (isStaff ? 'btn-staff-btn' : 'btn-admin-btn')} auth-submit-btn" type="submit">
          <span>Authorize Access</span> <span>→</span>
        </button>
      </form>

      <div class="auth-footer-credentials">
        <strong>Direct Login Credentials:</strong><br>
        ${isCustomer ? 'Customer: <code>aarav</code> / <code>Customer123!</code>' : ''}
        ${isStaff ? 'Branch Staff: <code>teller</code> / <code>Teller123!</code>' : ''}
        ${isAdmin ? 'Master Administrator: <code>admin</code> / <code>Admin123!</code>' : ''}
      </div>
    `;

    $('#signInForm').onsubmit = handleLogin;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const btn = e.currentTarget.querySelector('button');
  btn.disabled = true;
  btn.innerHTML = '<span>Verifying Security Token…</span>';

  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: {
        username: f.get('username'),
        password: f.get('password'),
        portal: activePortalChoice
      }
    });

    currentUser = result.user;
    csrfToken = result.user.csrfToken;
    updatePublicHeaderAuth();
    closePortalModal();
    routeUserToPortal();
  } catch (err) {
    authNotice(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Authorize Access</span> <span>→</span>';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const btn = e.currentTarget.querySelector('button');
  btn.disabled = true;
  btn.innerHTML = '<span>Processing Application…</span>';

  try {
    const result = await api('/api/auth/register', {
      method: 'POST',
      body: Object.fromEntries(f.entries())
    });

    closePortalModal();
    openPortalModal('customer');
    alert(`Account Created Successfully!\nYour Account Number: ${result.accountNumber}\nCustomer ID: ${result.customerCode}\nYou may now sign in.`);
  } catch (err) {
    authNotice(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Verify & Open Account →';
  }
}

function authNotice(msg) {
  let old = $('#authErr');
  if (!old) {
    old = document.createElement('div');
    old.id = 'authErr';
    old.className = 'portal-notice error';
    $('#authContent').prepend(old);
  }
  old.textContent = msg;
}

async function logoutClient() {
  playTone('click');
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
  currentUser = null;
  csrfToken = '';
  updatePublicHeaderAuth();
  returnToPublicSite();
}

function returnToPublicSite() {
  playTone('click');
  $('#customerPortal').classList.add('hidden');
  $('#employeePortal').classList.add('hidden');
  $('#adminPortal').classList.add('hidden');
  $('#publicSite').classList.remove('hidden');
  window.location.hash = 'home';
  renderPublicPage('home');
  setupAiAssistantPersona();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function routeUserToPortal() {
  $('#publicSite').classList.add('hidden');
  $('#customerPortal').classList.add('hidden');
  $('#employeePortal').classList.add('hidden');
  $('#adminPortal').classList.add('hidden');

  if (currentUser.role === 'customer') {
    $('#customerPortal').classList.remove('hidden');
    $('#custUserName').textContent = currentUser.name;
    window.location.hash = 'netbanking';
    renderCustomerView('accounts');
  } else if (currentUser.role === 'admin') {
    $('#adminPortal').classList.remove('hidden');
    $('#adminUserName').textContent = currentUser.name;
    window.location.hash = 'admin';
    renderAdminView('telemetry');
  } else {
    $('#employeePortal').classList.remove('hidden');
    $('#empUserName').textContent = currentUser.name;
    $('#empAvatar').textContent = (currentUser.name[0] || 'T').toUpperCase();
    window.location.hash = 'staff';
    renderEmployeeView('search');
  }

  setupAiAssistantPersona();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePublicHeaderAuth() {
  const container = $('#headerActionGroup');
  if (!container) return;

  if (currentUser) {
    if (currentUser.role === 'admin') {
      container.innerHTML = `
        <span style="font-size:0.8rem; color:#94a3b8; margin-right:6px; display:inline-block;">⚡ Root Admin</span>
        <button class="btn btn-sentinel-ai" onclick="routeUserToPortal()" style="font-size:0.82rem; padding:8px 14px; background:linear-gradient(135deg, #0ea5e9, #0284c7);">
          Admin Console →
        </button>
        <button class="btn btn-secondary-large" onclick="logoutClient()" style="font-size:0.82rem; padding:8px 12px; margin-left:6px;">
          Sign Out
        </button>
      `;
    } else if (currentUser.role === 'customer') {
      container.innerHTML = `
        <button class="btn btn-customer-login" onclick="routeUserToPortal()" style="font-size:0.82rem; padding:8px 14px;">
          👤 NetBanking (${escapeHtml(currentUser.name)}) →
        </button>
        <button class="btn btn-secondary-large" onclick="logoutClient()" style="font-size:0.82rem; padding:8px 12px; margin-left:6px;">
          Sign Out
        </button>
      `;
    } else {
      container.innerHTML = `
        <button class="btn btn-staff-btn" onclick="routeUserToPortal()" style="font-size:0.82rem; padding:8px 14px;">
          🏢 Branch Ops (${escapeHtml(currentUser.name)}) →
        </button>
        <button class="btn btn-secondary-large" onclick="logoutClient()" style="font-size:0.82rem; padding:8px 12px; margin-left:6px;">
          Sign Out
        </button>
      `;
    }
  } else {
    container.innerHTML = `
      <button class="btn btn-secondary-large" onclick="openInstantAccountModal('savings')" style="font-size:0.85rem; padding:8px 14px; margin-right:6px;">
        Open Account
      </button>
      <button class="btn btn-customer-login" id="navOpenLoginBtn" onclick="openPortalModal('customer')">
        <span>NetBanking Sign In</span> <span>→</span>
      </button>
    `;
  }
}

// ========================================================
// 5. CUSTOMER WEALTH PORTAL CONTROLLER
// ========================================================
async function renderCustomerView(view) {
  playTone('click');
  activeCustomerView = view;
  $$('.c-nav-link').forEach(b => b.classList.toggle('active', b.dataset.custView === view));
  $$('.c-dock-btn[data-cust-view]').forEach(b => b.classList.toggle('active', b.dataset.custView === view));

  const c = $('#custViewContent');
  c.innerHTML = '<div class="cust-panel"><p style="text-align:center; color:#64748b;">Loading account records…</p></div>';

  try {
    cachedCustomerData = await api('/api/customer/dashboard');

    if (view === 'accounts') renderCustAccountsView(c);
    else if (view === 'transfers') renderCustTransfersView(c);
    else if (view === 'cards') renderCustCardsView(c);
    else if (view === 'loans') renderCustLoansView(c);
    else if (view === 'deposits') renderCustDepositsView(c);
    else if (view === 'profile') renderCustProfileView(c);
  } catch (err) {
    c.innerHTML = `<div class="cust-panel"><p style="color:#ef4444">${escapeHtml(err.message)}</p></div>`;
  }
}

function renderCustAccountsView(c) {
  const d = cachedCustomerData;
  const totalBalance = d.accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  c.innerHTML = `
    <div class="cust-welcome-banner">
      <div>
        <span class="sub-heading" style="color:#fcd34d">MAX GLOBAL NETBANKING • INFINITE WEALTH</span>
        <h2>Welcome back, ${escapeHtml(currentUser.name.split(' ')[0])}.</h2>
        <p>Total liquid reserves across your accounts: <strong>${money(totalBalance)}</strong></p>
      </div>
      <div class="cust-banner-right">
        <button class="btn btn-customer-login" id="custQuickPayBtn" style="background:#fff; color:var(--bank-navy)">
          <span>Quick Transfer</span> <span>→</span>
        </button>
      </div>
    </div>

    <div class="cust-accounts-grid">
      ${d.accounts.map(acc => `
        <div class="account-card-box">
          <div class="acc-card-top">
            <span class="acc-type-pill">${escapeHtml(acc.account_type.toUpperCase())} ACCOUNT</span>
            <span class="acc-number-txt">${escapeHtml(acc.account_number)}</span>
          </div>
          <div class="acc-balance-amount">${money(acc.balance)}</div>
          <div class="acc-ifsc-txt">Branch IFSC: <strong>${escapeHtml(acc.ifsc_code || 'MGPB0001042')}</strong></div>
          <div class="acc-card-actions">
            <button class="btn btn-sm btn-customer-login" onclick="renderCustomerView('transfers')">Transfer Funds</button>
            <button class="btn btn-sm" style="background:#f1f5f9; color:#0f172a;" onclick="downloadStatementCsv()">Download Statement</button>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="cust-panel">
      <div class="cust-panel-header">
        <div>
          <h3>Recent Verified Activity</h3>
          <p style="font-size:0.82rem; color:#64748b;">Live account debits and credits</p>
        </div>
        <button class="btn btn-sm" style="background:#eff6ff; color:#1e40af;" onclick="downloadStatementCsv()">
          Download CSV Statement ↓
        </button>
      </div>

      <div class="cust-table-wrap">
        <table class="cust-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Transaction Type</th>
              <th>Amount</th>
              <th>Description / Memo</th>
              <th>Date & Time</th>
            </tr>
          </thead>
          <tbody>
            ${d.transactions.length ? d.transactions.map(t => `
              <tr>
                <td class="ref-code">${escapeHtml(t.reference_code)}</td>
                <td><strong>${escapeHtml(t.transaction_type.toUpperCase())}</strong></td>
                <td class="${t.transaction_type === 'deposit' ? 'tx-credit' : 'tx-debit'}">
                  ${t.transaction_type === 'deposit' ? '+' : '-'} ${money(t.amount)}
                </td>
                <td>${escapeHtml(t.description || 'Fund Transfer')}</td>
                <td>${date(t.created_at)}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center; padding:24px; color:#64748b;">No recent transactions recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#custQuickPayBtn').onclick = () => renderCustomerView('transfers');
}

function renderCustTransfersView(c) {
  c.innerHTML = `
    <div class="cust-panel" style="max-width:700px; margin:0 auto;">
      <div class="cust-panel-header">
        <div>
          <h3>Instant Domestic Fund Transfer (24x7)</h3>
          <p style="font-size:0.85rem; color:#64748b;">Zero-fee atomic fund transfer to any Max Global account</p>
        </div>
      </div>

      <form id="transferForm">
        <div class="auth-field">
          <label>Beneficiary Account Number (12 Digits)</label>
          <input name="toAccount" required pattern="\\d{12}" maxlength="12" placeholder="e.g. 100000000002">
        </div>
        <div class="auth-field">
          <label>Transfer Amount (INR)</label>
          <input name="amount" type="number" min="1" max="10000000" step="0.01" required placeholder="5000.00">
        </div>
        <div class="auth-field">
          <label>Payment Purpose / Memo</label>
          <input name="description" maxlength="255" placeholder="e.g. Monthly rent, Supplier invoice">
        </div>
        <button class="btn btn-customer-login auth-submit-btn" type="submit" style="margin-top:10px;">
          <span>Authorize Transfer</span> <span>⚡</span>
        </button>
      </form>
    </div>
  `;

  $('#transferForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const result = await api('/api/customer/transfer', {
        method: 'POST',
        body: Object.fromEntries(new FormData(e.currentTarget).entries())
      });
      notify(`${result.message} Reference: ${result.reference}`, 'success', 'cust');
      renderCustomerView('accounts');
    } catch (err) {
      notify(err.message, 'error', 'cust');
    }
  };
}

function renderCustCardsView(c) {
  const cards = cachedCustomerData.cards || [];
  const card = cards[0];

  c.innerHTML = `
    <div class="cust-panel">
      <div class="cust-panel-header">
        <div>
          <h3>My Debit Cards & Security Controls</h3>
          <p style="font-size:0.85rem; color:#64748b;">Manage limits, view PIN status, and lock cards instantly</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px; align-items:center;">
        <div>
          <div class="visa-card-showcase" style="margin:0 auto;">
            <div class="visa-card-inner">
              <div class="vc-top">
                <span class="vc-bank">MAX GLOBAL PRIVATE BANK</span>
                <span class="vc-visa">VISA</span>
              </div>
              <div class="vc-chip-row">
                <div class="emv-gold-chip"></div>
                <span class="contactless-symbol">)))</span>
              </div>
              <div class="vc-number">${card ? escapeHtml(card.card_number) : '4532 •••• •••• 8901'}</div>
              <div class="vc-bottom">
                <div>
                  <small>CARDHOLDER</small>
                  <strong>${card ? escapeHtml(card.card_holder) : escapeHtml(currentUser.name.toUpperCase())}</strong>
                </div>
                <div>
                  <small>EXPIRES</small>
                  <strong>${card ? escapeHtml(card.expiry) : '12/30'}</strong>
                </div>
                <div class="vc-tier">INFINITE METAL</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="auth-field">
            <label>Card Standing</label>
            <div>
              <span class="acc-type-pill" style="background:${card?.is_locked ? '#fee2e2' : '#dcfce7'}; color:${card?.is_locked ? '#991b1b' : '#166534'}; font-size:0.85rem;">
                ${card?.is_locked ? '🔒 LOCKED (SECURITY ACTIVE)' : '✓ ACTIVE & READY FOR USE'}
              </span>
            </div>
          </div>

          <div style="margin:20px 0;">
            <button class="btn ${card?.is_locked ? 'btn-customer-login' : ''}" id="toggleCardLockBtn" style="${card?.is_locked ? '' : 'background:#fee2e2; color:#991b1b;'}">
              ${card?.is_locked ? '🔓 Unlock Card for Purchases' : '🔒 Temporarily Freeze Card'}
            </button>
          </div>

          <div class="auth-field">
            <label>Daily Spending Limit</label>
            <input value="${money(card?.daily_limit || 100000)}" readonly style="font-weight:700;">
          </div>
        </div>
      </div>
    </div>
  `;

  if (card && $('#toggleCardLockBtn')) {
    $('#toggleCardLockBtn').onclick = async () => {
      try {
        const res = await api('/api/customer/cards/toggle', {
          method: 'POST',
          body: { cardId: card.id }
        });
        notify(res.message, 'success', 'cust');
        renderCustomerView('cards');
      } catch (e) {
        notify(e.message, 'error', 'cust');
      }
    };
  }
}

function renderCustLoansView(c) {
  const loans = cachedCustomerData.loans || [];
  const s = publicContent.settings || {};
  const homeRate = s.home_loan_rate || '8.40';

  c.innerHTML = `
    <div class="cust-welcome-banner" style="background:linear-gradient(135deg, #78350f 0%, #b45309 100%);">
      <div>
        <span class="sub-heading" style="color:#fef3c7">INSTANT PRE-APPROVED CREDIT</span>
        <h2>Personal & Home Mortgages up to ₹25,00,000</h2>
        <p>Base interest starting from <strong>${homeRate}% p.a.</strong> • Zero documentation charges • Instant disbursement into your account</p>
      </div>
    </div>

    <div class="cust-panel" style="margin-bottom:28px;">
      <div class="cust-panel-header">
        <div>
          <h3>Instant Loan Sanction Calculator</h3>
          <p style="font-size:0.85rem; color:#64748b;">Select amount and tenure for immediate simulated disbursement</p>
        </div>
      </div>

      <form id="loanApplyForm" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; align-items:flex-end;">
        <div class="auth-field">
          <label>Loan Facility</label>
          <select name="loanType">
            <option value="Personal Growth Loan">Personal Growth Loan (8.50%)</option>
            <option value="Home Renovation Loan">Home Renovation Loan (${homeRate}%)</option>
            <option value="Automobile Car Loan">Automobile Vehicle Loan (8.75%)</option>
          </select>
        </div>
        <div class="auth-field">
          <label>Principal Amount (INR)</label>
          <input name="principal" type="number" min="20000" max="2500000" step="10000" value="500000" required>
        </div>
        <div class="auth-field">
          <label>Tenure (Months)</label>
          <select name="tenureMonths">
            <option value="12">12 Months (1 Year)</option>
            <option value="24">24 Months (2 Years)</option>
            <option value="36" selected>36 Months (3 Years)</option>
            <option value="60">60 Months (5 Years)</option>
          </select>
        </div>
        <button class="btn btn-customer-login" type="submit" style="grid-column:1/-1; padding:12px;">
          <span>Instant Pre-Approved Sanction & Disburse</span> <span>⚡</span>
        </button>
      </form>
    </div>

    <div class="cust-panel">
      <div class="cust-panel-header">
        <div>
          <h3>My Active Credit Facilities</h3>
          <p style="font-size:0.85rem; color:#64748b;">Sanctioned loans and monthly repayment schedules</p>
        </div>
      </div>

      <div class="cust-table-wrap">
        <table class="cust-table">
          <thead>
            <tr>
              <th>Loan Reference</th>
              <th>Category</th>
              <th>Sanctioned Principal</th>
              <th>Rate</th>
              <th>Tenure</th>
              <th>Monthly EMI</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${loans.length ? loans.map(l => `
              <tr>
                <td class="ref-code">${escapeHtml(l.loan_reference)}</td>
                <td><strong>${escapeHtml(l.loan_type)}</strong></td>
                <td><strong>${money(l.principal)}</strong></td>
                <td>${l.interest_rate}% p.a.</td>
                <td>${l.tenure_months} Mo.</td>
                <td style="color:#0284c7; font-weight:700;">${money(l.monthly_emi)}/mo</td>
                <td><span class="acc-type-pill" style="background:#dcfce7; color:#166534;">${escapeHtml(l.status.toUpperCase())}</span></td>
              </tr>
            `).join('') : '<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748b;">No active loans on file. Apply above for instant pre-approved credit.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#loanApplyForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const res = await api('/api/customer/loans/apply', {
        method: 'POST',
        body: Object.fromEntries(new FormData(e.currentTarget).entries())
      });
      notify(res.message, 'success', 'cust');
      renderCustomerView('accounts');
    } catch (err) {
      notify(err.message, 'error', 'cust');
    }
  };
}

function renderCustDepositsView(c) {
  const fds = cachedCustomerData.fds || [];
  const s = publicContent.settings || {};
  const fdRate = s.fd_rate || '7.85';

  c.innerHTML = `
    <div class="cust-welcome-banner" style="background:linear-gradient(135deg, #065f46 0%, #059669 100%);">
      <div>
        <span class="sub-heading" style="color:#a7f3d0">HIGH-YIELD FIXED DEPOSITS</span>
        <h2>Earn Guaranteed ${fdRate}% Annual Returns</h2>
        <p>Highest term deposit interest rates with quarterly compounding and sovereign capital security.</p>
      </div>
    </div>

    <div class="cust-panel" style="margin-bottom:28px;">
      <div class="cust-panel-header">
        <div>
          <h3>Book New Fixed Deposit</h3>
          <p style="font-size:0.85rem; color:#64748b;">Deducted from your savings balance with instant certificate issuance</p>
        </div>
      </div>

      <form id="fdCreateForm" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:flex-end;">
        <div class="auth-field">
          <label>Investment Amount (INR)</label>
          <input name="principal" type="number" min="5000" max="5000000" step="5000" value="100000" required>
        </div>
        <div class="auth-field">
          <label>Tenure & Interest Rate</label>
          <select name="tenureMonths">
            <option value="12" selected>12 Months (${fdRate}% p.a.)</option>
            <option value="24">24 Months (7.70% p.a.)</option>
            <option value="36">36 Months (7.50% p.a.)</option>
          </select>
        </div>
        <button class="btn btn-customer-login" type="submit" style="grid-column:1/-1; padding:12px;">
          <span>Issue Term Deposit Certificate</span> <span>→</span>
        </button>
      </form>
    </div>

    <div class="cust-panel">
      <div class="cust-panel-header">
        <div>
          <h3>My Term Fixed Deposits</h3>
          <p style="font-size:0.85rem; color:#64748b;">Active deposit certificates and guaranteed maturity payouts</p>
        </div>
      </div>

      <div class="cust-table-wrap">
        <table class="cust-table">
          <thead>
            <tr>
              <th>Certificate #</th>
              <th>Principal Amount</th>
              <th>Interest Rate</th>
              <th>Maturity Date</th>
              <th>Guaranteed Maturity Payout</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${fds.length ? fds.map(f => `
              <tr>
                <td class="ref-code">${escapeHtml(f.fd_number)}</td>
                <td><strong>${money(f.principal)}</strong></td>
                <td>${f.interest_rate}% p.a.</td>
                <td>${escapeHtml(f.maturity_date)}</td>
                <td style="color:#059669; font-weight:800;">${money(f.maturity_amount)}</td>
                <td><span class="acc-type-pill" style="background:#dcfce7; color:#166534;">${escapeHtml(f.status.toUpperCase())}</span></td>
              </tr>
            `).join('') : '<tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">No active Fixed Deposits. Book one above to grow your wealth.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#fdCreateForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const res = await api('/api/customer/fd/create', {
        method: 'POST',
        body: Object.fromEntries(new FormData(e.currentTarget).entries())
      });
      notify(res.message, 'success', 'cust');
      renderCustomerView('accounts');
    } catch (err) {
      notify(err.message, 'error', 'cust');
    }
  };
}

async function renderCustProfileView(c) {
  const d = await api('/api/customer/profile');
  const p = d.profile;

  c.innerHTML = `
    <div class="cust-panel" style="max-width:700px; margin:0 auto;">
      <div class="cust-panel-header">
        <div>
          <h3>Personal KYC & Profile Information</h3>
          <p style="font-size:0.85rem; color:#64748b;">Update your registered contact phone and address</p>
        </div>
      </div>

      <form id="custProfileForm">
        <div class="auth-field">
          <label>Full Legal Name</label>
          <input name="fullName" value="${escapeHtml(p.full_name)}" required minlength="2">
        </div>
        <div class="auth-field">
          <label>Registered Email</label>
          <input name="email" type="email" value="${escapeHtml(p.email)}" required>
        </div>
        <div class="auth-field">
          <label>Contact Phone Number</label>
          <input name="phone" value="${escapeHtml(p.phone)}" required minlength="7">
        </div>
        <div class="auth-field">
          <label>Residential Address</label>
          <textarea name="address" style="width:100%; height:80px; padding:10px; border:1px solid #cbd5e1; border-radius:8px;">${escapeHtml(p.address || '')}</textarea>
        </div>
        <button class="btn btn-customer-login auth-submit-btn" type="submit">Save Profile Updates</button>
      </form>
    </div>
  `;

  $('#custProfileForm').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/api/customer/profile', {
        method: 'PUT',
        body: Object.fromEntries(new FormData(e.currentTarget).entries())
      });
      currentUser.name = $('#custProfileForm [name=fullName]').value;
      $('#custUserName').textContent = currentUser.name;
      notify('Contact details updated successfully.', 'success', 'cust');
    } catch (err) {
      notify(err.message, 'error', 'cust');
    }
  };
}

function downloadStatementCsv() {
  api('/api/customer/statement.csv').catch(e => notify(e.message, 'error', 'cust'));
}

// ========================================================
// 6. BRANCH EMPLOYEE (STAFF) CONTROLLER (PRACTICAL & CLEAN)
// ========================================================
function renderEmployeeView(view) {
  playTone('click');
  activeEmployeeView = view;
  $$('.emp-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.empView === view));

  const titles = {
    search: 'Customer Lookup & Verification',
    onboard: 'Onboard New Customer (KYC Registration)',
    cash: 'Teller Cash Desk (Deposits & Withdrawals)',
    ledger: 'Branch Operational Transaction Ledger'
  };

  $('#empViewTitle').textContent = titles[view] || 'Branch Operations';
  const c = $('#empViewContent');

  if (view === 'search') renderEmpSearchView(c);
  else if (view === 'onboard') renderEmpOnboardView(c);
  else if (view === 'cash') renderEmpCashView(c);
  else if (view === 'ledger') renderEmpLedgerView(c);
}

async function renderEmpSearchView(c) {
  c.innerHTML = `
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
      <div style="display:flex; gap:12px; margin-bottom:20px;">
        <input id="empSearchInput" style="flex:1; padding:11px 14px; border:1px solid #cbd5e1; border-radius:8px;" placeholder="Search customer by name, email, customer code, or 12-digit account...">
        <button class="btn btn-staff-btn" id="empSearchBtn">Search Records</button>
      </div>

      <div id="empSearchResultsTable">
        <p style="text-align:center; color:#64748b; padding:20px;">Enter query to inspect customer records.</p>
      </div>
    </div>
  `;

  $('#empSearchBtn').onclick = loadEmpSearchResults;
  $('#empSearchInput').onkeydown = e => { if (e.key === 'Enter') loadEmpSearchResults(); };
  loadEmpSearchResults();
}

async function loadEmpSearchResults() {
  const q = $('#empSearchInput')?.value || '';
  try {
    const d = await api('/api/employee/customers?q=' + encodeURIComponent(q));
    const rows = d.customers;

    $('#empSearchResultsTable').innerHTML = `
      <table class="cust-table">
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Customer Code</th>
            <th>Account Number</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map(r => `
            <tr>
              <td><strong>${escapeHtml(r.full_name)}</strong><br><small style="color:#64748b">${escapeHtml(r.email)}</small></td>
              <td><code>${escapeHtml(r.customer_code)}</code></td>
              <td><code>${escapeHtml(r.account_number || '—')}</code></td>
              <td><strong>${money(r.balance)}</strong></td>
              <td><span class="acc-type-pill" style="background:#dcfce7; color:#166534;">${escapeHtml(r.account_status || r.status)}</span></td>
              <td><button class="btn btn-sm btn-staff-btn" onclick="openEmpCustomerModal(${r.id})">Edit KYC</button></td>
            </tr>
          `).join('') : '<tr><td colspan="6" style="text-align:center; padding:24px;">No customer records matching query.</td></tr>'}
        </tbody>
      </table>
    `;
  } catch (e) {
    notify(e.message, 'error', 'emp');
  }
}

async function openEmpCustomerModal(id) {
  try {
    const d = await api('/api/employee/customers/' + id);
    const cus = d.customer;
    const newName = prompt('Update Customer Name:', cus.full_name);
    if (!newName) return;
    const newPhone = prompt('Update Customer Phone:', cus.phone);
    if (!newPhone) return;

    await api('/api/employee/customers/' + id, {
      method: 'PUT',
      body: {
        fullName: newName,
        email: cus.email,
        phone: newPhone,
        address: cus.address
      }
    });
    notify('Customer record updated successfully.', 'success', 'emp');
    loadEmpSearchResults();
  } catch (e) {
    notify(e.message, 'error', 'emp');
  }
}

function renderEmpOnboardView(c) {
  c.innerHTML = `
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:28px; max-width:800px;">
      <h3 style="margin-bottom:6px;">New Customer KYC Registration</h3>
      <p style="font-size:0.85rem; color:#64748b; margin-bottom:20px;">Onboard a new walk-in customer into the branch database</p>

      <form id="empOnboardForm">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div class="auth-field">
            <label>Full Legal Name</label>
            <input name="fullName" required minlength="2" placeholder="Full Customer Name">
          </div>
          <div class="auth-field">
            <label>Email Address</label>
            <input name="email" type="email" required placeholder="customer@domain.com">
          </div>
          <div class="auth-field">
            <label>Phone Number</label>
            <input name="phone" required minlength="7" placeholder="+91 98765 43210">
          </div>
          <div class="auth-field">
            <label>Account Type</label>
            <select name="accountType">
              <option value="savings">Retail Savings Account</option>
              <option value="current">Commercial Current Account</option>
            </select>
          </div>
          <div class="auth-field" style="grid-column:1/-1;">
            <label>Residential Address</label>
            <input name="address" placeholder="Residential Street, District, Pin Code">
          </div>
          <div class="auth-field">
            <label>Initial Cash Deposit (INR)</label>
            <input name="initialDeposit" type="number" min="500" value="5000">
          </div>
        </div>
        <button class="btn btn-staff-btn" type="submit" style="margin-top:14px; padding:12px 24px;">Create Customer Record</button>
      </form>
    </div>
  `;

  $('#empOnboardForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const res = await api('/api/employee/customers', {
        method: 'POST',
        body: Object.fromEntries(new FormData(e.currentTarget).entries())
      });
      notify(`${res.message} Customer Code: ${res.customerCode}; Account: ${res.accountNumber}`, 'success', 'emp');
      renderEmployeeView('search');
    } catch (err) {
      notify(err.message, 'error', 'emp');
    }
  };
}

function renderEmpCashView(c) {
  c.innerHTML = `
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:28px; max-width:700px;">
      <h3 style="margin-bottom:6px;">Teller Cash Counter</h3>
      <p style="font-size:0.85rem; color:#64748b; margin-bottom:20px;">Process verified cash deposits and withdrawals</p>

      <form id="empCashForm">
        <div class="auth-field">
          <label>Operation Type</label>
          <select name="type">
            <option value="deposit">Cash Deposit (Credit to Account)</option>
            <option value="withdrawal">Cash Withdrawal (Debit from Account)</option>
          </select>
        </div>
        <div class="auth-field">
          <label>12-Digit Account Number</label>
          <input name="accountNumber" required pattern="\\d{12}" maxlength="12" placeholder="e.g. 100000000001">
        </div>
        <div class="auth-field">
          <label>Amount (INR)</label>
          <input name="amount" type="number" min="1" max="10000000" step="0.01" required placeholder="5000.00">
        </div>
        <div class="auth-field">
          <label>Teller Narrative Memo</label>
          <input name="description" placeholder="Branch counter cash transaction">
        </div>
        <button class="btn btn-staff-btn auth-submit-btn" type="submit">Commit Cash Operation</button>
      </form>
    </div>
  `;

  $('#empCashForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const res = await api('/api/employee/transactions', {
        method: 'POST',
        body: Object.fromEntries(new FormData(e.currentTarget).entries())
      });
      notify(`${res.message} Reference: ${res.reference}`, 'success', 'emp');
      e.currentTarget.reset();
    } catch (err) {
      notify(err.message, 'error', 'emp');
    }
  };
}

async function renderEmpLedgerView(c) {
  try {
    const d = await api('/api/employee/reports/transactions');
    c.innerHTML = `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3>Branch Transaction Ledger (Latest 500)</h3>
          <button class="btn btn-sm btn-staff-btn" onclick="api('/api/employee/reports/transactions.csv')">Export CSV</button>
        </div>
        <table class="cust-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${d.transactions.map(t => `
              <tr>
                <td class="ref-code">${escapeHtml(t.reference_code)}</td>
                <td><strong>${escapeHtml(t.transaction_type.toUpperCase())}</strong></td>
                <td><strong>${money(t.amount)}</strong></td>
                <td>${escapeHtml(t.from_account || '—')}</td>
                <td>${escapeHtml(t.to_account || '—')}</td>
                <td><span class="acc-type-pill" style="background:#dcfce7; color:#166534;">${escapeHtml(t.status)}</span></td>
                <td>${date(t.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    notify(e.message, 'error', 'emp');
  }
}

// ========================================================
// 7. MASTER ADMINISTRATOR TERMINAL ("SABHI KA BAAP")
// Full Authority over Everything Anytime + Rates & Offers Manager
// ========================================================
function renderAdminView(view) {
  playTone('click');
  activeAdminView = view;
  $$('.admin-nav-link').forEach(b => b.classList.toggle('active', b.dataset.adminView === view));

  const titles = {
    telemetry: 'System Telemetry & Live Infrastructure',
    'rates-offers': 'Bank Rates, Content & Festive Offers Manager',
    staff: 'Staff & Teller Force Management',
    accounts: 'Master Account Governance & Balance Overrides',
    audit: 'Cryptographic Security Audit Stream'
  };

  $('#adminViewTitle').textContent = titles[view] || 'Administrator Master Command';
  const c = $('#adminViewContent');

  if (view === 'telemetry') renderAdminTelemetryView(c);
  else if (view === 'rates-offers') renderAdminRatesOffersView(c);
  else if (view === 'staff') renderAdminStaffView(c);
  else if (view === 'accounts') renderAdminAccountsView(c);
  else if (view === 'audit') renderAdminAuditView(c);
}

async function renderAdminTelemetryView(c) {
  try {
    const summary = await api('/api/employee/summary');
    const gcp = await api('/api/gcp/status');

    c.innerHTML = `
      <div class="admin-metric-grid">
        <div class="admin-metric-box">
          <strong>${summary.customers}</strong>
          <small>Verified Active Customers</small>
        </div>
        <div class="admin-metric-box">
          <strong>${summary.accounts}</strong>
          <small>Ledger Accounts</small>
        </div>
        <div class="admin-metric-box">
          <strong>${money(summary.totalBalance)}</strong>
          <small>Total Bank Asset Reserves</small>
        </div>
        <div class="admin-metric-box">
          <strong>${summary.transactions30d}</strong>
          <small>Transactions (30 Days)</small>
        </div>
      </div>

      <div class="admin-card-glass" style="margin-bottom:24px;">
        <h3 style="color:var(--admin-cyan); margin-bottom:12px;">Google Cloud Platform Infrastructure</h3>
        <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:18px;">Real-time enterprise node connection telemetry</p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
          <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px;">
            <small style="color:#64748b;">CLOUD HOSTING</small>
            <div style="color:#fff; font-weight:700;">${escapeHtml(gcp.service)}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px;">
            <small style="color:#64748b;">TARGET REGION</small>
            <div style="color:#fff; font-weight:700;">${escapeHtml(gcp.region)}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px;">
            <small style="color:#64748b;">ACTIVE DATABASE ENGINE</small>
            <div style="color:var(--admin-cyan); font-weight:700;">${escapeHtml(gcp.databaseEngine)}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px;">
            <small style="color:#64748b;">AI CORE STATUS</small>
            <div style="color:#10b981; font-weight:700;">${escapeHtml(gcp.aiStatus.provider)}</div>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

// --- Admin Rates & Offers Manager ---
async function renderAdminRatesOffersView(c) {
  try {
    const sData = await api('/api/admin/settings');
    const oData = await api('/api/admin/offers');
    const settings = sData.settings || [];
    const offers = oData.offers || [];

    c.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1.2fr; gap:24px;">
        <!-- Rates Management Form -->
        <div class="admin-card-glass">
          <h3 style="color:var(--admin-cyan); margin-bottom:8px;">Live Bank Interest Rates Manager</h3>
          <p style="color:#94a3b8; font-size:0.82rem; margin-bottom:18px;">Modifications update the public site, calculators & customer portal immediately.</p>

          <form id="adminRatesForm">
            ${settings.map(s => `
              <div class="auth-field" style="margin-bottom:12px;">
                <label style="color:#cbd5e1; font-size:0.75rem;">${escapeHtml(s.description || s.setting_key)}</label>
                <div style="display:flex; gap:8px;">
                  <input id="setting_${escapeHtml(s.setting_key)}" value="${escapeHtml(s.setting_value)}" style="background:rgba(255,255,255,0.05); color:#fff; border-color:rgba(0,242,254,0.3)">
                  <button type="button" class="btn btn-sm btn-sentinel-ai" onclick="adminSaveSingleSetting('${s.setting_key}')">Update</button>
                </div>
              </div>
            `).join('')}
          </form>
        </div>

        <!-- Festive Offers Manager -->
        <div class="admin-card-glass">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 style="color:var(--admin-cyan)">Festive Offers & Deals</h3>
              <p style="color:#94a3b8; font-size:0.82rem;">Create promotional deals shown to customers & website visitors</p>
            </div>
            <button class="btn btn-sentinel-ai btn-sm" id="adminCreateOfferBtn">+ Add New Offer</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px;">
            ${offers.map(o => `
              <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(0,242,254,0.2); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="color:#fff; font-size:0.9rem;">${escapeHtml(o.title)}</strong>
                  <div style="font-size:0.75rem; color:#94a3b8;">${escapeHtml(o.category)} • <code>${escapeHtml(o.promo_code)}</code> • <span style="color:var(--admin-cyan)">${escapeHtml(o.discount_badge)}</span></div>
                </div>
                <button class="btn btn-sm" style="background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.3)" onclick="adminDeleteOffer(${o.id})">Delete</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    $('#adminCreateOfferBtn').onclick = adminCreateOfferPrompt;
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function adminSaveSingleSetting(key) {
  const val = $('#setting_' + key)?.value;
  if (val === undefined) return;
  try {
    const res = await api('/api/admin/settings', {
      method: 'PUT',
      body: { key, value: val }
    });
    notify(res.message, 'success', 'admin');
    await loadPublicContent();
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function adminCreateOfferPrompt() {
  const title = prompt('Offer Title (e.g. Diwali Home Loan Special):');
  if (!title) return;
  const category = prompt('Category: Loans, Wealth, Cards, or Privileges:', 'Loans');
  if (!category) return;
  const badge = prompt('Discount Badge (e.g. Zero Processing Fee):', 'ZERO Fee');
  if (!badge) return;
  const description = prompt('Offer Description:');
  if (!description) return;
  const promoCode = prompt('Promo Code (e.g. DIWALI2026):', 'DIWALI2026');
  if (!promoCode) return;

  try {
    const res = await api('/api/admin/offers', {
      method: 'POST',
      body: { title, category, badge, description, promoCode }
    });
    notify(res.message, 'success', 'admin');
    await loadPublicContent();
    renderAdminView('rates-offers');
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function adminDeleteOffer(id) {
  if (!confirm('Are you sure you want to delete this promotional offer?')) return;
  try {
    const res = await api('/api/admin/offers/' + id, { method: 'DELETE' });
    notify(res.message, 'success', 'admin');
    await loadPublicContent();
    renderAdminView('rates-offers');
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function renderAdminStaffView(c) {
  try {
    const d = await api('/api/admin/employees');
    const employees = d.employees;

    c.innerHTML = `
      <div class="admin-card-glass">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div>
            <h3 style="color:var(--admin-cyan)">Staff Force Control</h3>
            <p style="color:#94a3b8; font-size:0.82rem;">Create, inspect, promote, and revoke branch staff credentials</p>
          </div>
          <button class="btn btn-sentinel-ai btn-sm" id="hireStaffBtn">+ Hire / Add Staff Member</button>
        </div>

        <table class="cust-table" style="color:#fff;">
          <thead>
            <tr style="color:#94a3b8;">
              <th>Employee ID</th>
              <th>Full Name</th>
              <th>Username</th>
              <th>Role Authority</th>
              <th>Assigned Branch</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(e => `
              <tr>
                <td><code>${escapeHtml(e.employee_code)}</code></td>
                <td><strong>${escapeHtml(e.full_name)}</strong></td>
                <td><code>${escapeHtml(e.username)}</code></td>
                <td>
                  <span class="acc-type-pill" style="background:${e.role === 'admin' ? 'rgba(244,63,94,0.2)' : 'rgba(0,242,254,0.15)'}; color:${e.role === 'admin' ? '#fb7185' : 'var(--admin-cyan)'};">
                    ${escapeHtml(e.role.toUpperCase())}
                  </span>
                </td>
                <td>${escapeHtml(e.branch || 'Headquarters')}</td>
                <td><span style="color:${e.status === 'active' ? '#10b981' : '#ef4444'}">● ${escapeHtml(e.status.toUpperCase())}</span></td>
                <td>
                  ${e.username !== currentUser.username ? `
                    <button class="btn btn-sm" style="background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.3)" onclick="revokeEmployee(${e.id})">
                      Revoke
                    </button>
                  ` : '<small style="color:#64748b;">(Current Admin)</small>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    $('#hireStaffBtn').onclick = hireStaffPrompt;
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function hireStaffPrompt() {
  const name = prompt('Employee Full Legal Name:');
  if (!name) return;
  const username = prompt('Staff Username (4+ chars):');
  if (!username) return;
  const password = prompt('Staff Password (8+ chars):', 'Staff123!');
  if (!password) return;
  const role = prompt('Role: teller, manager, or admin:', 'teller');
  if (!role) return;

  try {
    const res = await api('/api/admin/employees', {
      method: 'POST',
      body: { fullName: name, username, password, role }
    });
    notify(res.message, 'success', 'admin');
    renderAdminView('staff');
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function revokeEmployee(id) {
  if (!confirm('Are you sure you want to permanently revoke this staff member credentials?')) return;
  try {
    await api('/api/admin/employees/' + id, { method: 'DELETE' });
    notify('Employee credentials permanently revoked.', 'success', 'admin');
    renderAdminView('staff');
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function renderAdminAccountsView(c) {
  try {
    const d = await api('/api/employee/customers');
    const customers = d.customers;

    c.innerHTML = `
      <div class="admin-card-glass">
        <div style="margin-bottom:20px;">
          <h3 style="color:var(--admin-cyan)">Master Account Authority & Controls</h3>
          <p style="color:#94a3b8; font-size:0.82rem;">Freeze/Unfreeze any customer account, or execute emergency balance adjustments</p>
        </div>

        <table class="cust-table" style="color:#fff;">
          <thead>
            <tr style="color:#94a3b8;">
              <th>Customer</th>
              <th>Account Number</th>
              <th>Current Balance</th>
              <th>Account Standing</th>
              <th>Master Actions</th>
            </tr>
          </thead>
          <tbody>
            ${customers.map(cus => `
              <tr>
                <td><strong>${escapeHtml(cus.full_name)}</strong><br><small style="color:#64748b">${escapeHtml(cus.email)}</small></td>
                <td><code>${escapeHtml(cus.account_number || '—')}</code></td>
                <td><strong style="color:var(--admin-cyan)">${money(cus.balance)}</strong></td>
                <td>
                  <span class="acc-type-pill" style="background:${cus.account_status === 'frozen' ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}; color:${cus.account_status === 'frozen' ? '#fb7185' : '#34d399'};">
                    ${escapeHtml((cus.account_status || cus.status).toUpperCase())}
                  </span>
                </td>
                <td style="display:flex; gap:8px;">
                  <button class="btn btn-sm" style="background:rgba(0,242,254,0.15); color:var(--admin-cyan); border:1px solid rgba(0,242,254,0.3)" onclick="adminToggleAccountStatus(${cus.id}, '${cus.account_status}')">
                    ${cus.account_status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                  </button>
                  <button class="btn btn-sm" style="background:rgba(139,92,246,0.15); color:#c084fc; border:1px solid rgba(139,92,246,0.3)" onclick="adminAdjustBalance(${cus.id})">
                    Override Balance
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function adminToggleAccountStatus(accountId, currentStatus) {
  const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';
  try {
    const res = await api(`/api/admin/accounts/${accountId}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    });
    notify(res.message, 'success', 'admin');
    renderAdminView('accounts');
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function adminAdjustBalance(accountId) {
  const amountStr = prompt('Enter new exact balance amount (INR):');
  if (!amountStr) return;
  const balance = parseFloat(amountStr);
  if (isNaN(balance)) return alert('Invalid amount');

  try {
    const res = await api(`/api/admin/accounts/${accountId}/adjust-balance`, {
      method: 'POST',
      body: { balance, reason: 'Executive Balance Override' }
    });
    notify(res.message, 'success', 'admin');
    renderAdminView('accounts');
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

async function renderAdminAuditView(c) {
  try {
    const d = await api('/api/admin/audit');
    c.innerHTML = `
      <div class="admin-card-glass">
        <h3 style="color:var(--admin-cyan); margin-bottom:12px;">Cryptographic Security Audit Log Stream</h3>
        <p style="color:#94a3b8; font-size:0.82rem; margin-bottom:20px;">Real-time ledger of staff actions, customer registrations, and administrative changes</p>

        <table class="cust-table" style="color:#fff;">
          <thead>
            <tr style="color:#94a3b8;">
              <th>Timestamp</th>
              <th>Actor Role & ID</th>
              <th>Action Event</th>
              <th>Target Entity</th>
              <th>Details</th>
              <th>IP Origin</th>
            </tr>
          </thead>
          <tbody>
            ${d.logs.map(l => `
              <tr>
                <td style="font-family:var(--font-mono); font-size:0.75rem">${date(l.created_at)}</td>
                <td><strong>${escapeHtml(l.actor_role)}</strong> <small>(#${escapeHtml(l.actor_id || '—')})</small></td>
                <td style="color:var(--admin-cyan); font-weight:700;">${escapeHtml(l.action)}</td>
                <td>${escapeHtml(l.entity_type)}</td>
                <td style="font-family:var(--font-mono); font-size:0.75rem; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(typeof l.details === 'string' ? l.details : JSON.stringify(l.details || {}))}</td>
                <td>${escapeHtml(l.ip_address || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    notify(e.message, 'error', 'admin');
  }
}

// ========================================================
// 8. ROLE-AWARE AI ASSISTANT FLYOUT
// ========================================================
const AI_PERSONAS = {
  guest: {
    name: 'AURA VIRTUAL CONCIERGE',
    tag: 'Max Global Bank Advisor & Assistant',
    chips: [
      { text: '📈 3-in-1 Demat & Stock Trading', prompt: 'Tell me about 3-in-1 Demat and zero brokerage trading' },
      { text: '🏛️ PPF & NPS Govt Schemes', prompt: 'What are the benefits of PPF and NPS government schemes?' },
      { text: '💰 Fixed Deposit 7.85% Returns', prompt: 'What are the returns on a 1-year Fixed Deposit of ₹1,00,000?' },
      { text: '📊 Home Loan EMI Calculator', prompt: 'Calculate home loan EMI for 3000000 at 8.4% for 20 years' },
      { text: '🎁 Active Festive Offers 2026', prompt: 'What are the current festive offers and fee waivers?' },
      { text: '💳 Max Infinite Visa Metal Card', prompt: 'What privileges come with the Max Infinite Metal card?' }
    ],
    greeting: 'Welcome to Max Global Private Bank! I am Aura, your 24/7 AI banking concierge.'
  },
  customer: {
    name: 'AURA BANKING ASSISTANT',
    tag: '24/7 Personal Wealth & Loan Concierge',
    chips: [
      { text: '💎 Check my account balance', prompt: 'What is my current account balance and standing?' },
      { text: '📈 3-in-1 Demat & Stock Trading', prompt: 'How do I activate my 3-in-1 Demat and zero brokerage stock trading?' },
      { text: '🏛️ PPF & NPS Tax Deductions', prompt: 'Explain PPF 7.10% tax-free returns and NPS Section 80CCD benefits' },
      { text: '📊 Calculate loan EMI for ₹10,00,000', prompt: 'Calculate loan EMI for 1000000 at 8.4% for 15 years' },
      { text: '💰 Fixed Deposit 7.85% returns', prompt: 'What are the returns on a 1-year Fixed Deposit of ₹1,00,000?' },
      { text: '🚀 How to transfer funds', prompt: 'How do I transfer funds to another account?' }
    ],
    greeting: 'Welcome to Max Global Private Bank! I am Aura, your personal AI wealth assistant.'
  },
  teller: {
    name: 'NEXUS OPS COPILOT',
    tag: 'Branch Operations & KYC Assistant',
    chips: [
      { text: '📋 Customer KYC requirements', prompt: 'What are the KYC verification requirements for new customers?' },
      { text: '💵 Teller cash limits', prompt: 'What are the teller cash deposit and withdrawal limits?' },
      { text: '🚨 Suspicious transaction protocol', prompt: 'What is the procedure for reporting suspicious transaction velocity?' }
    ],
    greeting: 'Nexus Ops active. Standing by to assist with KYC verification rules, teller cash limits, and branch compliance.'
  },
  admin: {
    name: 'SENTINEL CORE AI',
    tag: 'Executive Risk & Infrastructure Sentinel',
    chips: [
      { text: '🛡️ Audit anomaly review', prompt: 'Analyze security anomalies and audit logs' },
      { text: '🔒 Show frozen/restricted accounts', prompt: 'Show restricted or frozen accounts' },
      { text: '📊 Executive metrics summary', prompt: 'Executive metrics summary of system volume' },
      { text: '🌐 Google Cloud readiness status', prompt: 'GCP deployment status and cloud readiness' }
    ],
    greeting: 'Sentinel Core root terminal online. Monitoring system telemetry, security audit logs, and account access flags.'
  }
};

function setupAiAssistantPersona() {
  const role = currentUser ? (currentUser.role || 'customer') : 'guest';
  const persona = AI_PERSONAS[role] || AI_PERSONAS.guest;

  $('#aiDrawerPersonaName').textContent = persona.name;
  $('#aiDrawerPersonaTag').textContent = persona.tag;

  const shelf = $('#aiChipsShelf');
  shelf.innerHTML = persona.chips.map(c => `
    <button class="ai-shelf-chip" data-query="${escapeHtml(c.prompt)}">${escapeHtml(c.text)}</button>
  `).join('');

  $$('.ai-shelf-chip', shelf).forEach(b => {
    b.onclick = () => {
      $('#aiChatInput').value = b.dataset.query;
      handleAiSubmit();
    };
  });

  if (!aiChatHistory.length) {
    const now = new Date();
    const hour = now.getHours();
    const timeWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const displayName = currentUser ? (currentUser.name || currentUser.username) : 'Valued Client';
    const liveGreeting = `${timeWord}, ${displayName}! Welcome to Max Global Private Bank. I am Aura, your 24/7 personal wealth, loan, and investment concierge. How may I assist your portfolio today?`;
    appendAiMsg('assistant', liveGreeting);
  }
}

function openAiDrawer() {
  playTone('click');
  setupAiAssistantPersona();
  $('#aiModalBackdrop').classList.remove('hidden');
  setTimeout(() => $('#aiChatInput')?.focus(), 150);
}

function closeAiDrawer() {
  $('#aiModalBackdrop').classList.add('hidden');
}

function formatAiMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Headers: ###, ##, #
  html = html.replace(/^### (.*$)/gim, '<h4 style="margin:10px 0 4px; color:#0f172a; font-weight:800; font-size:0.96rem;">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="margin:12px 0 6px; color:#0f172a; font-weight:800; font-size:1.05rem;">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="margin:14px 0 8px; color:#0f172a; font-weight:800; font-size:1.15rem;">$1</h2>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a; font-weight:700;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em style="color:#475569;">$1</em>');

  // Inline Code
  html = html.replace(/`(.*?)`/g, '<code style="background:#f1f5f9; color:#1e40af; padding:2px 6px; border-radius:4px; font-weight:700; font-family:monospace; font-size:0.85em;">$1</code>');

  // Bullet items
  html = html.replace(/^[•\-\*] (.*$)/gim, '<div style="margin:4px 0 4px 10px; display:flex; gap:6px;"><span>•</span><span>$1</span></div>');

  // Numbered list items
  html = html.replace(/^(\d+)\. (.*$)/gim, '<div style="margin:4px 0 4px 10px; display:flex; gap:6px;"><strong style="color:#1e40af;">$1.</strong><span>$2</span></div>');

  // Paragraph & Line breaks
  html = html.replace(/\n\n+/g, '<div style="margin-bottom:8px;"></div>');
  html = html.replace(/\n/g, '<br>');

  return html;
}

function appendAiMsg(role, text) {
  const thread = $('#aiChatThread');
  const div = document.createElement('div');
  div.className = `ai-chat-bubble ai-bubble-${role}`;
  if (role === 'assistant') {
    div.innerHTML = formatAiMarkdown(text);
  } else {
    div.textContent = text;
  }
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

async function handleAiSubmit() {
  const input = $('#aiChatInput');
  const msg = input.value.trim();
  if (!msg) return;

  playTone('click');
  appendAiMsg('user', msg);
  input.value = '';

  const thread = $('#aiChatThread');
  const typing = document.createElement('div');
  typing.className = 'ai-chat-bubble ai-bubble-assistant';
  typing.innerHTML = '<span style="color:#64748b; font-style:italic;">Processing intelligent query…</span>';
  thread.appendChild(typing);
  thread.scrollTop = thread.scrollHeight;

  try {
    const res = await api('/api/ai/chat', {
      method: 'POST',
      body: { message: msg, history: aiChatHistory }
    });

    typing.remove();
    aiChatHistory.push({ role: 'user', content: msg });
    aiChatHistory.push({ role: 'assistant', content: res.text });
    appendAiMsg('assistant', res.text);
    playTone('success');
  } catch (e) {
    typing.remove();
    appendAiMsg('assistant', 'Error communicating with AI service: ' + e.message);
  }
}

// ========================================================
// 9. EVENT BINDINGS & APP INITIALIZATION
// ========================================================
// Public site navigation items
$$('[data-public-page]').forEach(el => {
  el.onclick = e => {
    e.preventDefault();
    renderPublicPage(el.dataset.publicPage);
  };
});

// Modal triggers
$('#navOpenLoginBtn').onclick = () => openPortalModal('customer');
$('#mobOpenLoginBtn').onclick = () => openPortalModal('customer');
$('#mobOpenAccountBtn').onclick = () => openInstantAccountModal('savings');
$('#footCustLogin').onclick = e => { e.preventDefault(); openPortalModal('customer'); };
$('#footStaffLogin').onclick = e => { e.preventDefault(); openPortalModal('employee'); };
$('#footOpenAccLink').onclick = e => { e.preventDefault(); openInstantAccountModal('savings'); };

// Staff Portal Top Ribbon Link
if ($('#ribbonStaffLink')) {
  $('#ribbonStaffLink').onclick = e => {
    e.preventDefault();
    openPortalModal('employee');
  };
}

// 24x7 Fraud Hotline Modal Trigger
if ($('#footFraudHotline')) {
  $('#footFraudHotline').onclick = e => {
    e.preventDefault();
    showFraudHotlineModal();
  };
}

// Feature Modal Close Trigger
if ($('#closeFeatureModal')) {
  $('#closeFeatureModal').onclick = closeFeatureModal;
}

// Mobile Flyout Menu
$('#mobMenuBtn').onclick = () => $('#mobileFlyout').classList.remove('hidden');
$('#closeFlyout').onclick = () => $('#mobileFlyout').classList.add('hidden');

// Auth Dialog Controls
$('#closeAuth').onclick = closePortalModal;
$$('.p-tab').forEach(tab => {
  tab.onclick = () => {
    activePortalChoice = tab.dataset.portal;
    renderAuthModal();
  };
});

// Sound Toggle
$('#soundToggle').onclick = toggleAudio;

// Customer Navigation
$$('.c-nav-link').forEach(b => b.onclick = () => renderCustomerView(b.dataset.custView));
$$('.c-dock-btn[data-cust-view]').forEach(b => b.onclick = () => renderCustomerView(b.dataset.custView));
$('#custLogoutBtn').onclick = logoutClient;

// Employee Navigation
$$('.emp-nav-btn').forEach(b => b.onclick = () => renderEmployeeView(b.dataset.empView));
$('#empLogoutBtn').onclick = logoutClient;
$('#empAiTriggerBtn').onclick = openAiDrawer;

// Admin Navigation
$$('.admin-nav-link').forEach(b => b.onclick = () => renderAdminView(b.dataset.adminView));
$('#adminLogoutBtn').onclick = logoutClient;
$('#adminAiTriggerBtn').onclick = openAiDrawer;

// AI Assistant
$('#floatingAiBtn').onclick = openAiDrawer;
$('#custOpenAiBtn').onclick = openAiDrawer;
$('#aiCloseChatBtn').onclick = closeAiDrawer;
$('#aiClearChatBtn').onclick = () => {
  aiChatHistory = [];
  $('#aiChatThread').innerHTML = '';
  setupAiAssistantPersona();
};
$('#aiChatForm').onsubmit = e => {
  e.preventDefault();
  handleAiSubmit();
};

// Click outside backdrop to dismiss
if ($('#authModal')) {
  $('#authModal').onclick = e => { if (e.target.id === 'authModal') closePortalModal(); };
}
if ($('#featureModalBackdrop')) {
  $('#featureModalBackdrop').onclick = e => { if (e.target.id === 'featureModalBackdrop') closeFeatureModal(); };
}

// Global delegated listener for public page links
document.addEventListener('click', e => {
  const target = e.target.closest('[data-public-page]');
  if (target) {
    e.preventDefault();
    returnToPublicSite();
    renderPublicPage(target.dataset.publicPage);
  }
});

// URL Hash routing listener
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'admin' || hash === 'admin-login') {
    if (currentUser && currentUser.role === 'admin') {
      routeUserToPortal();
    } else {
      openPortalModal('admin');
    }
  } else if (hash === 'staff') {
    if (currentUser && ['employee', 'teller', 'manager'].includes(currentUser.role)) {
      routeUserToPortal();
    } else {
      openPortalModal('employee');
    }
  } else if (hash === 'netbanking' || hash === 'portal' || hash === 'dashboard') {
    if (currentUser && currentUser.role === 'customer') {
      routeUserToPortal();
    } else {
      openPortalModal('customer');
    }
  } else if (['home', 'personal', 'wealth', 'govtsavings', 'trading', 'loans', 'cards', 'offers', 'security'].includes(hash)) {
    returnToPublicSite();
    renderPublicPage(hash);
  }
});

// Escape key to dismiss modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePortalModal();
    closeFeatureModal();
    closeAiDrawer();
    $('#mobileFlyout').classList.add('hidden');
  }
});

// Explicitly bind all public action functions to window for resilient template button execution
window.renderPublicPage = renderPublicPage;
window.openPortalModal = openPortalModal;
window.closePortalModal = closePortalModal;
window.openFeatureModal = openFeatureModal;
window.closeFeatureModal = closeFeatureModal;
window.openInstantAccountModal = openInstantAccountModal;
window.handleInstantAccountSubmit = handleInstantAccountSubmit;
window.openDepositBookingModal = openDepositBookingModal;
window.handleFdBookingSubmit = handleFdBookingSubmit;
window.openCardApplicationModal = openCardApplicationModal;
window.handleCardApplicationSubmit = handleCardApplicationSubmit;
window.openLoanApplicationModal = openLoanApplicationModal;
window.handleLoanApplicationSubmit = handleLoanApplicationSubmit;
window.showMetalCardSpecsModal = showMetalCardSpecsModal;
window.showLoungeNetworkModal = showLoungeNetworkModal;
window.showOfferClaimModal = showOfferClaimModal;
window.claimOfferById = claimOfferById;
window.showFraudHotlineModal = showFraudHotlineModal;
window.showRbiCharterModal = showRbiCharterModal;
window.showDicgcModal = showDicgcModal;
window.showSecuritySpecsModal = showSecuritySpecsModal;
window.showNodalOfficerModal = showNodalOfficerModal;
window.openDepositModal = openDepositModal;
window.openLoanModal = openLoanModal;
window.openGovtSchemeModal = openGovtSchemeModal;
window.handleGovtSchemeSubmit = handleGovtSchemeSubmit;
window.openDematApplicationModal = openDematApplicationModal;
window.handleDematSubmit = handleDematSubmit;
window.renderPageGovtSavings = renderPageGovtSavings;
window.renderPageTrading = renderPageTrading;
window.proceedToDeposit = proceedToDeposit;
window.proceedToLoan = proceedToLoan;
window.proceedToCardManagement = proceedToCardManagement;
window.returnToPublicSite = returnToPublicSite;
window.routeUserToPortal = routeUserToPortal;
window.logoutClient = logoutClient;
window.toggleAudio = toggleAudio;
window.updatePublicHeaderAuth = updatePublicHeaderAuth;

// Bootstrap application on load
(async () => {
  await loadPublicContent();
  try {
    const me = await api('/api/auth/me');
    csrfToken = me.csrfToken || '';
    if (me.user) {
      currentUser = me.user;
    }
  } catch (_) {
    currentUser = null;
  }

  updatePublicHeaderAuth();

  // Check initial URL hash for direct entry
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash === 'admin' || initialHash === 'admin-login') {
    if (currentUser && currentUser.role === 'admin') {
      routeUserToPortal();
    } else {
      renderPublicPage('home');
      openPortalModal('admin');
    }
  } else if (initialHash === 'staff') {
    if (currentUser && ['employee', 'teller', 'manager'].includes(currentUser.role)) {
      routeUserToPortal();
    } else {
      renderPublicPage('home');
      openPortalModal('employee');
    }
  } else if (initialHash === 'netbanking' || initialHash === 'portal' || initialHash === 'dashboard') {
    if (currentUser && currentUser.role === 'customer') {
      routeUserToPortal();
    } else {
      renderPublicPage('home');
      openPortalModal('customer');
    }
  } else if (['personal', 'wealth', 'govtsavings', 'trading', 'loans', 'cards', 'offers', 'security'].includes(initialHash)) {
    renderPublicPage(initialHash);
  } else {
    // Default: Always render the public home page
    renderPublicPage('home');
  }
})();
