const session = require('express-session');
const db = require('./db');

function createSessionStore() {
  const isServerless = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL || process.env.LAMBDA_TASK_ROOT);
  if (isServerless) {
    const MemoryStore = session.MemoryStore;
    return new MemoryStore();
  }

  const driver = db.getDriver();
  
  if (driver === 'mysql' && db.getPool()) {
    try {
      const MySQLStore = require('express-mysql-session')(session);
      return new MySQLStore({}, db.getPool());
    } catch (err) {
      console.warn('Could not initialize MySQL session store, falling back to SQLite/Memory store:', err.message);
    }
  }

  // SQLite Persistent Session Store
  class SqliteSessionStore extends session.Store {
    constructor() {
      super();
    }

    get(sid, callback) {
      try {
        const sqlite = db.getSqliteDb();
        const stmt = sqlite.prepare('SELECT data, expires FROM sessions WHERE session_id = ?');
        const row = stmt.all(sid)[0];
        if (!row) return callback(null, null);
        if (row.expires && row.expires < Date.now()) {
          this.destroy(sid, () => {});
          return callback(null, null);
        }
        const data = JSON.parse(row.data);
        return callback(null, data);
      } catch (err) {
        return callback(err);
      }
    }

    set(sid, sessionData, callback) {
      try {
        const sqlite = db.getSqliteDb();
        const maxAge = sessionData.cookie?.maxAge || 1000 * 60 * 60 * 24;
        const expires = Date.now() + maxAge;
        const data = JSON.stringify(sessionData);

        const stmt = sqlite.prepare(`
          INSERT INTO sessions (session_id, expires, data)
          VALUES (?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET
            expires = excluded.expires,
            data = excluded.data
        `);
        stmt.run(sid, expires, data);
        return callback?.(null);
      } catch (err) {
        return callback?.(err);
      }
    }

    destroy(sid, callback) {
      try {
        const sqlite = db.getSqliteDb();
        const stmt = sqlite.prepare('DELETE FROM sessions WHERE session_id = ?');
        stmt.run(sid);
        return callback?.(null);
      } catch (err) {
        return callback?.(err);
      }
    }

    touch(sid, sessionData, callback) {
      try {
        const sqlite = db.getSqliteDb();
        const maxAge = sessionData.cookie?.maxAge || 1000 * 60 * 60 * 24;
        const expires = Date.now() + maxAge;
        const stmt = sqlite.prepare('UPDATE sessions SET expires = ? WHERE session_id = ?');
        stmt.run(expires, sid);
        return callback?.(null);
      } catch (err) {
        return callback?.(err);
      }
    }
  }

  return new SqliteSessionStore();
}

module.exports = { createSessionStore };
