import crypto from 'node:crypto';

import { AppError } from '../domain/errors.js';
import { digits } from '../domain/validators.js';
import { checkPassword, hashPassword } from '../infrastructure/security/passwords.js';

const kinds = new Set(['percent', 'flat', 'shipping']);
const openStatuses = new Set(['confirmed', 'preparing', 'onTheWay']);
const noticeKinds = new Set(['info', 'offer', 'product', 'order']);
const statuses = new Set(['confirmed', 'preparing', 'onTheWay', 'completed', 'cancelled']);

export function createDeskService(store) {
  return {
    coupons() {
      return store.coupons();
    },

    shopCoupons() {
      return store.shopCoupons();
    },

    saveCoupon(input, previousCode) {
      const coupon = normalizeCoupon(input);
      const key = String(previousCode ?? coupon.code).trim().toUpperCase();
      if (store.coupons().some((item) => item.code === coupon.code && item.code !== key)) {
        throw new AppError('That coupon code already exists.');
      }
      return store.saveCoupon(coupon, key);
    },

    deleteCoupon(code) {
      if (!store.deleteCoupon(code)) throw new AppError('That coupon could not be found.', 404);
      return { code: String(code).trim().toUpperCase() };
    },

    branches() {
      return store.branches();
    },

    saveBranch(input, { creating = false } = {}) {
      const branch = normalizeBranch(input);
      if (creating && store.branches().some((item) => item.id === branch.id)) {
        throw new AppError('That branch id already exists.');
      }
      return store.saveBranch(branch);
    },

    deleteBranch(id) {
      if (store.branches().length <= 1) throw new AppError('Keep at least one branch.');
      if (!store.deleteBranch(id)) throw new AppError('That branch could not be found.', 404);
      return { id };
    },

    notices() {
      return store.notices();
    },

    saveNotice(input) {
      const notice = normalizeNotice(store, input);
      return store.saveNotice(notice);
    },

    deleteNotice(id) {
      if (!store.deleteNotice(id)) throw new AppError('That notice could not be found.', 404);
      return { id };
    },

    orders() {
      return store.adminOrders();
    },

    overview() {
      const orders = store.adminOrders();
      const open = orders.filter((order) => openStatuses.has(order.status));
      const booked = orders.filter((order) => order.status !== 'cancelled');
      const fulfilled = orders.filter((order) => order.status === 'completed');
      const attention = store.products()
        .filter((product) => product.listed !== false && Number(product.stock ?? 0) <= 5)
        .map((product) => ({
          id: product.id,
          name: product.name,
          stock: Number(product.stock ?? 0),
          state: Number(product.stock ?? 0) <= 0 ? 'out' : 'low',
        }))
        .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
      const recent = [...orders]
        .sort((a, b) => String(b.placedAt).localeCompare(String(a.placedAt)))
        .slice(0, 5)
        .map((order) => ({
          id: order.id,
          placedAt: order.placedAt,
          contactName: order.contactName,
          status: order.status,
          fulfilment: order.fulfilment,
          total: order.total,
        }));
      return {
        bookedSales: booked.reduce((sum, order) => sum + Number(order.total || 0), 0),
        fulfilledSales: fulfilled.reduce((sum, order) => sum + Number(order.total || 0), 0),
        fulfilledCount: fulfilled.length,
        openOrders: open.length,
        stockAlerts: attention.length,
        attention,
        recent,
        months: monthlyRevenue(booked),
      };
    },

    setOrderStatus(id, status) {
      if (!statuses.has(status)) throw new AppError('Choose a valid order status.');
      const order = store.setOrderStatus(id, status);
      if (!order) throw new AppError('That order could not be found.', 404);
      return order;
    },

    customers() {
      return store.adminCustomers();
    },

    saveCustomer(id, input) {
      const name = String(input.name ?? '').trim();
      const email = String(input.email ?? '').trim();
      const phone = digits(input.phone);
      const city = String(input.city ?? '').trim();
      if (name.length < 2) throw new AppError('Enter a name.');
      const guest = String(id).startsWith('guest-');
      if (!guest && (!email.includes('@') || !email.includes('.'))) {
        throw new AppError('Enter a valid email.');
      }
      if (email && (!email.includes('@') || !email.includes('.'))) {
        throw new AppError('Enter a valid email.');
      }
      if (!/^[6-9]\d{9}$/.test(phone)) throw new AppError('Enter a 10-digit mobile number.');
      if (!guest) {
        const current = store.accountById(id);
        if (!current) throw new AppError('That customer could not be found.', 404);
        const takenEmail = store.accountByEmail(email);
        if (takenEmail && takenEmail.id !== id) throw new AppError('Another account already uses that email.');
        const takenPhone = store.accountByPhone(phone);
        if (takenPhone && takenPhone.id !== id) {
          throw new AppError('Another account already uses that mobile number.');
        }
      }
      const saved = store.saveCustomer({ id, name, email, phone, city });
      if (!saved) throw new AppError('That customer could not be found.', 404);
      return saved;
    },

    profile() {
      return store.adminProfile();
    },

    async login(username, password) {
      const name = String(username ?? '').trim();
      const secret = String(password ?? '');
      const admin = store.adminRecord();
      const sameName = name.toLowerCase() === admin.username.toLowerCase();
      if (!sameName || !(await passwordMatches(secret, admin.passwordHash))) {
        throw new AppError('That username or password does not match.');
      }
      return { profile: store.adminProfile() };
    },

    async updateCredentials(input) {
      const admin = store.adminRecord();
      const current = String(input.currentPassword ?? '');
      if (!(await passwordMatches(current, admin.passwordHash))) {
        throw new AppError('Current password does not match.');
      }
      const username = String(input.username ?? '').trim();
      if (!/^[A-Za-z0-9@._-]{3,64}$/.test(username)) {
        throw new AppError('Use 3–64 letters, numbers, or @ . _ - in the username.');
      }
      const nextPassword = String(input.password ?? '');
      let passwordHash = admin.passwordHash;
      if (nextPassword) {
        if (nextPassword.length < 6) throw new AppError('Use a password of at least 6 characters.');
        passwordHash = await hashPassword(nextPassword);
      }
      return store.saveAdminCredentials({ username, passwordHash });
    },

    updateProfile(input) {
      const name = String(input.name ?? '').trim();
      const email = String(input.email ?? '').trim();
      const phone = digits(input.phone);
      if (name.length < 2) throw new AppError('Enter your name.');
      if (!email.includes('@') || !email.includes('.')) throw new AppError('Enter a valid email.');
      if (!/^[6-9]\d{9}$/.test(phone)) throw new AppError('Enter a 10-digit mobile number.');
      return store.saveAdmin({ name, email, phone });
    },

    requestOtp(phone) {
      const mobile = digits(phone);
      if (!/^[6-9]\d{9}$/.test(mobile)) throw new AppError('Enter a 10-digit mobile number.');
      if (mobile !== store.adminProfile().phone) {
        throw new AppError('That mobile number is not on the admin desk.');
      }
      const code = String(crypto.randomInt(100000, 1000000));
      store.saveOtp(mobile, code, new Date(Date.now() + 5 * 60 * 1000).toISOString());
      return { code };
    },

    verifyOtp(phone, code) {
      const mobile = digits(phone);
      const pending = store.otp(mobile);
      if (!pending || mobile !== store.adminProfile().phone) {
        throw new AppError('Request a code for this mobile number first.');
      }
      if (new Date(pending.expiresAt).getTime() < Date.now()) {
        throw new AppError('That code has expired. Request a new one.');
      }
      if (pending.code !== digits(code)) throw new AppError('That code does not match.');
      store.clearOtp(mobile);
      return { profile: store.adminProfile() };
    },

    restore() {
      store.restoreDesk();
      return {
        branches: store.branches(),
        notices: store.notices(),
        coupons: store.coupons(),
      };
    },
  };
}

