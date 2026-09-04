const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const ExcelJS = require('exceljs');

const db = require('./db');
const { formatPhoneBR, formatDateBR, formatTimeBR, slugify } = require('./util');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name: 'piciani.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 8, // 8h
  },
}));

const registerLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'nao_autenticado' });
}

// ---------- Public API ----------

app.post('/api/cadastro', registerLimiter, (req, res) => {
  const nomeRaw = (req.body.nome || '').toString().trim();
  const telefoneRaw = (req.body.telefone || '').toString().trim();

  if (nomeRaw.length < 3) {
    return res.status(400).json({ error: 'nome_invalido', message: 'Informe o nome completo.' });
  }
  const telefone = formatPhoneBR(telefoneRaw);
  if (!telefone) {
    return res.status(400).json({ error: 'telefone_invalido', message: 'Informe um telefone válido com DDD.' });
  }

  const existing = db.prepare('SELECT id FROM participantes WHERE telefone = ?').get(telefone);
  if (existing) {
    return res.status(409).json({ error: 'telefone_duplicado', message: 'Este telefone já está cadastrado.' });
  }

  let liderancaId = null;
  const liderCodigo = (req.body.lider || '').toString().trim().toLowerCase();
  if (liderCodigo) {
    const lideranca = db.prepare('SELECT id FROM liderancas WHERE codigo = ?').get(liderCodigo);
    if (lideranca) liderancaId = lideranca.id;
  }

  const nome = nomeRaw.replace(/\s+/g, ' ').slice(0, 150);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const info = db.prepare(
    'INSERT INTO participantes (nome, telefone, lideranca_id, data_cadastro, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(nome, telefone, liderancaId, now, now, now);

  return res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

// ---------- Admin auth ----------

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const username = (req.body.username || '').toString().trim();
  const password = (req.body.password || '').toString();

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'credenciais_invalidas', message: 'Usuário ou senha incorretos.' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'erro_sessao' });
    req.session.adminId = admin.id;
    req.session.username = admin.username;
    res.json({ ok: true, username: admin.username });
  });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('piciani.sid');
    res.json({ ok: true });
  });
});

app.get('/api/admin/me', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ authenticated: true, username: req.session.username });
  }
  res.json({ authenticated: false });
});

// ---------- Admin: participantes ----------

function buildFilterQuery(query) {
  const { q, de, ate, sort, liderancaId } = query;
  const where = [];
  const params = {};

  if (q && q.trim()) {
    where.push('(p.nome LIKE @q OR p.telefone LIKE @q)');
    params.q = `%${q.trim()}%`;
  }
  if (de) {
    where.push('date(p.created_at) >= date(@de)');
    params.de = de;
  }
  if (ate) {
    where.push('date(p.created_at) <= date(@ate)');
    params.ate = ate;
  }
  if (liderancaId === 'nenhuma') {
    where.push('p.lideranca_id IS NULL');
  } else if (liderancaId) {
    where.push('p.lideranca_id = @liderancaId');
    params.liderancaId = parseInt(liderancaId, 10);
  }

  let orderBy = 'p.created_at DESC';
  if (sort === 'antigos') orderBy = 'p.created_at ASC';
  else if (sort === 'nome') orderBy = 'p.nome ASC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { whereSql, params, orderBy };
}

const PARTICIPANTES_SELECT = `
  SELECT p.id, p.nome, p.telefone, p.data_cadastro, p.created_at, p.updated_at,
         p.lideranca_id, l.nome AS lideranca_nome
  FROM participantes p
  LEFT JOIN liderancas l ON l.id = p.lideranca_id
`;

