require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');

async function main() {
  await db.initDatabase();

  const adminHash = await bcrypt.hash('Admin123!', 12);
  const tellerHash = await bcrypt.hash('Teller123!', 12);
  const customerHash = await bcrypt.hash('Customer123!', 12);

  // Seed / update Admin
  await db.execute(
    `INSERT INTO employees (employee_code, full_name, username, password_hash, role, branch)
     VALUES ('EMP1001', 'Chief Administrator', 'admin', ?, 'admin', 'Global Headquarters')
     ON CONFLICT(employee_code) DO UPDATE SET password_hash=excluded.password_hash`,
    [adminHash]
  );

  // Seed / update Teller
  await db.execute(
    `INSERT INTO employees (employee_code, full_name, username, password_hash, role, branch)
     VALUES ('EMP1002', 'Senior Branch Teller', 'teller', ?, 'teller', 'Mumbai BKC Financial Center')
     ON CONFLICT(employee_code) DO UPDATE SET password_hash=excluded.password_hash`,
    [tellerHash]
  );

  // Seed / update Customer
  await db.execute(
    `INSERT INTO customers (customer_code, full_name, email, phone, address, status)
     VALUES ('CUS1001', 'Aarav Sharma', 'aarav.sharma@maxglobalbank.com', '+91 98200 12345', '42 Altamount Road, Cumballa Hill, Mumbai 400026', 'active')
     ON CONFLICT(customer_code) DO UPDATE SET status='active'`
  );

  const [custRows] = await db.query('SELECT id FROM customers WHERE customer_code=?', ['CUS1001']);
  const customerId = custRows[0]?.id || 1;

  await db.execute(
    `INSERT INTO customer_credentials (customer_id, username, password_hash)
     VALUES (?, 'aarav', ?)
     ON CONFLICT(customer_id) DO UPDATE SET password_hash=excluded.password_hash`,
    [customerId, customerHash]
  );

  await db.execute(
    `INSERT INTO accounts (account_number, customer_id, account_type, balance, status, ifsc_code)
     VALUES ('100000000001', ?, 'savings', 1250000.00, 'active', 'MGPB0000042')
     ON CONFLICT(account_number) DO UPDATE SET balance=1250000.00`,
    [customerId]
  );

  console.log('\n======================================================');
  console.log('✅ SEED COMPLETE — MAX GLOBAL PRIVATE BANK');
  console.log('======================================================');
  console.log('Chief Administrator: admin  / Admin123!');
  console.log('Branch Officer:      teller / Teller123!');
  console.log('Customer NetBanking: aarav  / Customer123!');
  console.log('Security Standard:   RBI/2026/MGPB-8842');
  console.log('Database Engine:    ', db.getDriver().toUpperCase());
  console.log('======================================================\n');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Seed Error:', err);
  process.exit(1);
});