function monthlyRevenue(orders, span = 12, now = new Date()) {
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  const months = [];
  for (let i = span - 1; i >= 0; i -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: date.toLocaleDateString('en-IN', { month: 'short' }),
      full: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      revenue: 0,
      orders: 0,
      change: null,
    });
  }
  const index = new Map(months.map((month, position) => [month.key, position]));
  for (const order of orders) {
    const placed = new Date(order.placedAt);
    if (Number.isNaN(placed.getTime())) continue;
    const key = `${placed.getFullYear()}-${String(placed.getMonth() + 1).padStart(2, '0')}`;
    const slot = index.get(key);
    if (slot === undefined) continue;
    months[slot].revenue += Number(order.total || 0);
    months[slot].orders += 1;
  }
  for (let i = 1; i < months.length; i += 1) {
    const previous = months[i - 1].revenue;
    if (previous === 0) continue;
    months[i].change = ((months[i].revenue - previous) / previous) * 100;
  }
  return months;
}

async function passwordMatches(password, passwordHash) {
  if (!password || !passwordHash) return false;
  try {
    return await checkPassword(password, passwordHash);
  } catch {
    return false;
  }
}

function normalizeCoupon(input) {
  const code = String(input.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,16}$/.test(code)) throw new AppError('Use 3–16 letters or numbers.');
  const kind = String(input.kind ?? '');
  if (!kinds.has(kind)) throw new AppError('Choose a coupon kind.');
  const minSubtotal = Math.max(0, Number(input.minSubtotal) || 0);
  let value = 0;
  if (kind === 'percent') {
    value = Number(input.value);
    if (!Number.isFinite(value) || value < 1 || value > 100) {
      throw new AppError('Enter a percent from 1 to 100.');
    }
  } else if (kind === 'flat') {
    value = Number(input.value);
    if (!Number.isFinite(value) || value < 1) throw new AppError('Enter an amount in rupees.');
  }
  return {
    code,
    label: String(input.label ?? '').trim() || code,
    kind,
    value,
    minSubtotal,
    active: input.active !== false,
  };
}