app.get('/api/admin/participantes', requireAuth, (req, res) => {
  const { whereSql, params, orderBy } = buildFilterQuery(req.query);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;

  const total = db.prepare(`SELECT COUNT(*) AS c FROM participantes p ${whereSql}`).get(params).c;
  const rows = db.prepare(
    `${PARTICIPANTES_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit: pageSize, offset });

  const data = rows.map((r) => ({
    ...r,
    data: formatDateBR(r.created_at),
    hora: formatTimeBR(r.created_at),
  }));

  res.json({ total, page, pageSize, data });
});

app.get('/api/admin/stats', requireAuth, (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM participantes').get().c;
  const hoje = db.prepare("SELECT COUNT(*) AS c FROM participantes WHERE date(created_at) = date('now')").get().c;
  const semana = db.prepare("SELECT COUNT(*) AS c FROM participantes WHERE date(created_at) >= date('now', '-6 days')").get().c;
  const mes = db.prepare("SELECT COUNT(*) AS c FROM participantes WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").get().c;

  const last14 = db.prepare(
    `SELECT date(created_at) AS dia, COUNT(*) AS total
     FROM participantes
     WHERE date(created_at) >= date('now', '-13 days')
     GROUP BY dia ORDER BY dia ASC`
  ).all();

  const seriesMap = new Map(last14.map((r) => [r.dia, r.total]));
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ dia: key, total: seriesMap.get(key) || 0 });
  }

  res.json({ total, hoje, semana, mes, series });
});

app.put('/api/admin/participantes/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const nomeRaw = (req.body.nome || '').toString().trim();
  const telefoneRaw = (req.body.telefone || '').toString().trim();

  if (nomeRaw.length < 3) return res.status(400).json({ error: 'nome_invalido' });
  const telefone = formatPhoneBR(telefoneRaw);
  if (!telefone) return res.status(400).json({ error: 'telefone_invalido' });

  const dup = db.prepare('SELECT id FROM participantes WHERE telefone = ? AND id != ?').get(telefone, id);
  if (dup) return res.status(409).json({ error: 'telefone_duplicado' });

  let liderancaId = null;
  if (req.body.lideranca_id !== undefined && req.body.lideranca_id !== null && req.body.lideranca_id !== '') {
    liderancaId = parseInt(req.body.lideranca_id, 10);
    const existsLideranca = db.prepare('SELECT id FROM liderancas WHERE id = ?').get(liderancaId);
    if (!existsLideranca) return res.status(400).json({ error: 'lideranca_invalida' });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const info = db.prepare('UPDATE participantes SET nome = ?, telefone = ?, lideranca_id = ?, updated_at = ? WHERE id = ?')
    .run(nomeRaw.slice(0, 150), telefone, liderancaId, now, id);

  if (info.changes === 0) return res.status(404).json({ error: 'nao_encontrado' });
  res.json({ ok: true });
});

app.delete('/api/admin/participantes/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const info = db.prepare('DELETE FROM participantes WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'nao_encontrado' });
  res.json({ ok: true });
});

app.post('/api/admin/participantes/bulk-delete', requireAuth, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) return res.status(400).json({ error: 'ids_invalidos' });

  const placeholders = ids.map(() => '?').join(',');
  const info = db.prepare(`DELETE FROM participantes WHERE id IN (${placeholders})`).run(...ids);
  res.json({ ok: true, removidos: info.changes });
});

// ---------- Lideranças ----------

app.get('/api/admin/liderancas', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT l.id, l.nome, l.telefone, l.codigo, l.created_at,
           (SELECT COUNT(*) FROM participantes p WHERE p.lideranca_id = l.id) AS total_cadastros
    FROM liderancas l
    ORDER BY l.nome ASC
  `).all();

  const semLideranca = db.prepare('SELECT COUNT(*) AS c FROM participantes WHERE lideranca_id IS NULL').get().c;

  res.json({
    liderancas: rows.map((r) => ({ ...r, data: formatDateBR(r.created_at) })),
    semLideranca,
  });
});

