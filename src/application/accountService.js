import crypto from 'node:crypto';

import { AppError } from '../domain/errors.js';
import { accountError, addressError, digits, phoneError } from '../domain/validators.js';
import { checkPassword, hashPassword } from '../infrastructure/security/passwords.js';

function resetKey(email) {
  return `reset:${String(email).trim().toLowerCase()}`;
}

function publicAccount(account) {
  if (!account) return null;
  return { name: account.name, email: account.email, phone: account.phone };
}

function requireAccount(store, device) {
  const account = store.linkedAccount(device);
  if (!account) throw new AppError('Sign in is required.', 401);
  return account;
}

export function createAccountService(store) {
  return {
    profile(device) {
      const account = store.linkedAccount(device);
      return {
        user: publicAccount(account),
        addresses: account?.addresses ?? [],
      };
    },

    async register(device, input) {
      const { name, email, phone, password, confirmPassword } = input;
      if (password !== confirmPassword) throw new AppError('Passwords do not match.');
      const error = accountError({ name, email, phone, password, checkPassword: true });
      if (error) throw new AppError(error);
      if (store.accountByEmail(email)) {
        throw new AppError('An account with this email already exists. Sign in instead.');
      }
      if (store.accountByPhone(digits(phone))) {
        throw new AppError('An account with this mobile number already exists. Sign in instead.');
      }
      const account = {
        id: `account-${crypto.randomUUID()}`,
        name: String(name).trim(),
        email: String(email).trim(),
        phone: digits(phone),
        passwordHash: await hashPassword(String(password).trim()),
        addresses: [],
        createdAt: new Date().toISOString(),
      };
      store.saveAccount(account);
      store.link(device, account);
      return this.profile(device);
    },

    async login(device, { email, password }) {
      const trimmedEmail = String(email ?? '').trim();
      if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
        throw new AppError('Enter a valid email.');
      }
      if (String(password ?? '').trim().length < 4) {
        throw new AppError('Use a password of at least 4 characters.');
      }
      const account = store.accountByEmail(trimmedEmail);
      if (!account) throw new AppError('No account uses that email. Create one to continue.');
      const matches = await checkPassword(String(password).trim(), account.passwordHash);
      if (!matches) throw new AppError('That password does not match.');
      store.link(device, account);
      return this.profile(device);
    },

    logout(device) {
      store.unlink(device);
      return this.profile(device);
    },

    requestOtp(phone) {
      const error = phoneError(phone);
      if (error) throw new AppError(error);
      const value = digits(phone);
      const code = String(crypto.randomInt(100000, 1000000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      store.saveOtp(value, code, expiresAt);
      return { code, registered: store.accountByPhone(value) != null };
    },

    async verifyOtp(device, { phone, code }) {
      const pendingError = this._matchOtp(phone, code);
      if (pendingError) throw new AppError(pendingError);
      const account = store.accountByPhone(digits(phone));
      if (!account) return { needsProfile: true, signedIn: false, user: null, addresses: [] };
      store.clearOtp(digits(phone));
      store.link(device, account);
      return { needsProfile: false, signedIn: true, ...this.profile(device) };
    },

    async registerWithOtp(device, { name, email, phone, code }) {
      const pendingError = this._matchOtp(phone, code);
      if (pendingError) throw new AppError(pendingError);
      if (store.accountByPhone(digits(phone))) {
        throw new AppError('An account with this mobile number already exists. Sign in instead.');
      }
      const error = accountError({ name, email, phone });
      if (error) throw new AppError(error);
      if (store.accountByEmail(email)) {
        throw new AppError('An account with this email already exists. Sign in instead.');
      }
      const account = {
        id: `account-${crypto.randomUUID()}`,
        name: String(name).trim(),
        email: String(email).trim(),
        phone: digits(phone),
        passwordHash: await hashPassword(`otp-${Date.now()}`),
        addresses: [],
        createdAt: new Date().toISOString(),
      };
      store.saveAccount(account);
      store.clearOtp(digits(phone));
      store.link(device, account);
      return this.profile(device);
    },

    requestPasswordReset({ email }) {
      const trimmedEmail = String(email ?? '').trim();
      if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
        throw new AppError('Enter a valid email.');
      }
      const account = store.accountByEmail(trimmedEmail);
      if (!account) throw new AppError('No account uses that email.');
      const code = String(crypto.randomInt(100000, 1000000));
      store.saveOtp(
        resetKey(account.email),
        code,
        new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      );
      return { code, phone: account.phone };
    },

    async resetPassword({ email, code, password, confirmPassword }) {
      const trimmedEmail = String(email ?? '').trim();
      if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
        throw new AppError('Enter a valid email.');
      }
      if (password !== confirmPassword) throw new AppError('Passwords do not match.');
      if (String(password ?? '').trim().length < 4) {
        throw new AppError('Use a password of at least 4 characters.');
      }
      const account = store.accountByEmail(trimmedEmail);
      if (!account) throw new AppError('No account uses that email.');
      const pending = store.otp(resetKey(account.email));
      if (!pending) throw new AppError('Request a reset code for this email first.');
      if (new Date(pending.expiresAt).getTime() < Date.now()) {
        throw new AppError('That code has expired. Request a new one.');
      }
      if (pending.code !== digits(code)) throw new AppError('That code does not match.');
      account.passwordHash = await hashPassword(String(password).trim());
      store.saveAccount(account);
      store.clearOtp(resetKey(account.email));
      return { reset: true };
    },

    updateProfile(device, { name, email, phone }) {
      const account = requireAccount(store, device);
      const error = accountError({ name, email, phone });
      if (error) throw new AppError(error);
      const nextEmail = String(email).trim().toLowerCase();
      const takenEmail = store.accountByEmail(email);
      if (account.email.trim().toLowerCase() !== nextEmail && takenEmail && takenEmail.id !== account.id) {
        throw new AppError('Another account already uses that email.');
      }
      const nextPhone = digits(phone);
      const takenPhone = store.accountByPhone(nextPhone);
      if (account.phone !== nextPhone && takenPhone && takenPhone.id !== account.id) {
        throw new AppError('Another account already uses that mobile number.');
      }
      account.name = String(name).trim();
      account.email = String(email).trim();
      account.phone = nextPhone;
      store.saveAccount(account);
      return this.profile(device);
    },

    saveAddress(device, input) {
      const account = requireAccount(store, device);
      const error = addressError(input);
      if (error) throw new AppError(error);
      let isDefault = account.addresses.length === 0;
      if (input.id) {
        const existing = account.addresses.find((address) => address.id === input.id);
        if (existing) isDefault = existing.isDefault;
      }
      const address = {
        id: input.id || `addr-${Date.now()}`,
        label: String(input.label).trim(),
        name: String(input.name).trim(),
        phone: digits(input.phone),
        line: String(input.line).trim(),
        city: String(input.city).trim(),
        pincode: digits(input.pincode),
        isDefault,
      };
      if (address.isDefault) {
        account.addresses = account.addresses.map((item) => (
          item.id === address.id ? item : { ...item, isDefault: false }
        ));
      }
      const index = account.addresses.findIndex((item) => item.id === address.id);
      if (index >= 0) account.addresses[index] = address;
      else account.addresses.push(address);
      if (account.addresses.length && account.addresses.every((item) => !item.isDefault)) {
        account.addresses[0] = { ...account.addresses[0], isDefault: true };
      }
      store.saveAccount(account);
      return account.addresses;
    },

    deleteAddress(device, id) {
      const account = requireAccount(store, device);
      account.addresses = account.addresses.filter((address) => address.id !== id);
      if (account.addresses.length && account.addresses.every((item) => !item.isDefault)) {
        account.addresses[0] = { ...account.addresses[0], isDefault: true };
      }
      store.saveAccount(account);
      return account.addresses;
    },

    setDefault(device, id) {
      const account = requireAccount(store, device);
      account.addresses = account.addresses.map((address) => ({
        ...address,
        isDefault: address.id === id,
      }));
      store.saveAccount(account);
      return account.addresses;
    },

    _matchOtp(phone, code) {
      const value = digits(phone);
      const pending = store.otp(value);
      if (!pending) return 'Request a code for this mobile number first.';
      if (new Date(pending.expiresAt).getTime() < Date.now()) {
        return 'That code has expired. Request a new one.';
      }
      if (pending.code !== digits(code)) return 'That code does not match.';
      return null;
    },
  };
}
