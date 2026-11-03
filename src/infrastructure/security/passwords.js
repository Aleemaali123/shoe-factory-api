import bcrypt from 'bcryptjs';

export function hashPassword(password) {
  return bcrypt.hash(password, 8);
}

export function checkPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
