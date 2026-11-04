require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const db = require('./db');
const { createSessionStore } = require('./session-store');
const ai = require('./ai-service');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Enable reverse proxy trust (critical for Render, Cloud Run, Heroku HTTPS session cookies)
app.set('trust proxy', 1);

// Disable x-powered-by
app.disable('x-powered-by');

// Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

// Setup Session Middleware
const sessionStore = createSessionStore();
app.use(session({
  name: 'mgpb.sid',
  secret: process.env.SESSION_SECRET || 'max-global-private-bank-quantum-hyper-secure-secret-2026-key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 4 // 4 hours
  }
}));

// Rate limiting for auth routes
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
}));

// Strict brute-force prevention limiter for credential verification
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
function safeUser(req) {
  if (!req.session.user) return null;
  return {
    id: req.session.user.id,
    name: req.session.user.name,
    role: req.session.user.role,
    username: req.session.user.username,
    csrfToken: req.session.csrfToken
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient privileges.' });
    }
    next();
  };
}

function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/ai/chat') return next();
  const token = req.get('x-csrf-token');
  const sessionToken = req.session.csrfToken;
  if (!token || !sessionToken) {
    return res.status(403).json({ error: 'Security token invalid or expired. Refresh and retry.' });
  }
  const tokenBuf = Buffer.from(token);
  const sessionBuf = Buffer.from(sessionToken);
  if (tokenBuf.length !== sessionBuf.length || !crypto.timingSafeEqual(tokenBuf, sessionBuf)) {
    return res.status(403).json({ error: 'Security verification failed. Please try again.' });
  }
  next();
}

app.use('/api', requireCsrf);

async function audit(req, action, entityType, entityId, details = {}) {
  const u = req.session.user;
  try {
    await db.execute(
      'INSERT INTO audit_logs (actor_role, actor_id, action, entity_type, entity_id, details, ip_address) VALUES (?,?,?,?,?,?,?)',
      [
        u?.role || 'system',
        u?.id || null,
        action,
        entityType,
        entityId == null ? null : String(entityId),
        JSON.stringify(details),
        req.ip || '127.0.0.1'
      ]
    );
  } catch (err) {
    console.error('Audit log exception:', err.message);
  }
}

function newRef(prefix = 'TXN') {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function validAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 100000000 && Math.round(n * 100) === n * 100 ? n : null;
}

function cleanText(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function makeCsrf(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
}

// ==========================================
// SYSTEM STATUS APIS
// ==========================================

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      ok: true,
      bank: 'Max Global Private Bank',
      status: 'Online',
      database: db.getDriver(),
      cloudReady: true,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(503).json({ ok: false, error: 'Database service unavailable: ' + e.message });
  }
});

// Public Dynamic Content (Rates, Offers & RBI Compliance Info)
app.get('/api/public/content', async (req, res, next) => {
  try {
    const [settingsRows] = await db.query('SELECT setting_key, setting_value, description FROM bank_settings');
    const settings = {};
    for (const r of settingsRows) {
      settings[r.setting_key] = r.setting_value;
    }
    const [offers] = await db.query('SELECT * FROM bank_offers WHERE is_active = 1 ORDER BY id DESC');
    res.json({ settings, offers });
  } catch (e) {
    next(e);
  }
});

app.get('/api/gcp/status', (req, res) => {
  res.json({
    bankName: 'Max Global Private Bank',
    cloudProvider: 'Google Cloud Platform (GCP)',
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'max-global-bank-cloud',
    region: process.env.GOOGLE_CLOUD_REGION || 'asia-south1 (Mumbai)',
    service: 'Google Cloud Run',
    databaseEngine: db.getDriver() === 'mysql' ? 'Google Cloud SQL (MySQL 8.4)' : 'Core Embedded Database Engine',
    aiStatus: ai.getAiStatus()
  });
});

// ==========================================
// AI ASSISTANT APIS
// ==========================================

app.get('/api/ai/status', (req, res) => {
  res.json(ai.getAiStatus());
});

app.post('/api/ai/chat', async (req, res, next) => {
  try {
    const message = cleanText(req.body.message, 1000);
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const user = req.session.user || { role: 'guest', name: 'Valued Guest' };
    const response = await ai.processChatMessage(user, message, history);
    try {
      await audit(req, 'AI_INQUIRY', 'ai_assistant', user.id || 'guest', {
        role: user.role,
        provider: response.provider,
        promptSnippet: message.slice(0, 50)
      });
    } catch {}

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// AUTHENTICATION APIS
// ==========================================

app.get('/api/auth/me', (req, res) => {
  makeCsrf(req);
  res.json({ user: safeUser(req), csrfToken: req.session.csrfToken });
});

app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const username = cleanText(req.body.username, 60);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const portal = req.body.portal || 'customer';

    if (!username || !password) {
      return res.status(400).json({ error: 'Enter both username and password.' });
    }

    let user;
    if (portal === 'employee' || portal === 'admin') {
      const [rows] = await db.execute(
        'SELECT id, full_name, username, password_hash, role, status FROM employees WHERE username=? LIMIT 1',
        [username]
      );
      const row = rows[0];
      if (row && row.status === 'active' && await bcrypt.compare(password, row.password_hash)) {
        // Enforce strict admin portal access
        if (portal === 'admin' && row.role !== 'admin') {
          return res.status(403).json({ error: 'Access restricted: Executive Administrator credentials required.' });
        }
        user = { id: row.id, name: row.full_name, username: row.username, role: row.role };
      }
    } else {
      // Customer Portal
      const [rows] = await db.execute(
        `SELECT cc.id, cc.username, cc.password_hash, c.id as customer_id, c.full_name, c.status
         FROM customer_credentials cc
         JOIN customers c ON c.id=cc.customer_id
         WHERE cc.username=? LIMIT 1`,
        [username]
      );
      const row = rows[0];
      if (row && row.status === 'active' && await bcrypt.compare(password, row.password_hash)) {
        user = { id: row.customer_id, name: row.full_name, username: row.username, role: 'customer' };
      }
    }

    if (!user) {
      await audit(req, 'LOGIN_FAILED', 'auth', username, { portal });
      return res.status(401).json({ error: 'Invalid credentials or inactive account status.' });
    }

    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = user;
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      req.session.save(async saveErr => {
        if (saveErr) return next(saveErr);
        try { await audit(req, 'LOGIN_SUCCESS', 'auth', user.id, { portal }); } catch {}
        res.json({ user: safeUser(req) });
      });
    });
  } catch (e) {
    next(e);
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
  try {
    await audit(req, 'LOGOUT', 'auth', req.session.user.id);
    req.session.destroy(err => {
      if (err) return next(err);
      res.clearCookie('mgpb.sid', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
      res.json({ ok: true });
    });
  } catch (e) {
    next(e);
  }
});

