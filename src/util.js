function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

/** Normalizes a Brazilian phone number to "(DD) NNNNN-NNNN" or "(DD) NNNN-NNNN". */
function formatPhoneBR(raw) {
  const digits = onlyDigits(raw).replace(/^0+/, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return null;
}

function formatDateBR(isoLike) {
  const d = new Date(isoLike.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatTimeBR(isoLike) {
  const d = new Date(isoLike.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'lider';
}

module.exports = { onlyDigits, formatPhoneBR, formatDateBR, formatTimeBR, slugify };
