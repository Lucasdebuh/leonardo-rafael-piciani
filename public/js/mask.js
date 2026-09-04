function applyPhoneMask(input) {
  input.addEventListener('input', () => {
    let digits = input.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 10) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 6) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 2) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length > 0) {
      formatted = `(${digits}`;
    }
    input.value = formatted;
  });
}
