const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let driver = 'auto'; // 'mysql' | 'sqlite' | 'auto'
let activeDriver = 'sqlite';
let mysqlPool = null;
let sqliteDb = null;
let isInitialized = false;

const DB_TYPE = process.env.DB_TYPE || 'auto';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'bank_demo_user';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'bank_management_demo';
const CLOUD_SQL_CONNECTION_NAME = process.env.CLOUD_SQL_CONNECTION_NAME || '';

// Clean and translate MySQL specific syntax for SQLite compatibility
function translateSqlForSqlite(sql) {
  let s = sql;
  s = s.replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+30\s+DAY\s*\)/gi, "datetime('now', '-30 days')");
  s = s.replace(/DATE_SUB\s*\(\s*CURRENT_TIMESTAMP\s*,\s*INTERVAL\s+30\s+DAY\s*\)/gi, "datetime('now', '-30 days')");
  s = s.replace(/NOW\(\)/gi, "datetime('now')");
  s = s.replace(/\s+FOR\s+UPDATE/gi, '');
  // Normalize double quotes in literals for SQLite compatibility
  s = s.replace(/"([^"]+)"/g, (match, val) => {
    // If it's a known table or column name, keep or omit; if it's a value, single-quote it
    return `'${val}'`;
  });
  return s;
}

