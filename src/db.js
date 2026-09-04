const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'piciani.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS liderancas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT,
    codigo TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS participantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL UNIQUE,
    lideranca_id INTEGER REFERENCES liderancas(id) ON DELETE SET NULL,
    data_cadastro TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_participantes_telefone ON participantes(telefone);
  CREATE INDEX IF NOT EXISTS idx_participantes_nome ON participantes(nome);
  CREATE INDEX IF NOT EXISTS idx_participantes_created_at ON participantes(created_at);
  CREATE INDEX IF NOT EXISTS idx_liderancas_codigo ON liderancas(codigo);

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add lideranca_id to pre-existing participantes tables.
const columns = db.prepare("PRAGMA table_info(participantes)").all();
if (!columns.some((c) => c.name === 'lideranca_id')) {
  db.exec('ALTER TABLE participantes ADD COLUMN lideranca_id INTEGER REFERENCES liderancas(id) ON DELETE SET NULL');
  db.exec('CREATE INDEX IF NOT EXISTS idx_participantes_lideranca ON participantes(lideranca_id)');
}

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (existing) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const hash = bcrypt.hashSync(password, 12);

  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Admin inicial criado: usuario="${username}"`);
}

seedAdmin();

module.exports = db;
