(function () {
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

  let state = {
    page: 1,
    pageSize: 25,
    total: 0,
    selected: new Set(),
    currentRows: [],
    pending: null, // { type: 'participante' | 'bulk' | 'lideranca', id }
    liderancasCache: [],
  };
  let searchDebounce = null;
  let chartInstance = null;

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    if (res.status === 401) {
      showLogin();
      throw new Error('nao_autenticado');
    }
    return res;
  }

  function showLogin() {
    viewLogin.hidden = false;
    viewDashboard.hidden = true;
  }
  function showDashboard() {
    viewLogin.hidden = true;
    viewDashboard.hidden = false;
    loadAll();
  }

  async function checkSession() {
    const res = await fetch('/api/admin/me');
    const data = await res.json();
    if (data.authenticated) showDashboard();
    else showLogin();
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginAlert.classList.remove('show');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      loginAlert.textContent = data.message || 'Falha ao entrar.';
      loginAlert.classList.add('show');
      return;
    }
    formLogin.reset();
    showDashboard();
  });

  btnLogout.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    showLogin();
  });

  // ---------- Tabs ----------

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      tabCadastros.hidden = tab !== 'cadastros';
      tabLiderancas.hidden = tab !== 'liderancas';
      if (tab === 'liderancas') loadLiderancaTree();
    });
  });

  // ---------- Filters / query ----------

  function buildQuery() {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
    if (filterDe.value) params.set('de', filterDe.value);
    if (filterAte.value) params.set('ate', filterAte.value);
    if (filterLideranca.value) params.set('liderancaId', filterLideranca.value);
    params.set('sort', filterSort.value);
    params.set('page', state.page);
    params.set('pageSize', state.pageSize);
    return params.toString();
  }

  async function loadStats() {
    const res = await api('/api/admin/stats');
    const data = await res.json();
    document.getElementById('statTotal').textContent = data.total.toLocaleString('pt-BR');
    document.getElementById('statHoje').textContent = data.hoje.toLocaleString('pt-BR');
    document.getElementById('statSemana').textContent = data.semana.toLocaleString('pt-BR');
    document.getElementById('statMes').textContent = data.mes.toLocaleString('pt-BR');

    const labels = data.series.map((s) => {
      const [, m, d] = s.dia.split('-');
      return `${d}/${m}`;
    });
    const values = data.series.map((s) => s.total);

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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function renderRow(item) {
    const tr = document.createElement('tr');
    const liderancaLabel = item.lideranca_nome
      ? escapeHtml(item.lideranca_nome)
      : '<span class="badge">Direto</span>';
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${item.id}"></td>
      <td>${escapeHtml(item.nome)}</td>
      <td>${escapeHtml(item.telefone)}</td>
      <td>${liderancaLabel}</td>
      <td>${item.data}</td>
      <td>${item.hora}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-outline btn-icon" data-action="edit" data-id="${item.id}" title="Editar">✎</button>
          <button class="btn btn-danger btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑</button>
        </div>
      </td>
    `;
    return tr;
  }

  async function loadTable() {
    tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Carregando...</td></tr>';
    const res = await api(`/api/admin/participantes?${buildQuery()}`);
    const data = await res.json();
    state.total = data.total;
    state.currentRows = data.data;

    tableBody.innerHTML = '';
    if (data.data.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Nenhum cadastro encontrado.</td></tr>';
    } else {
      data.data.forEach((item) => tableBody.appendChild(renderRow(item)));
    }

    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    pageInfo.textContent = `Página ${state.page} de ${totalPages} (${state.total} cadastros)`;
    btnPrev.disabled = state.page <= 1;
    btnNext.disabled = state.page >= totalPages;

    syncCheckboxes();
    updateBulkBar();
  }

  function syncCheckboxes() {
    document.querySelectorAll('.row-check').forEach((cb) => {
      cb.checked = state.selected.has(Number(cb.dataset.id));
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
      const id = Number(e.target.dataset.id);
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      updateBulkBar();
    }
  });

  checkAll.addEventListener('change', () => {
    document.querySelectorAll('.row-check').forEach((cb) => {
      cb.checked = checkAll.checked;
      const id = Number(cb.dataset.id);
      if (checkAll.checked) state.selected.add(id);
      else state.selected.delete(id);
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
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'edit') openEdit(id);
    if (btn.dataset.action === 'delete') openConfirmDelete(id);
  });

  function populateLiderancaSelects() {
    const options = state.liderancasCache
      .map((l) => `<option value="${l.id}">${escapeHtml(l.nome)}</option>`)
      .join('');

    filterLideranca.innerHTML =
      '<option value="">Todas as lideranças</option><option value="nenhuma">Direto (sem liderança)</option>' + options;
    editLidSelect.innerHTML = '<option value="">Direto (sem liderança)</option>' + options;
  }

  function openEdit(id) {
    const item = state.currentRows.find((r) => r.id === id);
    if (!item) return;
    document.getElementById('editId').value = id;
    document.getElementById('editNome').value = item.nome;
    document.getElementById('editTelefone').value = item.telefone;
    editLidSelect.value = item.lideranca_id ? String(item.lideranca_id) : '';
    editAlert.classList.remove('show');
    modalEdit.hidden = false;
  }

  btnCancelEdit.addEventListener('click', () => { modalEdit.hidden = true; });

  formEdit.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const nome = document.getElementById('editNome').value.trim();
    const telefone = document.getElementById('editTelefone').value.trim();
    const lideranca_id = editLidSelect.value || null;

    const res = await api(`/api/admin/participantes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ nome, telefone, lideranca_id }),
    });
    const data = await res.json();
    if (!res.ok) {
      editAlert.textContent = data.error === 'telefone_duplicado' ? 'Este telefone já pertence a outro cadastro.' : 'Erro ao salvar. Verifique os dados.';
      editAlert.classList.add('show');
      return;
    }
    modalEdit.hidden = true;
    loadTable();
    loadLiderancaTree();
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

  btnConfirmYes.addEventListener('click', async () => {
    const pending = state.pending;
    if (!pending) { modalConfirm.hidden = true; return; }

    if (pending.type === 'bulk') {
      await api('/api/admin/participantes/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: [...state.selected] }),
      });
      state.selected.clear();
      modalConfirm.hidden = true;
      loadTable();
      loadStats();
    } else if (pending.type === 'participante') {
      await api(`/api/admin/participantes/${pending.id}`, { method: 'DELETE' });
      modalConfirm.hidden = true;
      loadTable();
      loadStats();
      loadLiderancaTree();
    } else if (pending.type === 'lideranca') {
      await api(`/api/admin/liderancas/${pending.id}`, { method: 'DELETE' });
      modalConfirm.hidden = true;
      loadLiderancasCache();
      loadLiderancaTree();
      loadTable();
    }
    state.pending = null;
  });

  btnPrev.addEventListener('click', () => { if (state.page > 1) { state.page--; loadTable(); } });
  btnNext.addEventListener('click', () => { state.page++; loadTable(); });

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { state.page = 1; loadTable(); }, 350);
  });
  [filterDe, filterAte, filterSort, filterLideranca].forEach((el) => {
    el.addEventListener('change', () => { state.page = 1; loadTable(); });
  });

  document.getElementById('btnExportCsv').addEventListener('click', () => {
    window.location.href = `/api/admin/export/csv?${buildQuery()}`;
  });
  document.getElementById('btnExportXlsx').addEventListener('click', () => {
    window.location.href = `/api/admin/export/xlsx?${buildQuery()}`;
  });

  // ---------- Lideranças ----------

  async function loadLiderancasCache() {
    const res = await api('/api/admin/liderancas');
    const data = await res.json();
    state.liderancasCache = data.liderancas;
    state.semLideranca = data.semLideranca;
    populateLiderancaSelects();
    return data;
  }

  function liderancaNodeHtml(l) {
    const link = `${window.location.origin}/?lider=${l.codigo}`;
    return `
      <div class="lideranca-node" data-id="${l.id}" data-kind="lideranca">
        <div class="lideranca-head">
          <div class="toggle-icon">&#9656;</div>
          <div class="lideranca-info">
            <div class="nome">${escapeHtml(l.nome)}</div>
            <div class="meta">
              <span>${l.total_cadastros} cadastro${l.total_cadastros === 1 ? '' : 's'}</span>
              ${l.telefone ? `<span>${escapeHtml(l.telefone)}</span>` : ''}
            </div>
            <div class="link-row">
              <code>${escapeHtml(link)}</code>
              <button type="button" class="btn btn-outline btn-sm btn-copy" data-link="${escapeHtml(link)}">Copiar</button>
            </div>
          </div>
          <div class="lideranca-actions">
            <button class="btn btn-outline btn-icon" data-action="edit-lideranca" data-id="${l.id}" title="Editar">✎</button>
            <button class="btn btn-danger btn-icon" data-action="delete-lideranca" data-id="${l.id}" title="Excluir">🗑</button>
          </div>
        </div>
        <div class="lideranca-children" id="children-${l.id}">
          <div class="lideranca-empty">Carregando...</div>
        </div>
      </div>
    `;
  }

  function childRowHtml(p) {
    return `
      <div class="lideranca-child-row">
        <span class="child-nome">${escapeHtml(p.nome)}</span>
        <span class="child-meta">${escapeHtml(p.telefone)} &middot; ${p.data} ${p.hora}</span>
      </div>
    `;
  }

  async function loadLiderancaTree() {
    liderancaTree.innerHTML = '<div class="lideranca-empty">Carregando lideranças...</div>';
    const data = await loadLiderancasCache();

    let html = '';
    html += `
      <div class="lideranca-node" data-id="direto" data-kind="direto">
        <div class="lideranca-head">
          <div class="toggle-icon">&#9656;</div>
          <div class="lideranca-info">
            <div class="nome">Direto (sem liderança)</div>
            <div class="meta"><span>${data.semLideranca} cadastro${data.semLideranca === 1 ? '' : 's'}</span></div>
          </div>
        </div>
        <div class="lideranca-children" id="children-direto">
          <div class="lideranca-empty">Carregando...</div>
        </div>
      </div>
    `;

    if (data.liderancas.length === 0) {
      html += '<div class="lideranca-empty">Nenhuma liderança cadastrada ainda. Clique em "+ Nova Liderança" para começar.</div>';
    } else {
      html += data.liderancas.map(liderancaNodeHtml).join('');
    }

    liderancaTree.innerHTML = html;
  }

  liderancaTree.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.btn-copy');
    if (copyBtn) {
      e.stopPropagation();
      copyLink(copyBtn.dataset.link);
      return;
    }

    const actionBtn = e.target.closest('button[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      const id = Number(actionBtn.dataset.id);
      if (actionBtn.dataset.action === 'edit-lideranca') openEditLideranca(id);
      if (actionBtn.dataset.action === 'delete-lideranca') openConfirmDeleteLideranca(id);
      return;
    }

    const head = e.target.closest('.lideranca-head');
    if (!head) return;
    const node = head.closest('.lideranca-node');
    const wasOpen = node.classList.contains('open');
    node.classList.toggle('open', !wasOpen);
    if (!wasOpen) await loadChildren(node);
  });

  async function loadChildren(node) {
    const id = node.dataset.id;
    const kind = node.dataset.kind;
    const container = document.getElementById(`children-${id}`);
    if (container.dataset.loaded === '1') return;

    let items = [];
    if (kind === 'direto') {
      const res = await api('/api/admin/participantes?liderancaId=nenhuma&pageSize=200&sort=recentes');
      const data = await res.json();
      items = data.data;
    } else {
      const res = await api(`/api/admin/liderancas/${id}/participantes`);
      const data = await res.json();
      items = data.data;
    }

    container.innerHTML = items.length
      ? items.map(childRowHtml).join('')
      : '<div class="lideranca-empty">Nenhum cadastro por aqui ainda.</div>';
    container.dataset.loaded = '1';
  }

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

  function openEditLideranca(id) {
    const l = state.liderancasCache.find((x) => x.id === id);
    if (!l) return;
    liderancaModalTitle.textContent = 'Editar liderança';
    document.getElementById('liderancaId').value = l.id;
    document.getElementById('liderancaNome').value = l.nome;
    document.getElementById('liderancaTelefone').value = l.telefone || '';
    liderancaAlert.classList.remove('show');
    modalLideranca.hidden = false;
  }

  function openConfirmDeleteLideranca(id) {
    state.pending = { type: 'lideranca', id };
    confirmText.textContent = 'Tem certeza de que deseja excluir esta liderança? Os cadastros feitos por ela passarão a ficar como "Direto".';
    modalConfirm.hidden = false;
  }

  btnCancelLideranca.addEventListener('click', () => { modalLideranca.hidden = true; });

  formLideranca.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('liderancaId').value;
    const nome = document.getElementById('liderancaNome').value.trim();
    const telefone = document.getElementById('liderancaTelefone').value.trim();

    const isEdit = Boolean(id);
    const res = await api(isEdit ? `/api/admin/liderancas/${id}` : '/api/admin/liderancas', {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify({ nome, telefone }),
    });
    const data = await res.json();
    if (!res.ok) {
      liderancaAlert.textContent = data.message || 'Erro ao salvar liderança.';
      liderancaAlert.classList.add('show');
      return;
    }

    modalLideranca.hidden = true;
    await loadLiderancasCache();
    loadLiderancaTree();

    if (!isEdit) {
      linkGerado.value = `${window.location.origin}/?lider=${data.codigo}`;
      modalLink.hidden = false;
    }
  });

  btnCopyLink.addEventListener('click', () => {
    linkGerado.select();
    copyLink(linkGerado.value);
  });
  btnCloseLink.addEventListener('click', () => { modalLink.hidden = true; });

  function loadAll() {
    loadStats();
    loadLiderancasCache();
    loadTable();
  }

  checkSession();
})();
