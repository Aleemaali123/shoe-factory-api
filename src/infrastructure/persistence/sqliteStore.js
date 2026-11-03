import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { AppError } from '../../domain/errors.js';
import { orderUpdateNotice } from '../../domain/notices.js';
import { defaultCoupons, shopCoupons } from '../../domain/pricing.js';
import { hashPassword } from '../security/passwords.js';
import { createSeed, notices as demoNotices, products as demoProducts, sampleOrders } from './seed.js';

const schema = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  old_price INTEGER NOT NULL,
  rating REAL NOT NULL,
  review_count INTEGER NOT NULL,
  description TEXT NOT NULL,
  badge TEXT,
  stock INTEGER NOT NULL,
  is_new INTEGER NOT NULL,
  listed INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS product_images (
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (product_id, position)
);
CREATE TABLE IF NOT EXISTS product_colors (
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT NOT NULL,
  PRIMARY KEY (product_id, position)
);
CREATE TABLE IF NOT EXISTS product_sizes (
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY (product_id, position)
);
CREATE TABLE IF NOT EXISTS product_reviews (
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  author TEXT NOT NULL,
  rating REAL NOT NULL,
  comment TEXT NOT NULL,
  PRIMARY KEY (product_id, position)
);
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  hours TEXT NOT NULL,
  phone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  time_label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  target_id TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT,
  city TEXT
);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_phone ON accounts(phone);
CREATE TABLE IF NOT EXISTS addresses (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line TEXT NOT NULL,
  city TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default INTEGER NOT NULL,
  PRIMARY KEY (account_id, id)
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  linked_account_id TEXT,
  coupon_code TEXT
);
CREATE TABLE IF NOT EXISTS cart_items (
  device_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  color TEXT NOT NULL,
  size INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (device_id, id)
);
CREATE TABLE IF NOT EXISTS wishlist_items (
  device_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  PRIMARY KEY (device_id, position)
);
CREATE TABLE IF NOT EXISTS orders (
  device_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  placed_at TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  fulfilment TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL,
  destination TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  coupon_code TEXT,
  payment_reference TEXT,
  branch_id TEXT,
  stock_held INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, id)
);
CREATE INDEX IF NOT EXISTS idx_orders_device ON orders(device_id, position);
CREATE TABLE IF NOT EXISTS order_lines (
  device_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  color TEXT NOT NULL,
  size INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (device_id, order_id, position)
);
CREATE TABLE IF NOT EXISTS device_notice_reads (
  device_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  notice_id TEXT NOT NULL,
  PRIMARY KEY (device_id, position)
);
CREATE TABLE IF NOT EXISTS device_notice_hides (
  device_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  notice_id TEXT NOT NULL,
  PRIMARY KEY (device_id, position)
);
CREATE TABLE IF NOT EXISTS device_notices (
  device_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  time_label TEXT NOT NULL,
  kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  read INTEGER NOT NULL,
  PRIMARY KEY (device_id, id)
);
CREATE TABLE IF NOT EXISTS otps (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  min_subtotal INTEGER NOT NULL,
  active INTEGER NOT NULL
);
`;

const DEFAULT_ADMIN_USERNAME = 'Malik@shoefactory';
const DEFAULT_ADMIN_PASSWORD = 'Malik@123';

function defaultAdmin() {
  return {
    name: 'Factory Admin',
    email: 'admin@shoefactory.shop',
    phone: '9876501234',
    username: DEFAULT_ADMIN_USERNAME,
  };
}

function metaValue(db, key) {
  return db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
}

function ensureColumn(db, table, column, statement) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) db.exec(statement);
}

const accessoryCategories = new Set(['Watches', 'Perfumes', 'Caps', 'Socks']);

function sizeOption(category, size) {
  if (category === 'Watches') return `${size} mm`;
  if (category === 'Perfumes') return `${size} ml`;
  if (category === 'Caps') return `${size} cm`;
  return `UK ${size}`;
}

function addMissingAccessories(data) {
  if (data.products.some((product) => accessoryCategories.has(product.category))) return false;
  const extras = demoProducts.filter((product) => accessoryCategories.has(product.category));
  for (const product of extras) {
    data.products.push({
      ...structuredClone(product),
      listed: product.listed !== false,
    });
  }
  if (!data.notices.some((notice) => notice.id === 'n4')) {
    const notice = demoNotices.find((item) => item.id === 'n4');
    if (notice) data.notices.push({ ...notice });
  }
  return extras.length > 0;
}

function imagesOf(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images
      .filter((image) => image && String(image.url ?? '').trim())
      .map((image, index) => ({
        url: String(image.url).trim(),
        label: String(image.position || image.label || (index === 0 ? 'Front' : 'Detail')),
        color: String(image.color || '').trim(),
      }));
  }
  return (product.imageUrls ?? [])
    .map((url) => String(url ?? '').trim())
    .filter(Boolean)
    .map((url, index) => ({ url, label: index === 0 ? 'Front' : 'Detail', color: '' }));
}

function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const id = row[key];
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  return grouped;
}

function replaceAll(db, data) {
  db.exec('BEGIN IMMEDIATE');
  try {
    writeAll(db, data);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function writeAll(db, data) {
  for (const table of [
    'order_lines',
    'orders',
    'cart_items',
    'wishlist_items',
    'device_notices',
    'device_notice_hides',
    'device_notice_reads',
    'devices',
    'addresses',
    'accounts',
    'product_reviews',
    'product_sizes',
    'product_colors',
    'product_images',
    'products',
    'notices',
    'branches',
    'otps',
    'coupons',
    'meta',
  ]) {
    db.prepare(`DELETE FROM ${table}`).run();
  }

  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('orderSeq', String(data.orderSeq));
  const admin = data.admin ?? defaultAdmin();
  const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
  insertMeta.run('adminName', admin.name);
  insertMeta.run('adminEmail', admin.email);
  insertMeta.run('adminPhone', admin.phone);
  insertMeta.run('adminUsername', admin.username || DEFAULT_ADMIN_USERNAME);
  insertMeta.run('adminPasswordHash', admin.passwordHash || '');
  insertMeta.run('guests', JSON.stringify(data.guests ?? {}));

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, position, name, category, price, old_price, rating, review_count,
      description, badge, stock, is_new, listed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertImage = db.prepare(
    'INSERT INTO product_images (product_id, position, url, label, color) VALUES (?, ?, ?, ?, ?)',
  );
  const insertColor = db.prepare(
    'INSERT INTO product_colors (product_id, position, color) VALUES (?, ?, ?)',
  );
  const insertSize = db.prepare(
    'INSERT INTO product_sizes (product_id, position, size) VALUES (?, ?, ?)',
  );
  const insertReview = db.prepare(
    'INSERT INTO product_reviews (product_id, position, author, rating, comment) VALUES (?, ?, ?, ?, ?)',
  );

  data.products.forEach((product, position) => {
    insertProduct.run(
      product.id,
      position,
      product.name,
      product.category,
      product.price,
      product.oldPrice,
      product.rating ?? 0,
      product.reviewCount ?? 0,
      product.description ?? '',
      product.badge ?? null,
      product.stock ?? 0,
      product.isNew ? 1 : 0,
      product.listed === false ? 0 : 1,
    );
    imagesOf(product).forEach((image, index) => {
      insertImage.run(product.id, index, image.url, image.label, image.color || '');
    });
    (product.colors ?? []).forEach((color, index) => insertColor.run(product.id, index, color));
    (product.sizes ?? []).forEach((size, index) => insertSize.run(product.id, index, size));
    (product.reviews ?? []).forEach((review, index) => {
      insertReview.run(product.id, index, review.author, review.rating, review.comment);
    });
  });

  const insertBranch = db.prepare(
    'INSERT INTO branches (id, position, name, address, hours, phone) VALUES (?, ?, ?, ?, ?, ?)',
  );
  data.branches.forEach((branch, position) => {
    insertBranch.run(branch.id, position, branch.name, branch.address, branch.hours, branch.phone);
  });

  const insertNotice = db.prepare(
    'INSERT INTO notices (id, position, title, body, time_label, kind, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  data.notices.forEach((notice, position) => {
    insertNotice.run(
      notice.id,
      position,
      notice.title,
      notice.body,
      notice.timeLabel,
      notice.kind || 'info',
      notice.targetId || '',
    );
  });

  const insertAccount = db.prepare(
    'INSERT INTO accounts (id, name, email, phone, password_hash, created_at, city) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const insertAddress = db.prepare(`
    INSERT INTO addresses (
      account_id, id, position, label, name, phone, line, city, pincode, is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const account of data.accounts) {
    insertAccount.run(
      account.id,
      account.name,
      account.email,
      account.phone,
      account.passwordHash,
      account.createdAt ?? null,
      account.city ?? '',
    );
    (account.addresses ?? []).forEach((address, position) => {
      insertAddress.run(
        account.id,
        address.id,
        position,
        address.label,
        address.name,
        address.phone,
        address.line,
        address.city,
        address.pincode,
        address.isDefault ? 1 : 0,
      );
    });
  }

  const insertDevice = db.prepare(
    'INSERT INTO devices (id, linked_account_id, coupon_code) VALUES (?, ?, ?)',
  );
  const insertCartItem = db.prepare(`
    INSERT INTO cart_items (
      device_id, id, position, product_id, name, image_url, unit_price, color, size, quantity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertWish = db.prepare(
    'INSERT INTO wishlist_items (device_id, position, product_id) VALUES (?, ?, ?)',
  );
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      device_id, id, position, placed_at, subtotal, discount, delivery_fee, total,
      fulfilment, payment_method, status, destination, contact_name, contact_phone,
      coupon_code, payment_reference, branch_id, stock_held
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLine = db.prepare(`
    INSERT INTO order_lines (
      device_id, order_id, position, product_id, name, image_url, unit_price, color, size, quantity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRead = db.prepare(
    'INSERT INTO device_notice_reads (device_id, position, notice_id) VALUES (?, ?, ?)',
  );
  const insertHide = db.prepare(
    'INSERT INTO device_notice_hides (device_id, position, notice_id) VALUES (?, ?, ?)',
  );
  const insertDeviceNotice = db.prepare(`
    INSERT INTO device_notices (
      device_id, id, position, title, body, time_label, kind, target_id, read
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const device of Object.values(data.devices)) {
    insertDevice.run(device.id, device.linkedAccountId ?? null, device.cart?.couponCode ?? null);
    (device.cart?.items ?? []).forEach((item, position) => {
      insertCartItem.run(
        device.id,
        item.id,
        position,
        item.productId,
        item.name,
        item.imageUrl ?? '',
        item.unitPrice,
        item.color,
        item.size,
        item.quantity,
      );
    });
    (device.wishlist ?? []).forEach((productId, position) => {
      insertWish.run(device.id, position, productId);
    });
    (device.orders ?? []).forEach((order, position) => {
      insertOrder.run(
        device.id,
        order.id,
        position,
        order.placedAt,
        order.subtotal,
        order.discount,
        order.deliveryFee,
        order.total,
        order.fulfilment,
        order.paymentMethod,
        order.status,
        order.destination ?? '',
        order.contactName ?? '',
        order.contactPhone ?? '',
        order.couponCode ?? null,
        order.paymentReference ?? null,
        order.branchId ?? null,
        order.stockHeld ? 1 : 0,
      );
      (order.lines ?? []).forEach((line, index) => {
        insertLine.run(
          device.id,
          order.id,
          index,
          line.productId,
          line.name,
          line.imageUrl ?? '',
          line.unitPrice,
          line.color,
          line.size,
          line.quantity,
        );
      });
    });
    (device.readNoticeIds ?? []).forEach((noticeId, position) => {
      insertRead.run(device.id, position, noticeId);
    });
    (device.hiddenNoticeIds ?? []).forEach((noticeId, position) => {
      insertHide.run(device.id, position, noticeId);
    });
    (device.notices ?? []).forEach((notice, position) => {
      insertDeviceNotice.run(
        device.id,
        notice.id,
        position,
        notice.title,
        notice.body,
        notice.timeLabel,
        notice.kind || 'info',
        notice.targetId || '',
        notice.read ? 1 : 0,
      );
    });
  }

  const insertOtp = db.prepare('INSERT INTO otps (phone, code, expires_at) VALUES (?, ?, ?)');
  for (const [phone, otp] of Object.entries(data.otps ?? {})) {
    insertOtp.run(phone, otp.code, otp.expiresAt);
  }

  const insertCoupon = db.prepare(
    'INSERT INTO coupons (code, position, label, kind, value, min_subtotal, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  (data.coupons ?? defaultCoupons).forEach((coupon, position) => {
    insertCoupon.run(
      coupon.code,
      position,
      coupon.label,
      coupon.kind,
      coupon.value ?? 0,
      coupon.minSubtotal ?? 0,
      coupon.active === false ? 0 : 1,
    );
  });
}

function readDocument(db) {
  const orderRow = db.prepare(`SELECT value FROM meta WHERE key = 'orderSeq'`).get();
  const images = groupBy(
    db.prepare('SELECT * FROM product_images ORDER BY product_id, position').all(),
    'product_id',
  );
  const colors = groupBy(
    db.prepare('SELECT * FROM product_colors ORDER BY product_id, position').all(),
    'product_id',
  );
  const sizes = groupBy(
    db.prepare('SELECT * FROM product_sizes ORDER BY product_id, position').all(),
    'product_id',
  );
  const reviews = groupBy(
    db.prepare('SELECT * FROM product_reviews ORDER BY product_id, position').all(),
    'product_id',
  );
  const products = db.prepare('SELECT * FROM products ORDER BY position').all().map((row) => {
    const photos = images.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.price,
      oldPrice: row.old_price,
      rating: row.rating,
      reviewCount: row.review_count,
      imageUrls: photos.map((photo) => photo.url),
      images: photos.map((photo) => ({
        url: photo.url,
        position: photo.label,
        color: photo.color || '',
      })),
      description: row.description,
      badge: row.badge,
      colors: (colors.get(row.id) ?? []).map((item) => item.color),
      sizes: (sizes.get(row.id) ?? []).map((item) => item.size),
      stock: row.stock,
      isNew: row.is_new === 1,
      listed: row.listed === 1,
      reviews: (reviews.get(row.id) ?? []).map((review) => ({
        author: review.author,
        rating: review.rating,
        comment: review.comment,
      })),
    };
  });

  const addresses = groupBy(
    db.prepare('SELECT * FROM addresses ORDER BY account_id, position').all(),
    'account_id',
  );
  const accounts = db.prepare('SELECT * FROM accounts').all().map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    createdAt: row.created_at ?? null,
    city: row.city ?? '',
    addresses: (addresses.get(row.id) ?? []).map((address) => ({
      id: address.id,
      label: address.label,
      name: address.name,
      phone: address.phone,
      line: address.line,
      city: address.city,
      pincode: address.pincode,
      isDefault: address.is_default === 1,
    })),
  }));

  const cartItems = groupBy(
    db.prepare('SELECT * FROM cart_items ORDER BY device_id, position').all(),
    'device_id',
  );
  const wishes = groupBy(
    db.prepare('SELECT * FROM wishlist_items ORDER BY device_id, position').all(),
    'device_id',
  );
  const lines = groupBy(
    db.prepare('SELECT * FROM order_lines ORDER BY device_id, order_id, position').all(),
    'device_id',
  );
  const orders = groupBy(
    db.prepare('SELECT * FROM orders ORDER BY device_id, position').all(),
    'device_id',
  );
  const reads = groupBy(
    db.prepare('SELECT * FROM device_notice_reads ORDER BY device_id, position').all(),
    'device_id',
  );
  const hides = groupBy(
    db.prepare('SELECT * FROM device_notice_hides ORDER BY device_id, position').all(),
    'device_id',
  );
  const deviceNotices = groupBy(
    db.prepare('SELECT * FROM device_notices ORDER BY device_id, position').all(),
    'device_id',
  );
  const devices = {};
  for (const row of db.prepare('SELECT * FROM devices').all()) {
    const deviceLines = groupBy(lines.get(row.id) ?? [], 'order_id');
    devices[row.id] = {
      id: row.id,
      linkedAccountId: row.linked_account_id,
      cart: {
        items: (cartItems.get(row.id) ?? []).map((item) => ({
          id: item.id,
          productId: item.product_id,
          name: item.name,
          imageUrl: item.image_url,
          unitPrice: item.unit_price,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
        })),
        couponCode: row.coupon_code,
      },
      wishlist: (wishes.get(row.id) ?? []).map((item) => item.product_id),
      orders: (orders.get(row.id) ?? []).map((order) => ({
        id: order.id,
        placedAt: order.placed_at,
        lines: (deviceLines.get(order.id) ?? []).map((line) => ({
          productId: line.product_id,
          name: line.name,
          imageUrl: line.image_url,
          unitPrice: line.unit_price,
          color: line.color,
          size: line.size,
          quantity: line.quantity,
        })),
        subtotal: order.subtotal,
        discount: order.discount,
        deliveryFee: order.delivery_fee,
        total: order.total,
        fulfilment: order.fulfilment,
        paymentMethod: order.payment_method,
        status: order.status,
        destination: order.destination,
        contactName: order.contact_name,
        contactPhone: order.contact_phone,
        couponCode: order.coupon_code,
        paymentReference: order.payment_reference,
        branchId: order.branch_id ?? '',
        stockHeld: order.stock_held === 1,
      })),
      readNoticeIds: (reads.get(row.id) ?? []).map((item) => item.notice_id),
      hiddenNoticeIds: (hides.get(row.id) ?? []).map((item) => item.notice_id),
      notices: (deviceNotices.get(row.id) ?? []).map((notice) => ({
        id: notice.id,
        title: notice.title,
        body: notice.body,
        timeLabel: notice.time_label,
        kind: notice.kind || 'info',
        targetId: notice.target_id || '',
        read: notice.read === 1,
      })),
    };
  }

  const otps = {};
  for (const row of db.prepare('SELECT * FROM otps').all()) {
    otps[row.phone] = { code: row.code, expiresAt: row.expires_at };
  }

  return {
    orderSeq: Number(orderRow?.value ?? 10242),
    products,
    branches: db.prepare('SELECT * FROM branches ORDER BY position').all().map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      hours: row.hours,
      phone: row.phone,
    })),
    notices: db.prepare('SELECT * FROM notices ORDER BY position').all().map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      timeLabel: row.time_label,
      kind: row.kind || 'info',
      targetId: row.target_id || '',
    })),
    accounts,
    devices,
    otps,
    coupons: db.prepare('SELECT * FROM coupons ORDER BY position').all().map((row) => ({
      code: row.code,
      label: row.label,
      kind: row.kind,
      value: row.value,
      minSubtotal: row.min_subtotal,
      active: row.active === 1,
    })),
    guests: parseGuests(metaValue(db, 'guests')),
    admin: {
      name: metaValue(db, 'adminName') || defaultAdmin().name,
      email: metaValue(db, 'adminEmail') || defaultAdmin().email,
      phone: metaValue(db, 'adminPhone') || defaultAdmin().phone,
      username: metaValue(db, 'adminUsername') || DEFAULT_ADMIN_USERNAME,
      passwordHash: metaValue(db, 'adminPasswordHash') || '',
    },
  };
}

function parseGuests(raw) {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function freshDocument(passwordHash) {
  const data = createSeed({ passwordHash });
  data.products = structuredClone(demoProducts).map((product) => ({
    ...product,
    listed: product.listed !== false,
  }));
  data.guests = data.guests ?? {};
  data.devices['device-showcase'] = {
    id: 'device-showcase',
    linkedAccountId: 'account-shopper',
    cart: { items: [], couponCode: null },
    wishlist: [],
      orders: sampleOrders(),
      readNoticeIds: [],
      hiddenNoticeIds: [],
      notices: [],
    };
  return data;
}

export class SqliteStore {
  constructor(db, data) {
    this.db = db;
    this.data = data;
  }

  save() {
    replaceAll(this.db, this.data);
  }

  products() {
    return this.data.products;
  }

  product(id) {
    return this.data.products.find((item) => item.id === id) ?? null;
  }

  adjustStock(lines, direction) {
    const signed = direction < 0 ? -1 : 1;
    if (signed < 0) {
      for (const line of lines) {
        const product = this.product(line.productId);
        const name = line.name || 'That pair';
        if (!product || product.listed === false) {
          throw new AppError(`${name} is no longer available.`);
        }
        const colors = product.colors ?? [];
        if (colors.length && line.color && !colors.includes(line.color)) {
          throw new AppError(`${name} is not available in ${line.color}.`);
        }
        const sizes = (product.sizes ?? []).map(Number);
        if (sizes.length && !sizes.includes(Number(line.size))) {
          throw new AppError(`${name} is not available in ${sizeOption(product.category, line.size)}.`);
        }
        if (product.stock < Number(line.quantity)) {
          throw new AppError(`Only ${product.stock} of ${name} left.`);
        }
      }
    }
    for (const line of lines) {
      const product = this.product(line.productId);
      if (!product) continue;
      product.stock = Math.max(0, product.stock + signed * Number(line.quantity));
    }
  }

  saveProduct(product) {
    const index = this.data.products.findIndex((item) => item.id === product.id);
    if (index >= 0) this.data.products[index] = product;
    else this.data.products.unshift(product);
    this.save();
    return product;
  }

  deleteProduct(id) {
    const before = this.data.products.length;
    this.data.products = this.data.products.filter((item) => item.id !== id);
    if (this.data.products.length === before) return false;
    this.save();
    return true;
  }

  branches() {
    return this.data.branches;
  }

  noticesFor(device) {
    const read = new Set(device.readNoticeIds ?? []);
    const hidden = new Set(device.hiddenNoticeIds ?? []);
    const personal = (device.notices ?? []).map((notice) => presentNotice(notice, notice.read === true));
    const shop = this.data.notices
      .filter((notice) => !hidden.has(notice.id))
      .map((notice) => presentNotice(notice, read.has(notice.id)));
    return [...personal, ...shop];
  }

  markNoticesRead(device) {
    device.readNoticeIds = this.data.notices.map((notice) => notice.id);
    for (const notice of device.notices ?? []) notice.read = true;
    this.save();
  }

  markNoticeRead(device, id) {
    const personal = (device.notices ?? []).find((notice) => notice.id === id);
    if (personal) {
      personal.read = true;
      this.save();
      return true;
    }
    if (!this.data.notices.some((notice) => notice.id === id)) return false;
    const ids = new Set(device.readNoticeIds ?? []);
    ids.add(id);
    device.readNoticeIds = [...ids];
    this.save();
    return true;
  }

  dismissNotice(device, id) {
    const personal = device.notices ?? [];
    const index = personal.findIndex((notice) => notice.id === id);
    if (index >= 0) {
      personal.splice(index, 1);
      device.notices = personal;
      this.save();
      return true;
    }
    if (!this.data.notices.some((notice) => notice.id === id)) return false;
    const ids = new Set(device.hiddenNoticeIds ?? []);
    ids.add(id);
    device.hiddenNoticeIds = [...ids];
    this.save();
    return true;
  }

  pushNotice(device, input) {
    const notice = {
      id: `dn-${crypto.randomUUID().slice(0, 10)}`,
      title: String(input.title ?? '').trim(),
      body: String(input.body ?? '').trim(),
      timeLabel: formatNoticeTime(new Date()),
      kind: String(input.kind ?? 'info') || 'info',
      targetId: String(input.targetId ?? ''),
      read: false,
    };
    device.notices = [notice, ...(device.notices ?? [])];
    return notice;
  }

  createDevice() {
    const id = `device-${crypto.randomUUID()}`;
    const device = {
      id,
      linkedAccountId: null,
      cart: { items: [], couponCode: null },
      wishlist: [],
      orders: [],
      readNoticeIds: [],
      hiddenNoticeIds: [],
      notices: [],
    };
    this.data.devices[id] = device;
    this.save();
    return device;
  }

  device(id) {
    const device = this.data.devices[id];
    if (!device) throw new AppError('Sign in is required.', 401);
    return device;
  }

  accountById(id) {
    return this.data.accounts.find((account) => account.id === id) ?? null;
  }

  accountByEmail(email) {
    const key = String(email ?? '').trim().toLowerCase();
    return this.data.accounts.find((account) => account.email.toLowerCase() === key) ?? null;
  }

  accountByPhone(phone) {
    return this.data.accounts.find((account) => account.phone === phone) ?? null;
  }

  linkedAccount(device) {
    if (!device.linkedAccountId) return null;
    return this.accountById(device.linkedAccountId);
  }

  link(device, account) {
    device.linkedAccountId = account.id;
    this.save();
  }

  unlink(device) {
    device.linkedAccountId = null;
    this.save();
  }

  saveAccount(account) {
    const index = this.data.accounts.findIndex((item) => item.id === account.id);
    if (index >= 0) this.data.accounts[index] = account;
    else this.data.accounts.push(account);
    this.save();
  }

  nextOrderId() {
    const id = `SF-${this.data.orderSeq}`;
    this.data.orderSeq += 1;
    return id;
  }

  saveOtp(phone, code, expiresAt) {
    this.data.otps[phone] = { code, expiresAt };
    this.save();
  }

  otp(phone) {
    return this.data.otps[phone] ?? null;
  }

  clearOtp(phone) {
    delete this.data.otps[phone];
    this.save();
  }

  coupons() {
    return this.data.coupons ?? [];
  }

  shopCoupons() {
    return shopCoupons(this.coupons());
  }

  saveCoupon(coupon, previousCode) {
    const code = String(coupon.code ?? '').trim().toUpperCase();
    const key = String(previousCode ?? code).trim().toUpperCase();
    const next = {
      code,
      label: String(coupon.label ?? code).trim() || code,
      kind: coupon.kind,
      value: Number(coupon.value) || 0,
      minSubtotal: Math.max(0, Number(coupon.minSubtotal) || 0),
      active: coupon.active !== false,
    };
    const list = this.coupons().filter((item) => item.code !== key && item.code !== code);
    list.unshift(next);
    this.data.coupons = list;
    this.save();
    return next;
  }

  deleteCoupon(code) {
    const key = String(code).trim().toUpperCase();
    const before = this.coupons().length;
    this.data.coupons = this.coupons().filter((item) => item.code !== key);
    if (this.data.coupons.length === before) return false;
    this.save();
    return true;
  }

  saveBranch(branch) {
    const id = String(branch.id ?? '').trim().toLowerCase();
    const next = {
      id,
      name: String(branch.name ?? '').trim(),
      address: String(branch.address ?? '').trim(),
      hours: String(branch.hours ?? '').trim(),
      phone: String(branch.phone ?? '').trim(),
    };
    const index = this.data.branches.findIndex((item) => item.id === id);
    if (index >= 0) this.data.branches[index] = next;
    else this.data.branches.push(next);
    this.save();
    return next;
  }

  deleteBranch(id) {
    if (this.data.branches.length <= 1) return false;
    const before = this.data.branches.length;
    this.data.branches = this.data.branches.filter((item) => item.id !== id);
    if (this.data.branches.length === before) return false;
    this.save();
    return true;
  }

  notices() {
    return this.data.notices;
  }

  saveNotice(notice) {
    const next = {
      id: String(notice.id ?? '').trim(),
      title: String(notice.title ?? '').trim(),
      body: String(notice.body ?? '').trim(),
      timeLabel: String(notice.timeLabel ?? 'Today').trim() || 'Today',
      kind: String(notice.kind ?? 'info') || 'info',
      targetId: String(notice.targetId ?? ''),
    };
    const index = this.data.notices.findIndex((item) => item.id === next.id);
    if (index >= 0) this.data.notices[index] = next;
    else this.data.notices.unshift(next);
    this.save();
    return next;
  }

  deleteNotice(id) {
    const before = this.data.notices.length;
    this.data.notices = this.data.notices.filter((item) => item.id !== id);
    if (this.data.notices.length === before) return false;
    this.save();
    return true;
  }

  adminRecord() {
    const admin = this.data.admin ?? defaultAdmin();
    return {
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      username: admin.username || DEFAULT_ADMIN_USERNAME,
      passwordHash: admin.passwordHash || '',
    };
  }

  adminProfile() {
    const admin = this.adminRecord();
    return {
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      username: admin.username,
    };
  }

  saveAdmin(profile) {
    const current = this.adminRecord();
    this.data.admin = {
      ...current,
      name: String(profile.name).trim(),
      email: String(profile.email).trim(),
      phone: String(profile.phone).trim(),
    };
    this.save();
    return this.adminProfile();
  }

  saveAdminCredentials({ username, passwordHash }) {
    const current = this.adminRecord();
    this.data.admin = {
      ...current,
      username: String(username).trim(),
      passwordHash,
    };
    this.save();
    return this.adminProfile();
  }

  adminOrders() {
    const rows = new Map();
    for (const device of Object.values(this.data.devices)) {
      for (const order of device.orders ?? []) {
        const customerId = customerKey(this, device, order);
        const current = rows.get(order.id);
        const placedAt = order.placedAt ?? '';
        if (current && current.placedAt >= placedAt) continue;
        rows.set(order.id, {
          ...order,
          branchId: order.branchId ?? '',
          customerId,
        });
      }
    }
    return [...rows.values()];
  }

  setOrderStatus(id, status) {
    const matches = [];
    for (const device of Object.values(this.data.devices)) {
      for (const order of device.orders ?? []) {
        if (order.id === id) matches.push({ device, order });
      }
    }
    if (!matches.length) return null;
    const previous = matches[0].order.status;
    if (previous !== status) {
      if (status === 'cancelled' && matches[0].order.stockHeld) {
        this.adjustStock(matches[0].order.lines, 1);
        for (const hit of matches) hit.order.stockHeld = false;
      } else if (previous === 'cancelled' && !matches[0].order.stockHeld) {
        this.adjustStock(matches[0].order.lines, -1);
        for (const hit of matches) hit.order.stockHeld = true;
      }
      const seen = new Set();
      for (const hit of matches) {
        if (seen.has(hit.device.id)) continue;
        seen.add(hit.device.id);
        this.pushNotice(hit.device, orderUpdateNotice(id, status));
      }
    }
    for (const hit of matches) hit.order.status = status;
    this.save();
    return this.adminOrders().find((order) => order.id === id) ?? null;
  }

  adminCustomers() {
    const orders = this.adminOrders();
    const customers = this.data.accounts.map((account) => presentCustomer(account, orders));
    const known = new Set(customers.map((customer) => customer.id));
    const phones = new Set(this.data.accounts.map((account) => account.phone));
    for (const order of orders) {
      if (known.has(order.customerId) || phones.has(order.contactPhone)) continue;
      known.add(order.customerId);
      const related = orders.filter((item) => item.customerId === order.customerId);
      const profile = (this.data.guests ?? {})[order.customerId] ?? {};
      customers.push({
        id: order.customerId,
        name: profile.name || order.contactName || 'Guest',
        email: profile.email || '',
        phone: profile.phone || order.contactPhone || '',
        city: profile.city || '',
        joinedAt: earliest(related) || order.placedAt,
      });
    }
    return customers;
  }

  saveCustomer(customer) {
    const account = this.accountById(customer.id);
    if (!account) {
      for (const device of Object.values(this.data.devices)) {
        for (const order of device.orders ?? []) {
          if (customerKey(this, device, order) !== customer.id) continue;
          order.contactName = customer.name;
          order.contactPhone = customer.phone;
        }
      }
      const guests = this.data.guests ?? {};
      delete guests[customer.id];
      const nextId = `guest-${customer.phone || customer.id.replace(/^guest-/, '')}`;
      guests[nextId] = {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
      };
      this.data.guests = guests;
      this.save();
      return this.adminCustomers().find((item) => item.id === nextId)
        ?? this.adminCustomers().find((item) => item.phone === customer.phone)
        ?? null;
    }
    for (const device of Object.values(this.data.devices)) {
      for (const order of device.orders ?? []) {
        if (customerKey(this, device, order) !== account.id) continue;
        order.contactName = customer.name;
        order.contactPhone = customer.phone;
      }
    }
    account.name = customer.name;
    account.email = customer.email;
    account.phone = customer.phone;
    const city = String(customer.city ?? '').trim();
    account.city = city;
    if (city) {
      const address = account.addresses.find((item) => item.isDefault) ?? account.addresses[0];
      if (address) address.city = city;
    }
    this.save();
    return presentCustomer(account, this.adminOrders());
  }

  restoreDesk() {
    const seed = createSeed({ passwordHash: '' });
    this.data.branches = seed.branches;
    this.data.notices = seed.notices;
    this.data.coupons = defaultCoupons.map((coupon) => ({ ...coupon }));
    this.save();
  }
}

export async function openStore(filePath, { legacyJsonPath = null } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath, { timeout: 5000 });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(schema);
  ensureColumn(db, 'accounts', 'created_at', 'ALTER TABLE accounts ADD COLUMN created_at TEXT');
  ensureColumn(db, 'accounts', 'city', 'ALTER TABLE accounts ADD COLUMN city TEXT');
  ensureColumn(db, 'orders', 'branch_id', 'ALTER TABLE orders ADD COLUMN branch_id TEXT');
  ensureColumn(db, 'orders', 'stock_held', 'ALTER TABLE orders ADD COLUMN stock_held INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'notices', 'kind', "ALTER TABLE notices ADD COLUMN kind TEXT NOT NULL DEFAULT 'info'");
  ensureColumn(db, 'notices', 'target_id', "ALTER TABLE notices ADD COLUMN target_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'product_images', 'color', "ALTER TABLE product_images ADD COLUMN color TEXT NOT NULL DEFAULT ''");
  const existing = db.prepare(`SELECT value FROM meta WHERE key = 'orderSeq'`).get();
  if (!existing) {
    let data;
    if (legacyJsonPath && fs.existsSync(legacyJsonPath)) {
      data = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8'));
    } else {
      data = freshDocument(await hashPassword('trend'));
    }
    data.coupons = data.coupons?.length ? data.coupons : defaultCoupons.map((coupon) => ({ ...coupon }));
    data.admin = data.admin ?? defaultAdmin();
    replaceAll(db, data);
  }
  const data = readDocument(db);
  data.guests = data.guests ?? {};
  const dropped = dropBrokenAddresses(data);
  const deduped = dedupeOrders(data);
  let dated = false;
  for (const account of data.accounts ?? []) {
    if (!account.createdAt) {
      account.createdAt = '2024-06-01T00:00:00.000Z';
      dated = true;
    }
  }
  const store = new SqliteStore(db, data);
  data.admin = data.admin ?? defaultAdmin();
  let credentials = false;
  if (!data.admin.username) {
    data.admin.username = DEFAULT_ADMIN_USERNAME;
    credentials = true;
  }
  if (!data.admin.passwordHash) {
    data.admin.passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    credentials = true;
  }
  const accessories = addMissingAccessories(data);
  const kinds = backfillNotices(data);
  if (dropped || deduped || dated || kinds || accessories || credentials) store.save();
  if (!data.coupons.length) {
    data.coupons = defaultCoupons.map((coupon) => ({ ...coupon }));
    store.save();
  }
  return store;
}

function presentNotice(notice, read) {
  return {
    id: notice.id,
    title: notice.title,
    body: notice.body,
    timeLabel: notice.timeLabel,
    kind: notice.kind || 'info',
    targetId: notice.targetId || '',
    read,
  };
}

function formatNoticeTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function backfillNotices(data) {
  const presets = {
    n1: { kind: 'order', targetId: 'SF-10241' },
    n2: { kind: 'offer', targetId: 'TREND10' },
    n3: { kind: 'product', targetId: 'sf011' },
  };
  let changed = false;
  for (const notice of data.notices ?? []) {
    const preset = presets[notice.id];
    const unset = !notice.kind || notice.kind === 'info';
    if (preset && unset && !notice.targetId) {
      notice.kind = preset.kind;
      notice.targetId = preset.targetId;
      changed = true;
      continue;
    }
    if (!notice.kind) {
      notice.kind = 'info';
      notice.targetId = notice.targetId || '';
      changed = true;
    } else if (notice.targetId == null) {
      notice.targetId = '';
      changed = true;
    }
  }
  return changed;
}

function dropBrokenAddresses(data) {
  let changed = false;
  for (const account of data.accounts ?? []) {
    const next = (account.addresses ?? []).filter((address) => {
      const line = String(address.line ?? '').trim();
      const pin = String(address.pincode ?? '').replace(/\D/g, '');
      const stub = address.id === 'addr-home'
        && line === '12, MG Road'
        && address.city === 'Thiruvananthapuram'
        && pin === '695001';
      if (stub) return false;
      return line.length >= 5 && pin.length === 6;
    });
    if (next.length !== (account.addresses ?? []).length) {
      account.addresses = next;
      changed = true;
    }
  }
  return changed;
}

function dedupeOrders(data) {
  const seen = new Set();
  let changed = false;
  for (const device of Object.values(data.devices ?? {})) {
    const next = [];
    for (const order of device.orders ?? []) {
      if (seen.has(order.id)) {
        changed = true;
        continue;
      }
      seen.add(order.id);
      next.push(order);
    }
    device.orders = next;
  }
  return changed;
}

function customerKey(store, device, order) {
  if (device.linkedAccountId) return device.linkedAccountId;
  const phone = String(order.contactPhone ?? '');
  const account = store.accountByPhone(phone);
  if (account) return account.id;
  return `guest-${phone || order.id}`;
}

function earliest(orders) {
  return orders.map((order) => order.placedAt).sort()[0] ?? null;
}

function presentCustomer(account, orders) {
  const address = account.addresses.find((item) => item.isDefault) ?? account.addresses[0];
  const related = orders.filter((order) => order.customerId === account.id);
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    city: address?.city || account.city || '',
    joinedAt: account.createdAt || earliest(related) || new Date(0).toISOString(),
  };
}
