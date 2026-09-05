import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const viewLogin = document.getElementById('viewLogin');
const viewDashboard = document.getElementById('viewDashboard');
const formLogin = document.getElementById('formLogin');
const loginAlert = document.getElementById('loginAlert');
const btnLogout = document.getElementById('btnLogout');

const searchInput = document.getElementById('searchInput');
const filterDe = document.getElementById('filterDe');
const filterAte = document.getElementById('filterAte');
const filterSort = document.getElementById('filterSort');
const filterLideranca = document.getElementById('filterLideranca');

const tableBody = document.getElementById('tableBody');
const checkAll = document.getElementById('checkAll');
const bulkBar = document.getElementById('bulkBar');
const bulkCount = document.getElementById('bulkCount');
const btnBulkDelete = document.getElementById('btnBulkDelete');
const btnClearSelection = document.getElementById('btnClearSelection');

const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const pageInfo = document.getElementById('pageInfo');

const modalEdit = document.getElementById('modalEdit');
const formEdit = document.getElementById('formEdit');
const editAlert = document.getElementById('editAlert');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const editLidSelect = document.getElementById('editLideranca');

const modalConfirm = document.getElementById('modalConfirm');
const confirmText = document.getElementById('confirmText');
const btnCancelConfirm = document.getElementById('btnCancelConfirm');
const btnConfirmYes = document.getElementById('btnConfirmYes');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabCadastros = document.getElementById('tabCadastros');
const tabLiderancas = document.getElementById('tabLiderancas');
const liderancaTree = document.getElementById('liderancaTree');
const btnNovaLideranca = document.getElementById('btnNovaLideranca');

const modalLideranca = document.getElementById('modalLideranca');
const formLideranca = document.getElementById('formLideranca');
const liderancaAlert = document.getElementById('liderancaAlert');
const liderancaModalTitle = document.getElementById('liderancaModalTitle');
const btnCancelLideranca = document.getElementById('btnCancelLideranca');

const modalLink = document.getElementById('modalLink');
const linkGerado = document.getElementById('linkGerado');
const btnCopyLink = document.getElementById('btnCopyLink');
const btnCloseLink = document.getElementById('btnCloseLink');

const editTelefoneInput = document.getElementById('editTelefone');
const liderancaTelefoneInput = document.getElementById('liderancaTelefone');
applyPhoneMask(editTelefoneInput);
applyPhoneMask(liderancaTelefoneInput);

const state = {
  participantes: [],
  liderancas: [],
  liderancasByCodigo: new Map(),
  filteredRows: [],
  page: 1,
  pageSize: 25,
  selected: new Set(),
  pending: null, // { type: 'participante' | 'bulk' | 'lideranca', id }
};
let searchDebounce = null;
let chartInstance = null;
let unsubscribeParticipantes = null;
let unsubscribeLiderancas = null;

function baseUrl() {
  return window.location.href.replace(/admin\.html.*$/, '');
}

function dateKeySP(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getLiderancaNome(codigo) {
  if (!codigo) return null;
  const l = state.liderancasByCodigo.get(codigo);
  return l ? l.nome : null;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

// ---------- Auth ----------

function showLogin() {
  viewLogin.hidden = false;
  viewDashboard.hidden = true;
}
function showDashboard() {
  viewLogin.hidden = true;
  viewDashboard.hidden = false;
  startListeners();
}

function stopListeners() {
  if (unsubscribeParticipantes) unsubscribeParticipantes();
  if (unsubscribeLiderancas) unsubscribeLiderancas();
  unsubscribeParticipantes = null;
  unsubscribeLiderancas = null;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showDashboard();
  } else {
    stopListeners();
    showLogin();
  }
});

const LOGIN_ERROR_MESSAGES = {
  'auth/invalid-credential': 'Usuário ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-not-found': 'Usuário ou senha incorretos.',
  'auth/wrong-password': 'Usuário ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
};

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginAlert.classList.remove('show');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    await signInWithEmailAndPassword(auth, username, password);
    formLogin.reset();
  } catch (err) {
    loginAlert.textContent = LOGIN_ERROR_MESSAGES[err.code] || 'Falha ao entrar.';
    loginAlert.classList.add('show');
  }
});