app.post('/api/auth/register', loginLimiter, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const fullName = cleanText(req.body.fullName, 120);
    const email = cleanText(req.body.email, 190).toLowerCase();
    const phone = cleanText(req.body.phone, 25);
    const address = cleanText(req.body.address, 255);
    const username = cleanText(req.body.username, 60);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (
      fullName.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.length < 7 ||
      username.length < 4 ||
      !/^[a-zA-Z0-9._-]+$/.test(username) ||
      password.length < 8
    ) {
      return res.status(400).json({ error: 'Invalid details. Username: 4+ alphanumeric chars; Password: 8+ chars.' });
    }

    await conn.beginTransaction();
    const customerCode = 'CUS' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const accountNumber = '100' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');

    const [c] = await conn.execute(
      'INSERT INTO customers (customer_code, full_name, email, phone, address) VALUES (?,?,?,?,?)',
      [customerCode, fullName, email, phone, address]
    );

    const customerId = c.insertId;
    const hash = await bcrypt.hash(password, 12);

    await conn.execute(
      'INSERT INTO customer_credentials (customer_id, username, password_hash) VALUES (?,?,?)',
      [customerId, username, hash]
    );

    // Initial welcome balance for new customer account
    const [acc] = await conn.execute(
      'INSERT INTO accounts (account_number, customer_id, account_type, balance) VALUES (?,?,"savings",25000.00)',
      [accountNumber, customerId]
    );

    // Issue instant virtual Visa card
    const cardNum = '4532 ' + Array.from({ length: 12 }, (_, i) => (i % 4 === 0 ? ' ' : '') + Math.floor(Math.random() * 10)).join('').trim();
    await conn.execute(
      'INSERT INTO cards (customer_id, account_id, card_number, card_holder, expiry, cvv, card_type, daily_limit, is_locked) VALUES (?,?,?,?,"12/30","821","Platinum Visa Debit",50000,0)',
      [customerId, acc.insertId, cardNum, fullName.toUpperCase()]
    );

    await conn.commit();
    await audit(req, 'CUSTOMER_REGISTERED', 'customer', customerId, { customerCode });
    res.status(201).json({
      ok: true,
      message: 'Account successfully registered and verified.',
      customerCode,
      accountNumber
    });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or username is already registered.' });
    }
    next(e);
  } finally {
    conn.release();
  }
});

// ==========================================
// CUSTOMER PORTAL APIS
// ==========================================

app.get('/api/customer/dashboard', requireRole('customer'), async (req, res, next) => {
  try {
    const [accounts] = await db.execute(
      'SELECT id, account_number, account_type, balance, status, ifsc_code, created_at FROM accounts WHERE customer_id=? ORDER BY id',
      [req.session.user.id]
    );

    const ids = accounts.map(a => a.id);
    let transactions = [];

    if (ids.length) {
      const marks = ids.map(() => '?').join(',');
      const [rows] = await db.execute(
        `SELECT t.reference_code, t.transaction_type, t.amount, t.description, t.status, t.created_at,
          fa.account_number as from_account, ta.account_number as to_account
         FROM transactions t
         LEFT JOIN accounts fa ON fa.id=t.from_account_id
         LEFT JOIN accounts ta ON ta.id=t.to_account_id
         WHERE t.from_account_id IN (${marks}) OR t.to_account_id IN (${marks})
         ORDER BY t.created_at DESC LIMIT 25`,
        [...ids, ...ids]
      );
      transactions = rows;
    }

    const [cards] = await db.execute('SELECT * FROM cards WHERE customer_id=?', [req.session.user.id]);
    const [loans] = await db.execute('SELECT * FROM loans WHERE customer_id=?', [req.session.user.id]);
    const [fds] = await db.execute('SELECT * FROM fixed_deposits WHERE customer_id=?', [req.session.user.id]);

    res.json({ accounts, transactions, cards, loans, fds });
  } catch (e) {
    next(e);
  }
});

app.get('/api/customer/profile', requireRole('customer'), async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT customer_code, full_name, email, phone, address, status, created_at FROM customers WHERE id=?',
      [req.session.user.id]
    );
    res.json({ profile: rows[0] });
  } catch (e) {
    next(e);
  }
});

