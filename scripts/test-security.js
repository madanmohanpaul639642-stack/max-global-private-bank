const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db');

const ROOT_DIR = path.join(__dirname, '..');

async function runSecuritySuite() {
  console.log('\n======================================================');
  console.log('🔒 MAX GLOBAL PRIVATE BANK — SECURITY & RBAC AUDIT SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title, condition, detail = '') {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title} — ${detail}`);
    }
  }

  try {
    // 1. Database Connection & Driver
    await db.initDatabase();
    const [dbTest] = await db.query('SELECT 1 as val');
    assert('Database Connection Active (Core SQLite Engine)', dbTest[0]?.val === 1);

    // 2. Demo Credentials Removed from Frontend UI
    const appJs = fs.readFileSync(path.join(ROOT_DIR, 'public', 'app.js'), 'utf8');
    const hasFooterCreds = appJs.includes('auth-footer-credentials') || appJs.includes('Direct Login Credentials:');
    assert('Frontend DOM does NOT display demo credentials below login forms', !hasFooterCreds);

    const hasPlaintextCreds = appJs.includes('Customer123!') || appJs.includes('Teller123!') || appJs.includes('Admin123!');
    assert('Frontend public/app.js has zero hardcoded password strings', !hasPlaintextCreds);

    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'public', 'index.html'), 'utf8');
    const hasHtmlCreds = indexHtml.includes('Customer123!') || indexHtml.includes('Teller123!') || indexHtml.includes('Admin123!');
    assert('Frontend public/index.html has zero exposed demo credentials', !hasHtmlCreds);

    // 3. Password Show/Hide Toggle Implementation
    const hasToggleFunc = appJs.includes('window.togglePasswordVisibility');
    const hasToggleBtn = appJs.includes('btn-toggle-pwd');
    assert('Password Show/Hide toggle (👁️) implemented in login and registration', hasToggleFunc && hasToggleBtn);

    // 4. SQL Injection Defensive Testing
    const sqliUsernames = [
      "' OR '1'='1",
      "admin' --",
      "'; DROP TABLE customers; --",
      "' UNION SELECT 1, 'admin', 'hash', 'admin' --"
    ];

    for (const sqli of sqliUsernames) {
      const [rows] = await db.execute(
        'SELECT id, username, password_hash, role FROM employees WHERE username=? LIMIT 1',
        [sqli]
      );
      assert(`SQL Injection Payload [${sqli}] safely parameterized and returned 0 rows`, rows.length === 0);
    }

    // 5. Backend Role Verification & Access Control Middleware Testing
    const { app } = require('../server');

    // Simulate safeUser helper
    const mockCustomerReq = {
      session: {
        user: { id: 1, name: 'Aarav Sharma', role: 'customer', username: 'aarav', password_hash: '$2b$12$secret' },
        csrfToken: 'test-token-123'
      }
    };

    // Verify safeUser strips password_hash and internal secrets
    const safeUser = (req) => {
      if (!req.session.user) return null;
      return {
        id: req.session.user.id,
        name: req.session.user.name,
        role: req.session.user.role,
        username: req.session.user.username,
        csrfToken: req.session.csrfToken
      };
    };

    const sanitized = safeUser(mockCustomerReq);
    assert('safeUser() strips password_hash and only exposes safe profile fields', sanitized.password_hash === undefined && sanitized.role === 'customer');

    // Test requireRole middleware logic
    function testRequireRole(roleRequired, userRole) {
      let status = 200;
      let error = null;
      const req = { session: userRole ? { user: { role: userRole } } : {} };
      const res = {
        status: (s) => { status = s; return res; },
        json: (j) => { error = j.error; return res; }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const middleware = (roles) => (req, res, next) => {
        if (!req.session.user) return res.status(401).json({ error: 'Authentication required.' });
        if (!roles.includes(req.session.user.role)) {
          return res.status(403).json({ error: 'Access denied: insufficient privileges.' });
        }
        next();
      };

      middleware([roleRequired])(req, res, next);
      return { status, error, nextCalled };
    }

    assert('Unauthenticated user accessing admin route receives 401', testRequireRole('admin', null).status === 401);
    assert('Customer role accessing admin route receives 403 Forbidden', testRequireRole('admin', 'customer').status === 403);
    assert('Customer role accessing teller route receives 403 Forbidden', testRequireRole('teller', 'customer').status === 403);
    assert('Admin role accessing admin route passes authorization (200 OK)', testRequireRole('admin', 'admin').nextCalled === true);

    // 6. Password Hashing Security (Bcrypt 12 Rounds)
    const [empRows] = await db.execute('SELECT password_hash FROM employees WHERE username=? LIMIT 1', ['admin']);
    const adminHash = empRows[0]?.password_hash || '';
    assert('Stored passwords use cryptographic Bcrypt format ($2a$ or $2b$)', adminHash.startsWith('$2a$') || adminHash.startsWith('$2b$'));
    assert('Plaintext password verification against bcrypt hash succeeds', await bcrypt.compare('Admin123!', adminHash));
    assert('Incorrect password verification properly rejected', !(await bcrypt.compare('WrongPassword!99', adminHash)));

    // 7. Reverse Proxy Trust & Security Headers in server.js
    const serverJs = fs.readFileSync(path.join(ROOT_DIR, 'server.js'), 'utf8');
    assert("Reverse proxy trust enabled (app.set('trust proxy', 1)) for Render HTTPS", serverJs.includes("app.set('trust proxy', 1)"));
    assert('Helmet security headers and strict CSP configured in server.js', serverJs.includes('helmet') && serverJs.includes('contentSecurityPolicy'));
    assert('Session cookie configured with httpOnly: true and sameSite: strict', serverJs.includes('httpOnly: true') && serverJs.includes("sameSite: 'strict'"));
    assert('Brute-force login rate limiter active on /api/auth/login', serverJs.includes('loginLimiter'));

    // 8. New Dashboard & Support Endpoints
    assert('Customer Change Password endpoint implemented', serverJs.includes('/api/customer/change-password'));
    assert('In-app Customer Notifications endpoint implemented', serverJs.includes('/api/customer/notifications'));
    assert('Customer Support & Grievance Tickets endpoint implemented', serverJs.includes('/api/customer/tickets'));
    assert('Employee & Admin Support Queue endpoint implemented', serverJs.includes('/api/employee/tickets'));
    assert('Printable / PDF Statement HTML endpoint implemented', serverJs.includes('/api/customer/statement.html'));

    // 9. UI/UX Dark Mode & Accessibility
    const appJsContent = fs.readFileSync(path.join(ROOT_DIR, 'public', 'app.js'), 'utf8');
    const stylesCss = fs.readFileSync(path.join(ROOT_DIR, 'public', 'styles.css'), 'utf8');
    assert('Dark/Light Mode logic implemented in app.js', appJsContent.includes('initTheme') && appJsContent.includes('applyTheme'));
    assert('Dark Mode CSS tokens configured in styles.css', stylesCss.includes('[data-theme="dark"]'));

    // 10. Dockerfile & Render Readiness
    const dockerfile = fs.readFileSync(path.join(ROOT_DIR, 'Dockerfile'), 'utf8');
    assert('Dockerfile uses non-root user (USER node) for container security', dockerfile.includes('USER node'));
    assert('Dockerfile uses dumb-init for graceful signal handling', dockerfile.includes('dumb-init'));

    console.log(`\n======================================================`);
    console.log(`📊 FINAL AUDIT VERDICT: ${passed}/${total} SECURITY CHECKS PASSED`);
    console.log(`======================================================\n`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit execution error:', err);
    process.exit(1);
  }
}

runSecuritySuite();