btnLogout.addEventListener('click', async () => {
  await signOut(auth);
});

// ---------- Tabs ----------

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    tabCadastros.hidden = tab !== 'cadastros';
    tabLiderancas.hidden = tab !== 'liderancas';
    if (tab === 'liderancas') renderLiderancaTree();
  });
});

// ---------- Realtime listeners ----------

function startListeners() {
  if (unsubscribeParticipantes || unsubscribeLiderancas) return;

  const qParticipantes = query(collection(db, 'participantes'), orderBy('created_at', 'desc'));
  unsubscribeParticipantes = onSnapshot(qParticipantes, (snap) => {
    state.participantes = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        nome: data.nome,
        telefone: data.telefone,
        lideranca_codigo: data.lideranca_codigo || null,
        created_at: data.created_at ? data.created_at.toDate() : new Date(),
      };
    });
    renderStats();
    renderTable();
    if (!tabLiderancas.hidden) renderLiderancaTree();
  });

  unsubscribeLiderancas = onSnapshot(collection(db, 'liderancas'), (snap) => {
    state.liderancas = snap.docs
      .map((d) => ({ codigo: d.id, ...d.data() }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    state.liderancasByCodigo = new Map(state.liderancas.map((l) => [l.codigo, l]));
    populateLiderancaSelects();
    renderTable();
    if (!tabLiderancas.hidden) renderLiderancaTree();
  });
}

// ---------- Stats ----------

function renderStats() {
  const now = new Date();
  const todayKey = dateKeySP(now);
  const monthKey = todayKey.slice(0, 7);
  const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const weekStartKey = dateKeySP(weekStart);

  let hoje = 0, semana = 0, mes = 0;
  const seriesMap = new Map();

  state.participantes.forEach((p) => {
    const key = dateKeySP(p.created_at);
    if (key === todayKey) hoje += 1;
    if (key >= weekStartKey) semana += 1;
    if (key.slice(0, 7) === monthKey) mes += 1;
    seriesMap.set(key, (seriesMap.get(key) || 0) + 1);
  });

  document.getElementById('statTotal').textContent = state.participantes.length.toLocaleString('pt-BR');
  document.getElementById('statHoje').textContent = hoje.toLocaleString('pt-BR');
  document.getElementById('statSemana').textContent = semana.toLocaleString('pt-BR');
  document.getElementById('statMes').textContent = mes.toLocaleString('pt-BR');

  const labels = [];
  const values = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = dateKeySP(d);
    const [, m, dd] = key.split('-');
    labels.push(`${dd}/${m}`);
    values.push(seriesMap.get(key) || 0);
  }

  const ctx = document.getElementById('chartCadastros').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cadastros',
        data: values,
        backgroundColor: '#1a4fb4',
        borderRadius: 6,
        maxBarThickness: 28,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

// ---------- Table ----------

function computeFilteredRows() {
  const q = searchInput.value.trim().toLowerCase();
  const de = filterDe.value;
  const ate = filterAte.value;
  const lidFilter = filterLideranca.value;
  const sort = filterSort.value;

  let rows = state.participantes.slice();

  if (q) {
    rows = rows.filter((p) =>
      p.nome.toLowerCase().includes(q) || p.telefone.toLowerCase().includes(q)
    );
  }
  if (de) {
    rows = rows.filter((p) => dateKeySP(p.created_at) >= de);
  }
  if (ate) {
    rows = rows.filter((p) => dateKeySP(p.created_at) <= ate);
  }
  if (lidFilter === 'nenhuma') {
    rows = rows.filter((p) => !p.lideranca_codigo || !state.liderancasByCodigo.has(p.lideranca_codigo));
  } else if (lidFilter) {
    rows = rows.filter((p) => p.lideranca_codigo === lidFilter);
  }

  if (sort === 'antigos') rows.sort((a, b) => a.created_at - b.created_at);
  else if (sort === 'nome') rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  else rows.sort((a, b) => b.created_at - a.created_at);

  return rows;
}

function renderRow(item) {
  const tr = document.createElement('tr');
  const lidNome = getLiderancaNome(item.lideranca_codigo);
  const liderancaLabel = lidNome ? escapeHtml(lidNome) : '<span class="badge">Direto</span>';
  tr.innerHTML = `
    <td><input type="checkbox" class="row-check" data-id="${item.id}"></td>
    <td>${escapeHtml(item.nome)}</td>
    <td>${escapeHtml(item.telefone)}</td>
    <td>${liderancaLabel}</td>
    <td>${formatDateBR(item.created_at)}</td>
    <td>${formatTimeBR(item.created_at)}</td>
    <td>
      <div class="row-actions">
        <button class="btn btn-outline btn-icon" data-action="edit" data-id="${item.id}" title="Editar">✎</button>
        <button class="btn btn-danger btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑</button>
      </div>
    </td>
  `;
  return tr;
}

function renderTable() {
  state.filteredRows = computeFilteredRows();
  const total = state.filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * state.pageSize;
  const pageRows = state.filteredRows.slice(start, start + state.pageSize);

  tableBody.innerHTML = '';
  if (pageRows.length === 0) {
    tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Nenhum cadastro encontrado.</td></tr>';
  } else {
    pageRows.forEach((item) => tableBody.appendChild(renderRow(item)));
  }

  pageInfo.textContent = `Página ${state.page} de ${totalPages} (${total} cadastros)`;
  btnPrev.disabled = state.page <= 1;
  btnNext.disabled = state.page >= totalPages;

  syncCheckboxes();
  updateBulkBar();
}

function syncCheckboxes() {
  document.querySelectorAll('.row-check').forEach((cb) => {
    cb.checked = state.selected.has(cb.dataset.id);
  });
  checkAll.checked = false;
}

function updateBulkBar() {
  const n = state.selected.size;
  bulkCount.textContent = `${n} selecionado${n === 1 ? '' : 's'}`;
  bulkBar.classList.toggle('show', n > 0);
}

tableBody.addEventListener('change', (e) => {
  if (e.target.classList.contains('row-check')) {
    const id = e.target.dataset.id;
    if (e.target.checked) state.selected.add(id);
    else state.selected.delete(id);
    updateBulkBar();
  }
});

checkAll.addEventListener('change', () => {
  document.querySelectorAll('.row-check').forEach((cb) => {
    cb.checked = checkAll.checked;
    if (checkAll.checked) state.selected.add(cb.dataset.id);
    else state.selected.delete(cb.dataset.id);
  });
  updateBulkBar();
});

btnClearSelection.addEventListener('click', () => {
  state.selected.clear();
  syncCheckboxes();
  updateBulkBar();
});

tableBody.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'edit') openEdit(id);
  if (btn.dataset.action === 'delete') openConfirmDelete(id);
});