app.put('/api/customer/profile', requireRole('customer'), async (req, res, next) => {
  try {
    const fullName = cleanText(req.body.fullName, 120);
    const email = cleanText(req.body.email, 190).toLowerCase();
    const phone = cleanText(req.body.phone, 25);
    const address = cleanText(req.body.address, 255);

    if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 7) {
      return res.status(400).json({ error: 'Please enter a valid full name, email, and phone number.' });
    }

    await db.execute(
      'UPDATE customers SET full_name=?, email=?, phone=?, address=? WHERE id=?',
      [fullName, email, phone, address, req.session.user.id]
    );

    req.session.user.name = fullName;
    await audit(req, 'PROFILE_UPDATED', 'customer', req.session.user.id);
    res.json({ ok: true, message: 'Profile updated successfully.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email address is already in use.' });
    next(e);
  }
});

// Customer Password Change
app.post('/api/customer/change-password', requireRole('customer'), async (req, res, next) => {
  try {
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const [rows] = await db.execute(
      'SELECT id, password_hash FROM customer_credentials WHERE customer_id=? LIMIT 1',
      [req.session.user.id]
    );
    const row = rows[0];
    if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
      return res.status(401).json({ error: 'Current password does not match records.' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.execute(
      'UPDATE customer_credentials SET password_hash=? WHERE customer_id=?',
      [newHash, req.session.user.id]
    );

    await audit(req, 'PASSWORD_CHANGED', 'customer', req.session.user.id);
    
    // Create in-app security notification
    try {
      await db.execute(
        'INSERT INTO notifications (user_role, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        ['customer', req.session.user.id, 'Security Alert: Password Updated', 'Your NetBanking credentials were changed successfully. If you did not initiate this change, contact fraud prevention immediately.', 'security']
      );
    } catch (_) {}

    res.json({ ok: true, message: 'Password updated successfully. Please use your new password next time you sign in.' });
  } catch (e) {
    next(e);
  }
});

// Customer In-App Notifications
app.get('/api/customer/notifications', requireRole('customer'), async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_role="customer" AND user_id=? ORDER BY id DESC LIMIT 50',
      [req.session.user.id]
    );
    res.json({ notifications: rows });
  } catch (e) {
    next(e);
  }
});