app.post('/api/admin/liderancas', requireAuth, (req, res) => {
  const nome = (req.body.nome || '').toString().trim().slice(0, 150);
  const telefoneRaw = (req.body.telefone || '').toString().trim();
  if (nome.length < 3) return res.status(400).json({ error: 'nome_invalido', message: 'Informe o nome da liderança.' });

  let telefone = null;
  if (telefoneRaw) {
    telefone = formatPhoneBR(telefoneRaw);
    if (!telefone) return res.status(400).json({ error: 'telefone_invalido' });
  }

  let codigo = slugify(nome);
  let attempt = codigo;
  let n = 1;
  while (db.prepare('SELECT id FROM liderancas WHERE codigo = ?').get(attempt)) {
    n += 1;
    attempt = `${codigo}-${n}`;
  }
  codigo = attempt;

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const info = db.prepare(
    'INSERT INTO liderancas (nome, telefone, codigo, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(nome, telefone, codigo, now, now);

  res.status(201).json({ ok: true, id: info.lastInsertRowid, codigo });
});

app.put('/api/admin/liderancas/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const nome = (req.body.nome || '').toString().trim().slice(0, 150);
  const telefoneRaw = (req.body.telefone || '').toString().trim();
  if (nome.length < 3) return res.status(400).json({ error: 'nome_invalido' });

  let telefone = null;
  if (telefoneRaw) {
    telefone = formatPhoneBR(telefoneRaw);
    if (!telefone) return res.status(400).json({ error: 'telefone_invalido' });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const info = db.prepare('UPDATE liderancas SET nome = ?, telefone = ?, updated_at = ? WHERE id = ?')
    .run(nome, telefone, now, id);

  if (info.changes === 0) return res.status(404).json({ error: 'nao_encontrado' });
  res.json({ ok: true });
});

app.delete('/api/admin/liderancas/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const info = db.prepare('DELETE FROM liderancas WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'nao_encontrado' });
  res.json({ ok: true });
});

app.get('/api/admin/liderancas/:id/participantes', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rows = db.prepare(
    `SELECT id, nome, telefone, created_at FROM participantes WHERE lideranca_id = ? ORDER BY created_at DESC`
  ).all(id);

  res.json({
    data: rows.map((r) => ({ ...r, data: formatDateBR(r.created_at), hora: formatTimeBR(r.created_at) })),
  });
});

// ---------- Export ----------

app.get('/api/admin/export/csv', requireAuth, (req, res) => {
  const { whereSql, params, orderBy } = buildFilterQuery(req.query);
  const rows = db.prepare(
    `${PARTICIPANTES_SELECT} ${whereSql} ORDER BY ${orderBy}`
  ).all(params);

  const header = 'Nome,Telefone,Lideranca,Data,Horario\n';
  const escapeCsv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [escapeCsv(r.nome), escapeCsv(r.telefone), escapeCsv(r.lideranca_nome || 'Direto'), formatDateBR(r.created_at), formatTimeBR(r.created_at)].join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cadastros_piciani.csv"');
  res.send('﻿' + header + body);
});

app.get('/api/admin/export/xlsx', requireAuth, async (req, res) => {
  const { whereSql, params, orderBy } = buildFilterQuery(req.query);
  const rows = db.prepare(
    `${PARTICIPANTES_SELECT} ${whereSql} ORDER BY ${orderBy}`
  ).all(params);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cadastros');
  sheet.columns = [
    { header: 'Nome', key: 'nome', width: 32 },
    { header: 'Telefone', key: 'telefone', width: 20 },
    { header: 'Liderança', key: 'lideranca', width: 24 },
    { header: 'Data', key: 'data', width: 14 },
    { header: 'Horário', key: 'hora', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((r) => {
    sheet.addRow({
      nome: r.nome,
      telefone: r.telefone,
      lideranca: r.lideranca_nome || 'Direto',
      data: formatDateBR(r.created_at),
      hora: formatTimeBR(r.created_at),
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="cadastros_piciani.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

// ---------- Static frontend ----------

app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'nao_encontrado' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