function populateLiderancaSelects() {
  const options = state.liderancas
    .map((l) => `<option value="${escapeHtml(l.codigo)}">${escapeHtml(l.nome)}</option>`)
    .join('');

  const prevFilter = filterLideranca.value;
  filterLideranca.innerHTML =
    '<option value="">Todas as lideranças</option><option value="nenhuma">Direto (sem liderança)</option>' + options;
  filterLideranca.value = prevFilter;

  editLidSelect.innerHTML = '<option value="">Direto (sem liderança)</option>' + options;
}

function openEdit(id) {
  const item = state.participantes.find((r) => r.id === id);
  if (!item) return;
  document.getElementById('editId').value = id;
  document.getElementById('editNome').value = item.nome;
  document.getElementById('editTelefone').value = item.telefone;
  editLidSelect.value = item.lideranca_codigo || '';
  editAlert.classList.remove('show');
  modalEdit.hidden = false;
}

btnCancelEdit.addEventListener('click', () => { modalEdit.hidden = true; });

formEdit.addEventListener('submit', async (e) => {
  e.preventDefault();
  const oldId = document.getElementById('editId').value;
  const nome = document.getElementById('editNome').value.trim();
  const telefoneRaw = document.getElementById('editTelefone').value.trim();
  const lideranca_codigo = editLidSelect.value || null;

  if (nome.length < 3) {
    editAlert.textContent = 'Informe o nome completo.';
    editAlert.classList.add('show');
    return;
  }
  const telefoneFormatado = formatPhoneBR(telefoneRaw);
  if (!telefoneFormatado) {
    editAlert.textContent = 'Informe um telefone válido com DDD.';
    editAlert.classList.add('show');
    return;
  }
  const newId = onlyDigits(telefoneRaw);

  try {
    if (newId !== oldId) {
      const existing = await getDoc(doc(db, 'participantes', newId));
      if (existing.exists()) {
        editAlert.textContent = 'Este telefone já pertence a outro cadastro.';
        editAlert.classList.add('show');
        return;
      }
      const original = state.participantes.find((r) => r.id === oldId);
      const batch = writeBatch(db);
      batch.set(doc(db, 'participantes', newId), {
        nome,
        telefone: telefoneFormatado,
        lideranca_codigo,
        created_at: original ? original.created_at : serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      batch.delete(doc(db, 'participantes', oldId));
      await batch.commit();
    } else {
      await updateDoc(doc(db, 'participantes', oldId), {
        nome,
        telefone: telefoneFormatado,
        lideranca_codigo,
        updated_at: serverTimestamp(),
      });
    }
    modalEdit.hidden = true;
  } catch (err) {
    editAlert.textContent = 'Erro ao salvar. Tente novamente.';
    editAlert.classList.add('show');
  }
});

function openConfirmDelete(id) {
  state.pending = { type: 'participante', id };
  confirmText.textContent = 'Tem certeza de que deseja excluir este cadastro?';
  modalConfirm.hidden = false;
}

btnBulkDelete.addEventListener('click', () => {
  if (state.selected.size === 0) return;
  state.pending = { type: 'bulk' };
  confirmText.textContent = `Tem certeza de que deseja excluir ${state.selected.size} cadastro(s) selecionado(s)?`;
  modalConfirm.hidden = false;
});

btnCancelConfirm.addEventListener('click', () => { modalConfirm.hidden = true; });

async function deleteParticipantesBatch(ids) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += 400) chunks.push(ids.slice(i, i + 400));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((id) => batch.delete(doc(db, 'participantes', id)));
    await batch.commit();
  }
}

