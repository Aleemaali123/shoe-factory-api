export function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function accountError({ name, email, phone, password, checkPassword = false }) {
  if (String(name ?? '').trim().length < 2) return 'Enter your name.';
  const trimmedEmail = String(email ?? '').trim();
  if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) return 'Enter a valid email.';
  if (digits(phone).length !== 10) return 'Enter a 10-digit phone number.';
  if (checkPassword && String(password ?? '').trim().length < 4) {
    return 'Use a password of at least 4 characters.';
  }
  return null;
}

export function addressError({ label, name, phone, line, city, pincode }) {
  if (!String(label ?? '').trim()) return 'Name this address, for example Home or Work.';
  if (String(name ?? '').trim().length < 2) return 'Enter the recipient name.';
  if (digits(phone).length !== 10) return 'Enter a 10-digit phone number.';
  if (String(line ?? '').trim().length < 5) return 'Enter the house and street.';
  if (String(city ?? '').trim().length < 2) return 'Enter the city.';
  if (digits(pincode).length !== 6) return 'Enter a 6-digit PIN code.';
  return null;
}

export function phoneError(phone) {
  const value = digits(phone);
  if (value.length !== 10 || !/^[6-9]/.test(value)) return 'Enter a 10-digit mobile number.';
  return null;
}