app.post('/api/customer/notifications/mark-read', requireRole('customer'), async (req, res, next) => {
  try {
    await db.execute(
      'UPDATE notifications SET is_read=1 WHERE user_role="customer" AND user_id=?',
      [req.session.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Customer Support Tickets
app.get('/api/customer/tickets', requireRole('customer'), async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, ticket_code, subject, category, message, status, priority, staff_reply, created_at, updated_at FROM support_tickets WHERE customer_id=? ORDER BY id DESC',
      [req.session.user.id]
    );
    res.json({ tickets: rows });
  } catch (e) {
    next(e);
  }
});

app.post('/api/customer/tickets', requireRole('customer'), async (req, res, next) => {
  try {
    const subject = cleanText(req.body.subject, 120);
    const category = cleanText(req.body.category, 50) || 'General Banking Inquiry';
    const message = cleanText(req.body.message, 1000);
    const priority = ['low', 'medium', 'high', 'urgent'].includes(req.body.priority) ? req.body.priority : 'medium';

    if (!subject || !message) {
      return res.status(400).json({ error: 'Please provide both subject and detailed description.' });
    }

    const ticketCode = 'TCK-' + new Date().getFullYear() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    await db.execute(
      'INSERT INTO support_tickets (ticket_code, customer_id, customer_name, subject, category, message, status, priority) VALUES (?, ?, ?, ?, ?, ?, "open", ?)',
      [ticketCode, req.session.user.id, req.session.user.name, subject, category, message, priority]
    );

    await audit(req, 'TICKET_CREATED', 'support_ticket', ticketCode, { subject, category });
    res.status(201).json({ ok: true, ticketCode, message: 'Support ticket registered. A bank officer will review shortly.' });
  } catch (e) {
    next(e);
  }
});

app.post('/api/customer/transfer', requireRole('customer'), async (req, res, next) => {
  const amount = validAmount(req.body.amount);
  const toNumber = cleanText(req.body.toAccount, 12);
  const description = cleanText(req.body.description || 'Fund Transfer', 255);

  if (!amount || !/^\d{12}$/.test(toNumber)) {
    return res.status(400).json({ error: 'Enter a valid amount and 12-digit destination account number.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [fromRows] = await conn.execute(
      'SELECT id, account_number, balance, status FROM accounts WHERE customer_id=? ORDER BY id LIMIT 1',
      [req.session.user.id]
    );
    const [toRows] = await conn.execute(
      'SELECT id, account_number, status FROM accounts WHERE account_number=?',
      [toNumber]
    );

    const from = fromRows[0];
    const to = toRows[0];

    if (!from || !to || from.account_number === toNumber || from.status !== 'active' || to.status !== 'active') {
      await conn.rollback();
      return res.status(400).json({ error: 'Source or destination account is inactive or unavailable.' });
    }

    if (Number(from.balance) < amount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient account balance.' });
    }

    await conn.execute('UPDATE accounts SET balance=balance-? WHERE id=?', [amount, from.id]);
    await conn.execute('UPDATE accounts SET balance=balance+? WHERE id=?', [amount, to.id]);

    const reference = newRef('TXN');
    await conn.execute(
      'INSERT INTO transactions (reference_code, from_account_id, to_account_id, transaction_type, amount, description, initiated_by_role, initiated_by_id) VALUES (?,?,?,?,"transfer",?, "customer",?)',
      [reference, from.id, to.id, amount, description, req.session.user.id]
    );

    await conn.commit();
    await audit(req, 'FUND_TRANSFER', 'transaction', reference, { amount, toAccount: toNumber });
    res.json({ ok: true, reference, message: 'Transfer processed successfully.' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// Customer Card Controls
app.post('/api/customer/cards/toggle', requireRole('customer'), async (req, res, next) => {
  try {
    const cardId = req.body.cardId;
    const [cards] = await db.execute('SELECT id, is_locked FROM cards WHERE id=? AND customer_id=?', [cardId, req.session.user.id]);
    if (!cards.length) return res.status(404).json({ error: 'Card not found.' });

    const newLockStatus = cards[0].is_locked ? 0 : 1;
    await db.execute('UPDATE cards SET is_locked=? WHERE id=?', [newLockStatus, cardId]);
    await audit(req, newLockStatus ? 'CARD_LOCKED' : 'CARD_UNLOCKED', 'card', cardId);
    res.json({ ok: true, is_locked: newLockStatus, message: newLockStatus ? 'Debit card locked.' : 'Debit card unlocked.' });
  } catch (e) { next(e); }
});

// Customer Instant Loan Sanction
app.post('/api/customer/loans/apply', requireRole('customer'), async (req, res, next) => {
  const principal = validAmount(req.body.principal);
  const loanType = cleanText(req.body.loanType || 'Personal Growth Loan', 60);
  const tenureMonths = Number(req.body.tenureMonths || 36);
  const rate = Number(req.body.rate || 8.5);

  if (!principal || principal > 2500000) {
    return res.status(400).json({ error: 'Invalid loan amount. Maximum pre-approved ceiling is ₹25,00,000.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [accs] = await conn.execute('SELECT id, account_number, balance FROM accounts WHERE customer_id=? ORDER BY id LIMIT 1', [req.session.user.id]);
    if (!accs.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'No active savings account found to disburse loan.' });
    }
    const acc = accs[0];

    const monthlyRate = (rate / 12) / 100;
    const emi = Math.round((principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1));
    const loanRef = 'LOAN-' + Date.now().toString(36).toUpperCase();

    await conn.execute(
      'INSERT INTO loans (loan_reference, customer_id, account_id, loan_type, principal, interest_rate, tenure_months, monthly_emi, status) VALUES (?,?,?,?,?,?,?,?,\'approved\')',
      [loanRef, req.session.user.id, acc.id, loanType, principal, rate, tenureMonths, emi]
    );

    // Disburse loan funds directly into savings account
    await conn.execute('UPDATE accounts SET balance=balance+? WHERE id=?', [principal, acc.id]);

    const txRef = newRef('DISB');
    await conn.execute(
      'INSERT INTO transactions (reference_code, from_account_id, to_account_id, transaction_type, amount, description, initiated_by_role, initiated_by_id) VALUES (?,NULL,?,\'deposit\',?, \'Instant Loan Sanction Disbursement\', \'system\', 1)',
      [txRef, acc.id, principal]
    );

    await conn.commit();
    await audit(req, 'LOAN_SANCTIONED', 'loan', loanRef, { principal, emi });
    res.json({ ok: true, loanRef, principal, emi, message: `Congratulations! ${loanType} sanctioned. ₹${principal.toLocaleString('en-IN')} credited to your account.` });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// Customer Fixed Deposit Creation
app.post('/api/customer/fd/create', requireRole('customer'), async (req, res, next) => {
  const principal = validAmount(req.body.principal);
  const tenureMonths = Number(req.body.tenureMonths || 12);
  const rate = 7.85; // 7.85% p.a.

  if (!principal || principal < 5000) {
    return res.status(400).json({ error: 'Minimum Fixed Deposit investment is ₹5,000.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [accs] = await conn.execute('SELECT id, balance FROM accounts WHERE customer_id=? ORDER BY id LIMIT 1', [req.session.user.id]);
    const acc = accs[0];
    if (!acc || Number(acc.balance) < principal) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient savings account balance to book Fixed Deposit.' });
    }

    await conn.execute('UPDATE accounts SET balance=balance-? WHERE id=?', [principal, acc.id]);

    const maturityAmount = Math.round(principal * Math.pow(1 + (rate / 100) / 4, (4 * tenureMonths) / 12));
    const fdNum = 'FD-BLOK-' + Math.floor(1000 + Math.random() * 9000);
    const maturityDate = new Date(Date.now() + tenureMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await conn.execute(
      'INSERT INTO fixed_deposits (fd_number, customer_id, account_id, principal, interest_rate, tenure_months, maturity_amount, maturity_date, status) VALUES (?,?,?,?,?,?,?,?,\'active\')',
      [fdNum, req.session.user.id, acc.id, principal, rate, tenureMonths, maturityAmount, maturityDate]
    );

    await conn.commit();
    await audit(req, 'FD_CREATED', 'fixed_deposit', fdNum, { principal, maturityAmount });
    res.json({ ok: true, fdNum, maturityAmount, maturityDate, message: `Fixed Deposit Certificate ${fdNum} issued successfully.` });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

app.get('/api/customer/statement.csv', requireRole('customer'), async (req, res, next) => {
  try {
    const [accounts] = await db.execute('SELECT id FROM accounts WHERE customer_id=?', [req.session.user.id]);
    const ids = accounts.map(a => a.id);
    let rows = [];

    if (ids.length) {
      const marks = ids.map(() => '?').join(',');
      const [r] = await db.execute(
        `SELECT t.reference_code, t.transaction_type, t.amount, t.description, t.status, t.created_at,
         fa.account_number as from_account, ta.account_number as to_account
         FROM transactions t
         LEFT JOIN accounts fa ON fa.id=t.from_account_id
         LEFT JOIN accounts ta ON ta.id=t.to_account_id
         WHERE t.from_account_id IN (${marks}) OR t.to_account_id IN (${marks})
         ORDER BY t.created_at DESC`,
        [...ids, ...ids]
      );
      rows = r;
    }

    const fields = ['reference_code', 'transaction_type', 'amount', 'description', 'status', 'created_at', 'from_account', 'to_account'];
    const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="max-global-bank-statement.csv"');
    res.send([fields.join(','), ...rows.map(r => fields.map(f => csvCell(r[f])).join(','))].join('\r\n'));
    await audit(req, 'STATEMENT_EXPORTED', 'customer', req.session.user.id);
  } catch (e) {
    next(e);
  }
});

app.get('/api/customer/statement.html', requireRole('customer'), async (req, res, next) => {
  try {
    const [custRows] = await db.execute('SELECT customer_code, full_name, email, phone, address FROM customers WHERE id=?', [req.session.user.id]);
    const cust = custRows[0] || {};
    const [accRows] = await db.execute('SELECT id, account_number, account_type, balance, ifsc_code FROM accounts WHERE customer_id=? ORDER BY id', [req.session.user.id]);
    const acc = accRows[0] || {};

    const [txRows] = await db.execute(
      `SELECT t.reference_code, t.transaction_type, t.amount, t.description, t.status, t.created_at,
       fa.account_number as from_account, ta.account_number as to_account
       FROM transactions t
       LEFT JOIN accounts fa ON fa.id=t.from_account_id
       LEFT JOIN accounts ta ON ta.id=t.to_account_id
       WHERE t.from_account_id=? OR t.to_account_id=?
       ORDER BY t.created_at DESC LIMIT 100`,
      [acc.id || 0, acc.id || 0]
    );

    const txHtml = txRows.map(r => `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-family:monospace;">${String(r.created_at).slice(0, 16)}</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-family:monospace; font-weight:600;">${r.reference_code}</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${r.description || r.transaction_type.toUpperCase()}</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-transform:uppercase;">${r.transaction_type}</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700; color:${r.to_account === acc.account_number ? '#059669' : '#e11d48'};">
          ${r.to_account === acc.account_number ? '+' : '-'}₹${Number(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `).join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Official Bank Statement — ${cust.full_name || 'Customer'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 40px; margin: 0; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 20px; }
    .badge { background: #eff6ff; color: #1e40af; padding: 4px 10px; font-weight: 700; border-radius: 4px; font-size: 11px; text-transform: uppercase; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0; background: #f8fafc; padding: 18px; border-radius: 8px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 20px; }
    th { text-align: left; padding: 10px; background: #0f172a; color: #fff; font-size: 12px; }
    .print-bar { margin-bottom: 20px; text-align: right; }
    .print-btn { background: #1e40af; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    @media print { .print-bar { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="header">
    <div>
      <h1 style="margin:0; font-size:24px; color:#1e40af;">MAX GLOBAL PRIVATE BANK</h1>
      <p style="margin:4px 0 0; font-size:12px; color:#64748b;">Scheduled Commercial Bank Regulated by Reserve Bank of India (RBI/2026/MGPB-8842)</p>
      <p style="margin:2px 0 0; font-size:12px; color:#64748b;">DICGC Deposit Protection Guarantee up to ₹5,00,000</p>
    </div>
    <div style="text-align:right;">
      <span class="badge">Official Statement (Demo)</span>
      <p style="margin:8px 0 0; font-size:12px; color:#64748b;">Generated: ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>

  <div class="info-grid">
    <div>
      <strong>Account Holder:</strong> ${cust.full_name || 'N/A'}<br>
      <strong>Customer Code:</strong> ${cust.customer_code || 'N/A'}<br>
      <strong>Registered Email:</strong> ${cust.email || 'N/A'}<br>
      <strong>Mobile:</strong> ${cust.phone || 'N/A'}
    </div>
    <div>
      <strong>Account Number:</strong> ${acc.account_number || 'N/A'}<br>
      <strong>Account Type:</strong> ${(acc.account_type || 'Savings').toUpperCase()}<br>
      <strong>IFSC Code:</strong> ${acc.ifsc_code || 'MGPB0000042'}<br>
      <strong>Current Cleared Balance:</strong> <span style="font-weight:700; color:#059669;">₹${Number(acc.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    </div>
  </div>

  <h3 style="font-size:15px; margin:20px 0 10px; border-bottom:1px solid #cbd5e1; padding-bottom:6px;">Transaction History Summary</h3>
  <table>
    <thead>
      <tr>
        <th>Date / Time</th>
        <th>Reference Code</th>
        <th>Description</th>
        <th>Type</th>
        <th style="text-align:right;">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      ${txHtml || '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No transaction records found for this period.</td></tr>'}
    </tbody>
  </table>

  <div style="margin-top:40px; border-top:1px dashed #cbd5e1; padding-top:15px; font-size:11px; color:#94a3b8; text-align:center;">
    This is an educational simulation statement generated by Max Global Private Bank Management Demo Platform.
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    next(e);
  }
});

// ==========================================
// EMPLOYEE & BRANCH OPS APIS
// ==========================================

app.get('/api/employee/summary', requireRole('employee', 'admin', 'manager', 'teller'), async (req, res, next) => {
  try {
    const [[customers]] = await db.query('SELECT COUNT(*) as total FROM customers');
    const [[accounts]] = await db.query('SELECT COUNT(*) as total, COALESCE(SUM(balance),0) as balance FROM accounts');
    const [[tx]] = await db.query("SELECT COUNT(*) as total FROM transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const [[active]] = await db.query("SELECT COUNT(*) as total FROM accounts WHERE status='active'");

    res.json({
      customers: customers.total,
      accounts: accounts.total,
      totalBalance: accounts.balance,
      transactions30d: tx.total,
      activeAccounts: active.total,
      role: req.session.user.role,
      engine: db.getDriver()
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/employee/customers', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  try {
    const q = cleanText(req.query.q, 80);
    const like = '%' + q + '%';
    const [rows] = await db.execute(
      `SELECT c.id, c.customer_code, c.full_name, c.email, c.phone, c.address, c.status, c.created_at,
        a.account_number, a.account_type, a.balance, a.status as account_status
       FROM customers c
       LEFT JOIN accounts a ON a.customer_id=c.id
       WHERE (?='' OR c.full_name LIKE ? OR c.email LIKE ? OR c.customer_code LIKE ? OR a.account_number LIKE ?)
       ORDER BY c.created_at DESC LIMIT 200`,
      [q, like, like, like, like]
    );
    res.json({ customers: rows });
  } catch (e) {
    next(e);
  }
});

app.get('/api/employee/customers/:id', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT c.id, c.customer_code, c.full_name, c.email, c.phone, c.address, c.status, c.created_at,
        a.id as account_id, a.account_number, a.account_type, a.balance, a.status as account_status
       FROM customers c
       LEFT JOIN accounts a ON a.customer_id=c.id
       WHERE c.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer record not found.' });
    res.json({ customer: rows[0] });
  } catch (e) {
    next(e);
  }
});

app.post('/api/employee/customers', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  const fullName = cleanText(req.body.fullName, 120);
  const email = cleanText(req.body.email, 190).toLowerCase();
  const phone = cleanText(req.body.phone, 25);
  const address = cleanText(req.body.address, 255);
  const accountType = req.body.accountType === 'current' ? 'current' : 'savings';
  const initialDeposit = Number(req.body.initialDeposit || 1000);

  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 7) {
    return res.status(400).json({ error: 'Enter valid customer KYC details.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const code = 'CUS' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const accountNo = '100' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');

    const [c] = await conn.execute(
      'INSERT INTO customers (customer_code, full_name, email, phone, address) VALUES (?,?,?,?,?)',
      [code, fullName, email, phone, address]
    );

    const [acc] = await conn.execute(
      'INSERT INTO accounts (account_number, customer_id, account_type, balance) VALUES (?,?,?,?)',
      [accountNo, c.insertId, accountType, initialDeposit]
    );

    // Initial debit card issuance
    const cardNum = '4532 ' + Array.from({ length: 12 }, (_, i) => (i % 4 === 0 ? ' ' : '') + Math.floor(Math.random() * 10)).join('').trim();
    await conn.execute(
      'INSERT INTO cards (customer_id, account_id, card_number, card_holder, expiry, cvv, card_type, daily_limit, is_locked) VALUES (?,?,?,?,"12/30","552","Platinum Visa Debit",50000,0)',
      [c.insertId, acc.insertId, cardNum, fullName.toUpperCase()]
    );

    await conn.commit();
    await audit(req, 'CUSTOMER_ONBOARDED', 'customer', c.insertId, { code, accountNo });
    res.status(201).json({ ok: true, customerCode: code, accountNumber: accountNo, message: 'Customer onboarded successfully.' });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email or customer code already exists in records.' });
    next(e);
  } finally {
    conn.release();
  }
});

app.put('/api/employee/customers/:id', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  try {
    const fullName = cleanText(req.body.fullName, 120);
    const email = cleanText(req.body.email, 190).toLowerCase();
    const phone = cleanText(req.body.phone, 25);
    const address = cleanText(req.body.address, 255);

    if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 7) {
      return res.status(400).json({ error: 'Enter valid customer details.' });
    }

    const [result] = await db.execute(
      'UPDATE customers SET full_name=?, email=?, phone=?, address=? WHERE id=?',
      [fullName, email, phone, address, req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Customer not found.' });
    await audit(req, 'CUSTOMER_UPDATED', 'customer', req.params.id, { fields: ['full_name', 'email', 'phone', 'address'] });
    res.json({ ok: true, message: 'Customer record updated.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email is already used by another record.' });
    next(e);
  }
});

// Teller Cash & Transactions
app.post('/api/employee/transactions', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  const type = req.body.type;
  const accountNumber = cleanText(req.body.accountNumber, 12);
  const amount = validAmount(req.body.amount);
  const description = cleanText(req.body.description || 'Teller Cash Operation', 255);

  if (!['deposit', 'withdrawal'].includes(type) || !/^\d{12}$/.test(accountNumber) || !amount) {
    return res.status(400).json({ error: 'Enter a valid transaction type, 12-digit account and amount.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute('SELECT id, balance, status FROM accounts WHERE account_number=?', [accountNumber]);
    const account = rows[0];

    if (!account || account.status !== 'active') {
      await conn.rollback();
      return res.status(400).json({ error: 'Account not found or restricted.' });
    }

    if (type === 'withdrawal' && Number(account.balance) < amount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient funds in customer account.' });
    }

    if (type === 'deposit') {
      await conn.execute('UPDATE accounts SET balance=balance+? WHERE id=?', [amount, account.id]);
    } else {
      await conn.execute('UPDATE accounts SET balance=balance-? WHERE id=?', [amount, account.id]);
    }

    const reference = newRef('CSH');
    await conn.execute(
      'INSERT INTO transactions (reference_code, from_account_id, to_account_id, transaction_type, amount, description, initiated_by_role, initiated_by_id) VALUES (?,?,?,?,?,?, "employee",?)',
      [
        reference,
        type === 'withdrawal' ? account.id : null,
        type === 'deposit' ? account.id : null,
        type,
        amount,
        description,
        req.session.user.id
      ]
    );

    await conn.commit();
    await audit(req, 'TELLER_' + type.toUpperCase(), 'transaction', reference, { accountNumber, amount });
    res.json({ ok: true, reference, message: `Cash ${type} of ₹${amount.toLocaleString('en-IN')} completed.` });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

app.get('/api/employee/reports/transactions', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT t.reference_code, t.transaction_type, t.amount, t.description, t.status, t.created_at,
       fa.account_number as from_account, ta.account_number as to_account, t.initiated_by_role
       FROM transactions t
       LEFT JOIN accounts fa ON fa.id=t.from_account_id
       LEFT JOIN accounts ta ON ta.id=t.to_account_id
       ORDER BY t.created_at DESC LIMIT 500`
    );
    res.json({ transactions: rows });
  } catch (e) {
    next(e);
  }
});

app.get('/api/employee/reports/transactions.csv', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT t.reference_code, t.transaction_type, t.amount, t.description, t.status, t.created_at,
       fa.account_number as from_account, ta.account_number as to_account, t.initiated_by_role
       FROM transactions t
       LEFT JOIN accounts fa ON fa.id=t.from_account_id
       LEFT JOIN accounts ta ON ta.id=t.to_account_id
       ORDER BY t.created_at DESC LIMIT 500`
    );
    const fields = ['reference_code', 'transaction_type', 'amount', 'description', 'status', 'created_at', 'from_account', 'to_account', 'initiated_by_role'];
    const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="max-global-bank-transactions-report.csv"');
    res.send([fields.join(','), ...rows.map(r => fields.map(f => csvCell(r[f])).join(','))].join('\r\n'));
    await audit(req, 'TRANSACTION_REPORT_EXPORTED', 'report', 'transactions');
  } catch (e) {
    next(e);
  }
});

// Employee & Admin Support Tickets Queue
app.get('/api/employee/tickets', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, ticket_code, customer_id, customer_name, subject, category, message, status, priority, staff_reply, created_at, updated_at FROM support_tickets ORDER BY CASE status WHEN "open" THEN 1 WHEN "in_progress" THEN 2 ELSE 3 END, id DESC'
    );
    res.json({ tickets: rows });
  } catch (e) {
    next(e);
  }
});

app.post('/api/employee/tickets/:id/reply', requireRole('admin', 'manager', 'teller'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const staffReply = cleanText(req.body.reply, 1000);
    const status = ['open', 'in_progress', 'resolved', 'closed'].includes(req.body.status) ? req.body.status : 'resolved';

    if (!staffReply) {
      return res.status(400).json({ error: 'Reply text cannot be empty.' });
    }

    const [rows] = await db.execute('SELECT id, customer_id, ticket_code FROM support_tickets WHERE id=? LIMIT 1', [ticketId]);
    const ticket = rows[0];
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    await db.execute(
      'UPDATE support_tickets SET staff_reply=?, status=?, updated_at=datetime(\'now\') WHERE id=?',
      [staffReply, status, ticketId]
    );

    // Notify customer
    try {
      await db.execute(
        'INSERT INTO notifications (user_role, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        ['customer', ticket.customer_id, `Support Ticket ${ticket.ticket_code} Updated`, `Branch Officer response: ${staffReply.slice(0, 80)}... Status: ${status.toUpperCase()}`, 'support']
      );
    } catch (_) {}

    await audit(req, 'TICKET_REPLIED', 'support_ticket', ticketId, { status });
    res.json({ ok: true, message: 'Ticket response posted and customer notified.' });
  } catch (e) {
    next(e);
  }
});

// ==========================================
// MASTER ADMINISTRATOR APIS ("SABHI KA BAAP")
// Full Authority over Employees, Accounts & System
// ==========================================

app.get('/api/admin/employees', requireRole('admin'), async (req, res, next) => {
  try {
    const [employees] = await db.query('SELECT id, employee_code, full_name, username, role, status, branch, created_at FROM employees ORDER BY id ASC');
    res.json({ employees });
  } catch (e) { next(e); }
});

app.post('/api/admin/employees', requireRole('admin'), async (req, res, next) => {
  try {
    const fullName = cleanText(req.body.fullName, 120);
    const username = cleanText(req.body.username, 60);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = ['teller', 'manager', 'admin'].includes(req.body.role) ? req.body.role : 'teller';
    const branch = cleanText(req.body.branch || 'Central Branch', 120);

    if (fullName.length < 2 || username.length < 4 || password.length < 8) {
      return res.status(400).json({ error: 'Username must be 4+ characters; Password must be 8+ characters.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const code = 'EMP' + Math.floor(1000 + Math.random() * 9000);

    const [result] = await db.execute(
      'INSERT INTO employees (employee_code, full_name, username, password_hash, role, branch, status) VALUES (?,?,?,?,?,?,\'active\')',
      [code, fullName, username, hash, role, branch]
    );

    await audit(req, 'EMPLOYEE_HIRED', 'employee', result.insertId, { code, role, username });
    res.status(201).json({ ok: true, employeeCode: code, message: `Staff member ${fullName} (${role.toUpperCase()}) added successfully.` });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Employee username already in use.' });
    next(e);
  }
});

app.patch('/api/admin/employees/:id/status', requireRole('admin'), async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    // Prevent admin from locking their own account
    if (Number(req.params.id) === Number(req.session.user.id)) {
      return res.status(400).json({ error: 'You cannot revoke your own active administrator session.' });
    }

    await db.execute('UPDATE employees SET status=? WHERE id=?', [status, req.params.id]);
    await audit(req, 'EMPLOYEE_STATUS_CHANGED', 'employee', req.params.id, { status });
    res.json({ ok: true, message: `Employee status changed to ${status}.` });
  } catch (e) { next(e); }
});

app.delete('/api/admin/employees/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (Number(req.params.id) === Number(req.session.user.id)) {
      return res.status(400).json({ error: 'Cannot terminate current active administrator.' });
    }
    await db.execute('DELETE FROM employees WHERE id=?', [req.params.id]);
    await audit(req, 'EMPLOYEE_TERMINATED', 'employee', req.params.id);
    res.json({ ok: true, message: 'Employee credentials permanently revoked.' });
  } catch (e) { next(e); }
});

app.patch('/api/admin/accounts/:id/status', requireRole('admin'), async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!['active', 'frozen', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid account status option.' });
    }

    const [result] = await db.execute('UPDATE accounts SET status=? WHERE id=?', [status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Account not found.' });

    await audit(req, 'MASTER_ACCOUNT_STATUS_OVERRIDE', 'account', req.params.id, { status });
    res.json({ ok: true, message: `Account status updated to [${status.toUpperCase()}].` });
  } catch (e) {
    next(e);
  }
});

app.post('/api/admin/accounts/:id/adjust-balance', requireRole('admin'), async (req, res, next) => {
  const newBalance = validAmount(req.body.balance);
  const reason = cleanText(req.body.reason || 'Executive Liquidity Adjustment', 255);

  if (newBalance === null) return res.status(400).json({ error: 'Invalid balance amount.' });

  try {
    await db.execute('UPDATE accounts SET balance=? WHERE id=?', [newBalance, req.params.id]);
    await audit(req, 'MASTER_BALANCE_OVERRIDE', 'account', req.params.id, { newBalance, reason });
    res.json({ ok: true, message: `Account balance overridden to ₹${newBalance.toLocaleString('en-IN')}.` });
  } catch (e) { next(e); }
});

app.get('/api/admin/audit', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, actor_role, actor_id, action, entity_type, entity_id, details, ip_address, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 300'
    );
    res.json({ logs: rows });
  } catch (e) {
    next(e);
  }
});

// Admin Bank Rates & Settings Management
app.get('/api/admin/settings', requireRole('admin'), async (req, res, next) => {
  try {
    const [settings] = await db.query('SELECT * FROM bank_settings ORDER BY setting_key ASC');
    res.json({ settings });
  } catch (e) { next(e); }
});

app.put('/api/admin/settings', requireRole('admin'), async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'Setting key and value are required.' });

    await db.execute(
      'REPLACE INTO bank_settings (setting_key, setting_value) VALUES (?, ?)',
      [cleanText(key, 60), cleanText(String(value), 255)]
    );

    await audit(req, 'SETTING_UPDATED', 'system', key, { key, value });
    res.json({ ok: true, message: `Setting ${key} updated successfully.` });
  } catch (e) { next(e); }
});

// Admin Bank Promotional Offers Management
app.get('/api/admin/offers', requireRole('admin'), async (req, res, next) => {
  try {
    const [offers] = await db.query('SELECT * FROM bank_offers ORDER BY id DESC');
    res.json({ offers });
  } catch (e) { next(e); }
});

app.post('/api/admin/offers', requireRole('admin'), async (req, res, next) => {
  try {
    const title = cleanText(req.body.title, 120);
    const category = cleanText(req.body.category, 60);
    const badge = cleanText(req.body.badge, 60);
    const description = cleanText(req.body.description, 255);
    const promoCode = cleanText(req.body.promoCode || 'MAXOFFER', 30);
    const expiryDate = cleanText(req.body.expiryDate || '2027-12-31', 20);

    if (!title || !category || !description) {
      return res.status(400).json({ error: 'Title, category, and description are required.' });
    }

    const [result] = await db.execute(
      'INSERT INTO bank_offers (title, category, discount_badge, description, promo_code, expiry_date, is_active) VALUES (?,?,?,?,?,?,1)',
      [title, category, badge, description, promoCode, expiryDate]
    );

    await audit(req, 'OFFER_CREATED', 'offer', result.insertId, { title, promoCode });
    res.status(201).json({ ok: true, message: 'Promotional offer created successfully.' });
  } catch (e) { next(e); }
});

app.put('/api/admin/offers/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const title = cleanText(req.body.title, 120);
    const category = cleanText(req.body.category, 60);
    const badge = cleanText(req.body.badge, 60);
    const description = cleanText(req.body.description, 255);
    const promoCode = cleanText(req.body.promoCode, 30);
    const expiryDate = cleanText(req.body.expiryDate, 20);

    await db.execute(
      'UPDATE bank_offers SET title=?, category=?, discount_badge=?, description=?, promo_code=?, expiry_date=? WHERE id=?',
      [title, category, badge, description, promoCode, expiryDate, req.params.id]
    );

    await audit(req, 'OFFER_UPDATED', 'offer', req.params.id, { title });
    res.json({ ok: true, message: 'Offer updated successfully.' });
  } catch (e) { next(e); }
});

app.delete('/api/admin/offers/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await db.execute('DELETE FROM bank_offers WHERE id=?', [req.params.id]);
    await audit(req, 'OFFER_DELETED', 'offer', req.params.id);
    res.json({ ok: true, message: 'Offer deleted successfully.' });
  } catch (e) { next(e); }
});

// Single Page Application fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Exception:', err);
  if (res.headersSent) return next(err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with those parameters already exists.' });
  }
  res.status(500).json({ error: 'Internal system processing error.' });
});

// Server Initialization
async function start() {
  try {
    await db.initDatabase();
    const server = app.listen(PORT, () => {
      console.log(`🚀 Max Global Private Bank Server running at http://localhost:${PORT}`);
      console.log(`🌐 AI Engine: ${ai.getAiStatus().provider}`);
      console.log(`💾 Active Database Driver: ${db.getDriver().toUpperCase()}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n⚠️  PORT ${PORT} IS ALREADY IN USE!`);
        console.error(`The Max Global Bank server is ALREADY running on port ${PORT}.`);
        console.error(`You can directly open http://localhost:${PORT} in your browser.`);
        console.error(`To restart, close the existing server process first.\n`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