btnConfirmYes.addEventListener('click', async () => {
  const pending = state.pending;
  if (!pending) { modalConfirm.hidden = true; return; }

  if (pending.type === 'bulk') {
    await deleteParticipantesBatch([...state.selected]);
    state.selected.clear();
  } else if (pending.type === 'participante') {
    await deleteDoc(doc(db, 'participantes', pending.id));
  } else if (pending.type === 'lideranca') {
    await deleteLideranca(pending.id);
  }
  modalConfirm.hidden = true;
  state.pending = null;
});

btnPrev.addEventListener('click', () => { if (state.page > 1) { state.page--; renderTable(); } });
btnNext.addEventListener('click', () => { state.page++; renderTable(); });

searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => { state.page = 1; renderTable(); }, 300);
});
[filterDe, filterAte, filterSort, filterLideranca].forEach((el) => {
  el.addEventListener('change', () => { state.page = 1; renderTable(); });
});

// ---------- Export ----------

function buildExportRows() {
  return state.filteredRows.map((r) => ({
    Nome: r.nome,
    Telefone: r.telefone,
    Lideranca: getLiderancaNome(r.lideranca_codigo) || 'Direto',
    Data: formatDateBR(r.created_at),
    Horario: formatTimeBR(r.created_at),
  }));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('btnExportCsv').addEventListener('click', () => {
  const rows = buildExportRows();
  const header = 'Nome,Telefone,Lideranca,Data,Horario\n';
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const body = rows.map((r) => [esc(r.Nome), esc(r.Telefone), esc(r.Lideranca), r.Data, r.Horario].join(',')).join('\n');
  downloadBlob(new Blob(['﻿' + header + body], { type: 'text/csv;charset=utf-8;' }), 'cadastros_piciani.csv');
});

document.getElementById('btnExportXlsx').addEventListener('click', () => {
  const rows = buildExportRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cadastros');
  XLSX.writeFile(wb, 'cadastros_piciani.xlsx');
});

// ---------- Lideranças ----------

function liderancaNodeHtml(l) {
  const link = `${baseUrl()}?lider=${l.codigo}`;
  const count = state.participantes.filter((p) => p.lideranca_codigo === l.codigo).length;
  return `
    <div class="lideranca-node" data-id="${escapeHtml(l.codigo)}" data-kind="lideranca">
      <div class="lideranca-head">
        <div class="toggle-icon">&#9656;</div>
        <div class="lideranca-info">
          <div class="nome">${escapeHtml(l.nome)}</div>
          <div class="meta">
            <span>${count} cadastro${count === 1 ? '' : 's'}</span>
            ${l.telefone ? `<span>${escapeHtml(l.telefone)}</span>` : ''}
          </div>
          <div class="link-row">
            <code>${escapeHtml(link)}</code>
            <button type="button" class="btn btn-outline btn-sm btn-copy" data-link="${escapeHtml(link)}">Copiar</button>
          </div>
        </div>
        <div class="lideranca-actions">
          <button class="btn btn-outline btn-icon" data-action="edit-lideranca" data-id="${escapeHtml(l.codigo)}" title="Editar">✎</button>
          <button class="btn btn-danger btn-icon" data-action="delete-lideranca" data-id="${escapeHtml(l.codigo)}" title="Excluir">🗑</button>
        </div>
      </div>
      <div class="lideranca-children" id="children-${escapeHtml(l.codigo)}"></div>
    </div>
  `;
}

function childRowHtml(p) {
  return `
    <div class="lideranca-child-row">
      <span class="child-nome">${escapeHtml(p.nome)}</span>
      <span class="child-meta">${escapeHtml(p.telefone)} &middot; ${formatDateBR(p.created_at)} ${formatTimeBR(p.created_at)}</span>
    </div>
  `;
}

function renderLiderancaTree() {
  const diretos = state.participantes.filter(
    (p) => !p.lideranca_codigo || !state.liderancasByCodigo.has(p.lideranca_codigo)
  );

  let html = `
    <div class="lideranca-node" data-id="direto" data-kind="direto">
      <div class="lideranca-head">
        <div class="toggle-icon">&#9656;</div>
        <div class="lideranca-info">
          <div class="nome">Direto (sem liderança)</div>
          <div class="meta"><span>${diretos.length} cadastro${diretos.length === 1 ? '' : 's'}</span></div>
        </div>
      </div>
      <div class="lideranca-children" id="children-direto"></div>
    </div>
  `;

  if (state.liderancas.length === 0) {
    html += '<div class="lideranca-empty">Nenhuma liderança cadastrada ainda. Clique em "+ Nova Liderança" para começar.</div>';
  } else {
    html += state.liderancas.map(liderancaNodeHtml).join('');
  }

  const openIds = [...document.querySelectorAll('.lideranca-node.open')].map((n) => n.dataset.id);
  liderancaTree.innerHTML = html;
  openIds.forEach((id) => {
    const node = liderancaTree.querySelector(`.lideranca-node[data-id="${CSS.escape(id)}"]`);
    if (node) {
      node.classList.add('open');
      fillChildren(node, id, diretos);
    }
  });
}

function fillChildren(node, id, diretos) {
  const container = document.getElementById(`children-${id}`);
  if (!container) return;
  const items = id === 'direto' ? diretos : state.participantes.filter((p) => p.lideranca_codigo === id);
  container.innerHTML = items.length
    ? items.map(childRowHtml).join('')
    : '<div class="lideranca-empty">Nenhum cadastro por aqui ainda.</div>';
}

liderancaTree.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.btn-copy');
  if (copyBtn) {
    e.stopPropagation();
    copyLink(copyBtn.dataset.link);
    return;
  }

  const actionBtn = e.target.closest('button[data-action]');
  if (actionBtn) {
    e.stopPropagation();
    const id = actionBtn.dataset.id;
    if (actionBtn.dataset.action === 'edit-lideranca') openEditLideranca(id);
    if (actionBtn.dataset.action === 'delete-lideranca') openConfirmDeleteLideranca(id);
    return;
  }

  const head = e.target.closest('.lideranca-head');
  if (!head) return;
  const node = head.closest('.lideranca-node');
  const wasOpen = node.classList.contains('open');
  node.classList.toggle('open', !wasOpen);
  if (!wasOpen) {
    const diretos = state.participantes.filter(
      (p) => !p.lideranca_codigo || !state.liderancasByCodigo.has(p.lideranca_codigo)
    );
    fillChildren(node, node.dataset.id, diretos);
  }
});

