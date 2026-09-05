import { db } from './firebase-config.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const btnAbrir = document.getElementById('btnAbrirForm');
const formSection = document.getElementById('formSection');
const form = document.getElementById('formCadastro');
const nomeInput = document.getElementById('nome');
const telefoneInput = document.getElementById('telefone');
const fieldNome = document.getElementById('fieldNome');
const fieldTelefone = document.getElementById('fieldTelefone');
const formAlert = document.getElementById('formAlert');
const cardForm = document.getElementById('cardForm');
const cardSucesso = document.getElementById('cardSucesso');
const btnSubmit = document.getElementById('btnSubmit');
const btnNovoCadastro = document.getElementById('btnNovoCadastro');

applyPhoneMask(telefoneInput);

btnAbrir.addEventListener('click', () => {
  formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => nomeInput.focus(), 400);
});

function showAlert(msg) {
  formAlert.textContent = msg;
  formAlert.classList.add('show');
}
function hideAlert() {
  formAlert.classList.remove('show');
}
function setInvalid(field, invalid) {
  field.classList.toggle('invalid', invalid);
}

function validate() {
  let valid = true;
  hideAlert();

  const nome = nomeInput.value.trim();
  if (nome.length < 3 || !/\s/.test(nome)) {
    setInvalid(fieldNome, true);
    valid = false;
  } else {
    setInvalid(fieldNome, false);
  }

  const digits = onlyDigits(telefoneInput.value);
  if (digits.length < 10 || digits.length > 11) {
    setInvalid(fieldTelefone, true);
    valid = false;
  } else {
    setInvalid(fieldTelefone, false);
  }

  return valid;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate()) return;

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'ENVIANDO...';

  const telefoneId = onlyDigits(telefoneInput.value);
  const telefoneFormatado = formatPhoneBR(telefoneInput.value);
  const lider = new URLSearchParams(window.location.search).get('lider') || null;

  try {
    const ref = doc(db, 'participantes', telefoneId);
    await setDoc(ref, {
      nome: nomeInput.value.trim().replace(/\s+/g, ' ').slice(0, 150),
      telefone: telefoneFormatado,
      lideranca_codigo: lider,
      created_at: serverTimestamp(),
    });

    cardForm.hidden = true;
    cardSucesso.hidden = false;
    form.reset();
  } catch (err) {
    if (err.code === 'permission-denied') {
      showAlert('Este telefone já está cadastrado. Obrigado por já fazer parte!');
    } else {
      showAlert('Erro de conexão. Verifique sua internet e tente novamente.');
    }
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'REALIZAR CADASTRO';
  }
});

btnNovoCadastro.addEventListener('click', () => {
  cardSucesso.hidden = true;
  cardForm.hidden = false;
});