function normalizeBranch(input) {
  const id = String(input.id ?? '').trim().toLowerCase();
  const name = String(input.name ?? '').trim();
  const address = String(input.address ?? '').trim();
  const hours = String(input.hours ?? '').trim();
  const phone = String(input.phone ?? '').trim();
  if (!/^[a-z0-9-]{2,24}$/.test(id)) throw new AppError('Give the branch an id.');
  if (name.length < 2) throw new AppError('Enter the branch name.');
  if (address.length < 4) throw new AppError('Enter the branch address.');
  if (!hours) throw new AppError('Enter the opening hours.');
  if (!phone) throw new AppError('Enter a phone number.');
  return { id, name, address, hours, phone };
}

function normalizeNotice(store, input) {
  const notice = {
    id: String(input.id ?? '').trim() || `n${crypto.randomUUID().slice(0, 8)}`,
    title: String(input.title ?? '').trim(),
    body: String(input.body ?? '').trim(),
    timeLabel: String(input.timeLabel ?? 'Today').trim() || 'Today',
    kind: String(input.kind ?? 'info').trim() || 'info',
    targetId: String(input.targetId ?? '').trim(),
  };
  if (notice.title.length < 2) throw new AppError('Enter a notice title.');
  if (notice.body.length < 2) throw new AppError('Enter the notice.');
  if (!noticeKinds.has(notice.kind)) throw new AppError('Choose what this notice opens.');
  if (notice.kind === 'info') {
    notice.targetId = '';
    return notice;
  }
  if (notice.kind === 'offer') notice.targetId = notice.targetId.toUpperCase();
  if (notice.targetId.length < 2) {
    throw new AppError(notice.kind === 'offer'
      ? 'Enter the coupon code this notice should apply.'
      : notice.kind === 'product'
        ? 'Enter the product id this notice should open.'
        : 'Enter the order id this notice should open.');
  }
  if (notice.kind === 'offer' && !store.coupons().some((coupon) => coupon.code === notice.targetId && coupon.active !== false)) {
    throw new AppError('That coupon is not active.');
  }
  if (notice.kind === 'product' && !store.product(notice.targetId)) {
    throw new AppError('That product could not be found.');
  }
  if (notice.kind === 'order' && !store.adminOrders().some((order) => order.id === notice.targetId)) {
    throw new AppError('That order could not be found.');
  }
  return notice;
}