function copyLink(link) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).catch(() => {});
  }
}

btnNovaLideranca.addEventListener('click', () => {
  liderancaModalTitle.textContent = 'Nova liderança';
  document.getElementById('liderancaId').value = '';
  formLideranca.reset();
  liderancaAlert.classList.remove('show');
  modalLideranca.hidden = false;
});

function openEditLideranca(codigo) {
  const l = state.liderancasByCodigo.get(codigo);
  if (!l) return;
  liderancaModalTitle.textContent = 'Editar liderança';
  document.getElementById('liderancaId').value = l.codigo;
  document.getElementById('liderancaNome').value = l.nome;
  document.getElementById('liderancaTelefone').value = l.telefone || '';
  liderancaAlert.classList.remove('show');
  modalLideranca.hidden = false;
}

function openConfirmDeleteLideranca(codigo) {
  state.pending = { type: 'lideranca', id: codigo };
  confirmText.textContent = 'Tem certeza de que deseja excluir esta liderança? Os cadastros feitos por ela passarão a ficar como "Direto".';
  modalConfirm.hidden = false;
}

async function deleteLideranca(codigo) {
  const affected = state.participantes.filter((p) => p.lideranca_codigo === codigo);
  const chunks = [];
  for (let i = 0; i < affected.length; i += 400) chunks.push(affected.slice(i, i + 400));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((p) => batch.update(doc(db, 'participantes', p.id), { lideranca_codigo: null }));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'liderancas', codigo));
}