function sanitizeSqliteParams(params = []) {
  return params.map(p => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

function initSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const isServerless = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL || process.env.LAMBDA_TASK_ROOT);
  let dataDir = path.join(__dirname, 'data');
  if (isServerless) {
    dataDir = path.join('/tmp', 'max_global_bank_data');
  }
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (_) {
    dataDir = path.join('/tmp', 'max_global_bank_data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
  const dbPath = path.join(dataDir, 'max_global_bank.sqlite');
  sqliteDb = new DatabaseSync(dbPath);
  
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');

  // Core Banking Tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teller',
      status TEXT NOT NULL DEFAULT 'active',
      branch TEXT NOT NULL DEFAULT 'Central Branch (Headquarters)',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'savings',
      balance REAL NOT NULL DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'active',
      ifsc_code TEXT NOT NULL DEFAULT 'BLOK0001042',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL UNIQUE,
      from_account_id INTEGER NULL,
      to_account_id INTEGER NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed',
      initiated_by_role TEXT NOT NULL,
      initiated_by_id INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (from_account_id) REFERENCES accounts(id),
      FOREIGN KEY (to_account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      card_number TEXT NOT NULL UNIQUE,
      card_holder TEXT NOT NULL,
      expiry TEXT NOT NULL,
      cvv TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'Platinum Visa Debit',
      daily_limit REAL NOT NULL DEFAULT 50000.00,
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_reference TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      loan_type TEXT NOT NULL,
      principal REAL NOT NULL,
      interest_rate REAL NOT NULL,
      tenure_months INTEGER NOT NULL,
      monthly_emi REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS fixed_deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fd_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      principal REAL NOT NULL,
      interest_rate REAL NOT NULL,
      tenure_months INTEGER NOT NULL,
      maturity_amount REAL NOT NULL,
      maturity_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS bank_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      discount_badge TEXT NOT NULL,
      description TEXT NOT NULL,
      promo_code TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_role TEXT NOT NULL,
      actor_id INTEGER NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NULL,
      details TEXT NULL,
      ip_address TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      expires INTEGER NOT NULL,
      data TEXT
    );
  `);

  seedSqliteIfEmpty();
  activeDriver = 'sqlite';
  console.log('✅ Connected to Max Global Core Database Engine (High-Performance)');
}

function seedSqliteIfEmpty() {
  const checkStmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM employees');
  const result = checkStmt.all()[0];
  if (result && result.count > 0) {
    return;
  }

  console.log('🌱 Initializing Max Global Private Bank Enterprise Database Records...');
  const adminHash = bcrypt.hashSync('Admin123!', 10);
  const adminDemoHash = bcrypt.hashSync('AdminDemo123!', 10);
  const tellerHash = bcrypt.hashSync('Teller123!', 10);
  const tellerDemoHash = bcrypt.hashSync('TellerDemo123!', 10);
  const customerHash = bcrypt.hashSync('Customer123!', 10);
  const customerDemoHash = bcrypt.hashSync('CustomerDemo123!', 10);

  // Insert Employees
  const insEmp = sqliteDb.prepare(`
    INSERT INTO employees (employee_code, full_name, username, password_hash, role, branch)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  // Master Administrator
  insEmp.run('EMP1001', 'Chief Administrator', 'admin', adminHash, 'admin', 'Global Headquarters');
  insEmp.run('EMP1000', 'Chief Administrator', 'admin.demo', adminDemoHash, 'admin', 'Global Headquarters');

  // Branch Operations / Tellers
  insEmp.run('EMP1002', 'Vikram Patel', 'teller', tellerHash, 'teller', 'Mumbai Financial Center');
  insEmp.run('EMP1003', 'Vikram Patel', 'teller.demo', tellerDemoHash, 'teller', 'Mumbai Financial Center');
  insEmp.run('EMP1004', 'Sneha Roy', 'officer.sneha', tellerHash, 'teller', 'Delhi Connaught Branch');

  // Insert Premium Customer
  const insCus = sqliteDb.prepare(`
    INSERT INTO customers (customer_code, full_name, email, phone, address, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `);
  insCus.run('CUS1001', 'Aarav Sharma', 'aarav.sharma@maxglobalbank.com', '+91 98765 43210', 'Flat 402, Cyber Heights, Bandra West, Mumbai');
  const customerId = 1;

  // Insert Customer Credentials
  const insCred = sqliteDb.prepare(`
    INSERT INTO customer_credentials (customer_id, username, password_hash)
    VALUES (?, ?, ?)
  `);
  insCred.run(customerId, 'aarav', customerHash);

  // Insert Second Customer
  const cInfo2 = insCus.run('CUS1002', 'Priya Patel', 'priya.patel@maxglobalbank.com', '+91 98765 12345', '12 Nariman Point, Marine Drive, Mumbai');
  insCred.run(cInfo2.lastInsertRowid, 'aarav.demo', customerDemoHash);

  // Insert Savings Account
  const insAcc = sqliteDb.prepare(`
    INSERT INTO accounts (account_number, customer_id, account_type, balance, status, ifsc_code)
    VALUES (?, ?, ?, ?, 'active', 'MGPB0001042')
  `);
  const aInfo = insAcc.run('100000000001', customerId, 'savings', 850000.00);
  const accountId = aInfo.lastInsertRowid;

  // Insert Secondary Current Account
  const cAcc = insAcc.run('100000000002', customerId, 'current', 250000.00);

  // Issue Virtual Platinum Visa Debit Card
  const insCard = sqliteDb.prepare(`
    INSERT INTO cards (customer_id, account_id, card_number, card_holder, expiry, cvv, card_type, daily_limit, is_locked)
    VALUES (?, ?, '4532 8901 2345 6789', 'AARAV SHARMA', '12/29', '784', 'Max Infinite Visa Metal', 100000.00, 0)
  `);
  insCard.run(customerId, accountId);

  // Insert Initial Verified Transactions
  const insTx = sqliteDb.prepare(`
    INSERT INTO transactions (reference_code, from_account_id, to_account_id, transaction_type, amount, description, status, initiated_by_role, initiated_by_id)
    VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)
  `);
  insTx.run('TXN-SAL-8821', null, accountId, 'deposit', 350000.00, 'Monthly Executive Salary Credit - Tech Corp', 'system', 1);
  insTx.run('TXN-DIV-9430', null, accountId, 'deposit', 500000.00, 'Quarterly Mutual Fund Dividend Payout', 'system', 1);
  insTx.run('TXN-TRF-1049', accountId, cAcc.lastInsertRowid, 'transfer', 100000.00, 'Internal sweep transfer to Current Account', 'customer', customerId);

  // Insert Initial Fixed Deposit
  const insFd = sqliteDb.prepare(`
    INSERT INTO fixed_deposits (fd_number, customer_id, account_id, principal, interest_rate, tenure_months, maturity_amount, maturity_date, status)
    VALUES ('FD-MGPB-7721', ?, ?, 200000.00, 7.85, 12, 215700.00, '2027-11-01', 'active')
  `);
  insFd.run(customerId, accountId);

  // Insert Bank Settings (Live Rates & RBI Info)
  const insSet = sqliteDb.prepare(`
    INSERT INTO bank_settings (setting_key, setting_value, description)
    VALUES (?, ?, ?)
  `);
  insSet.run('bank_name', 'Max Global Private Bank', 'Official Bank Name');
  insSet.run('savings_rate', '4.25', 'Savings Account Interest Rate (% p.a.)');
  insSet.run('fd_rate', '7.85', 'Special 1-Year Term Deposit Rate (% p.a.)');
  insSet.run('home_loan_rate', '8.40', 'Home Loan Base Interest Rate (% p.a.)');
  insSet.run('personal_loan_rate', '10.50', 'Personal Loan Rate (% p.a.)');
  insSet.run('car_loan_rate', '8.75', 'Automobile Car Loan Rate (% p.a.)');
  insSet.run('gold_loan_rate', '7.50', 'Gold Loan Base Rate (% p.a.)');
  insSet.run('rbi_license', 'RBI/2026/MGPB-8842', 'Reserve Bank of India License Number');
  insSet.run('dicgc_insured', '₹5,00,000 per depositor', 'DICGC Deposit Insurance Coverage');
  insSet.run('customer_count', '28,40,000+', 'Active Customer Relationships');
  insSet.run('branch_count', '480+ Branches Across India', 'Branch Presence');

  // Insert Live Bank Offers
  const insOffer = sqliteDb.prepare(`
    INSERT INTO bank_offers (title, category, discount_badge, description, promo_code, expiry_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  insOffer.run('Festive Home Loan Bonanza', 'Loans', 'ZERO Processing Fee', 'Apply for residential home loans starting @ 8.40% p.a. with zero processing fee and instantaneous digital sanction.', 'FESTIVEMAX', '2026-12-31');
  insOffer.run('Max Infinite Visa Dining Delights', 'Cards', '20% Instant Cashback', 'Dine at over 4,500+ luxury five-star partner restaurants across Mumbai, Delhi, Bengaluru and get 20% cashback.', 'DINEMAX20', '2026-11-30');
  insOffer.run('7.85% Sovereign Term Deposit', 'Wealth', 'Special Senior Citizen +0.50%', 'Guaranteed quarterly compounded returns backed by sovereign capital protection. Complete liquidity option available.', 'MAXFD785', '2027-03-31');
  insOffer.run('Complimentary International Airport Lounges', 'Privileges', '8 Domestic + 4 Intl Visits', 'Access premium luxury airport lounges worldwide with your Max Global Infinite Metal Visa Debit Card.', 'LOUNGEMAX', '2027-01-31');

  console.log('✅ Max Global Private Bank Enterprise Database Seeded Successfully!');
}

async function tryConnectMysql() {
  const mysql = require('mysql2/promise');
  const poolConfig = {
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: false,
    timezone: 'Z',
    connectTimeout: 2000
  };

  if (CLOUD_SQL_CONNECTION_NAME) {
    poolConfig.socketPath = `/cloudsql/${CLOUD_SQL_CONNECTION_NAME}`;
    poolConfig.user = DB_USER;
    poolConfig.password = DB_PASSWORD;
    poolConfig.database = DB_NAME;
  } else {
    poolConfig.host = DB_HOST;
    poolConfig.port = DB_PORT;
    poolConfig.user = DB_USER;
    poolConfig.password = DB_PASSWORD;
    poolConfig.database = DB_NAME;
  }

  const testPool = mysql.createPool(poolConfig);
  const conn = await testPool.getConnection();
  await conn.query('SELECT 1');
  conn.release();
  mysqlPool = testPool;
  activeDriver = 'mysql';
  console.log(`✅ Connected to Enterprise MySQL Instance [${DB_HOST}:${DB_PORT}/${DB_NAME}]`);
}

async function initDatabase() {
  if (isInitialized) return;

  if (DB_TYPE === 'sqlite') {
    initSqlite();
    isInitialized = true;
    return;
  }

  if (DB_TYPE === 'mysql') {
    try {
      await tryConnectMysql();
      isInitialized = true;
      return;
    } catch (err) {
      console.warn('Falling back to SQLite embedded engine:', err.message);
      initSqlite();
      isInitialized = true;
      return;
    }
  }

  try {
    await tryConnectMysql();
    isInitialized = true;
  } catch (err) {
    initSqlite();
    isInitialized = true;
  }
}

async function query(sql, params = []) {
  await initDatabase();
  if (activeDriver === 'mysql') {
    return mysqlPool.query(sql, params);
  }

  const translated = translateSqlForSqlite(sql);
  const cleanParams = sanitizeSqliteParams(params);
  try {
    const stmt = sqliteDb.prepare(translated);
    if (/^\s*(SELECT|PRAGMA)/i.test(translated)) {
      const rows = stmt.all(...cleanParams);
      return [rows, []];
    } else {
      const info = stmt.run(...cleanParams);
      return [{
        insertId: info.lastInsertRowid,
        affectedRows: info.changes
      }, []];
    }
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint failed')) {
      const err = new Error('A record with these details already exists.');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    throw e;
  }
}

async function execute(sql, params = []) {
  return query(sql, params);
}

async function getConnection() {
  await initDatabase();
  if (activeDriver === 'mysql') {
    return mysqlPool.getConnection();
  }

  let inTransaction = false;
  return {
    async beginTransaction() {
      if (!inTransaction) {
        sqliteDb.exec('BEGIN TRANSACTION;');
        inTransaction = true;
      }
    },
    async commit() {
      if (inTransaction) {
        sqliteDb.exec('COMMIT;');
        inTransaction = false;
      }
    },
    async rollback() {
      if (inTransaction) {
        try { sqliteDb.exec('ROLLBACK;'); } catch (_) {}
        inTransaction = false;
      }
    },
    async execute(sql, params = []) {
      return query(sql, params);
    },
    async query(sql, params = []) {
      return query(sql, params);
    },
    release() {}
  };
}

module.exports = {
  initDatabase,
  query,
  execute,
  getConnection,
  getDriver: () => activeDriver,
  getPool: () => mysqlPool,
  getSqliteDb: () => sqliteDb
};