btnCancelLideranca.addEventListener('click', () => { modalLideranca.hidden = true; });

formLideranca.addEventListener('submit', async (e) => {
  e.preventDefault();
  const existingCodigo = document.getElementById('liderancaId').value;
  const nome = document.getElementById('liderancaNome').value.trim();
  const telefoneRaw = document.getElementById('liderancaTelefone').value.trim();

  if (nome.length < 3) {
    liderancaAlert.textContent = 'Informe o nome da liderança.';
    liderancaAlert.classList.add('show');
    return;
  }
  let telefone = null;
  if (telefoneRaw) {
    telefone = formatPhoneBR(telefoneRaw);
    if (!telefone) {
      liderancaAlert.textContent = 'Informe um telefone válido com DDD.';
      liderancaAlert.classList.add('show');
      return;
    }
  }

  try {
    if (existingCodigo) {
      await updateDoc(doc(db, 'liderancas', existingCodigo), { nome, telefone });
      modalLideranca.hidden = true;
    } else {
      let codigo = slugify(nome);
      let attempt = codigo;
      let n = 1;
      while ((await getDoc(doc(db, 'liderancas', attempt))).exists()) {
        n += 1;
        attempt = `${codigo}-${n}`;
      }
      codigo = attempt;
      await setDoc(doc(db, 'liderancas', codigo), { nome, telefone, created_at: serverTimestamp() });
      modalLideranca.hidden = true;
      linkGerado.value = `${baseUrl()}?lider=${codigo}`;
      modalLink.hidden = false;
    }
  } catch (err) {
    liderancaAlert.textContent = 'Erro ao salvar liderança.';
    liderancaAlert.classList.add('show');
  }
});

btnCopyLink.addEventListener('click', () => {
  linkGerado.select();
  copyLink(linkGerado.value);
});
btnCloseLink.addEventListener('click', () => { modalLink.hidden = true; });
