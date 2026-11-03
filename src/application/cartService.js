import { AppError } from '../domain/errors.js';
import { evaluate } from '../domain/pricing.js';

function publicCart(cart) {
  return { items: cart.items, couponCode: cart.couponCode };
}

function imageForColor(product, color) {
  const images = Array.isArray(product.images) ? product.images : [];
  const match = images.find((image) => image?.color && image.color === color && image.url);
  if (match) return match.url;
  return product.imageUrls?.[0] ?? images[0]?.url ?? '';
}

function capFor(product) {
  return product.stock < 5 ? product.stock : 5;
}

export function createCartService(store) {
  return {
    get(device) {
      return publicCart(device.cart);
    },

    add(device, { productId, size, color, quantity = 1 }) {
      const product = store.product(productId);
      if (!product || product.listed === false) throw new AppError('That pair is no longer available.');
      const colors = product.colors ?? [];
      if (colors.length && !colors.includes(color)) {
        throw new AppError(`${product.name} is not available in that colour.`);
      }
      const sizes = (product.sizes ?? []).map(Number);
      if (sizes.length && !sizes.includes(Number(size))) {
        throw new AppError(`${product.name} is not available in that size.`);
      }
      const imageUrl = imageForColor(product, color);
      if (product.stock <= 0) {
        return { added: false, message: 'This pair is out of stock.', cart: publicCart(device.cart) };
      }
      const id = `${product.id}|${size}|${color}`;
      const existing = device.cart.items.find((item) => item.id === id);
      const currentQty = existing?.quantity ?? 0;
      const cap = capFor(product);
      const requested = currentQty + Number(quantity || 1);
      const next = requested > cap ? cap : requested;
      if (next === currentQty) {
        return {
          added: false,
          message: 'You already have the maximum available for this pair.',
          cart: publicCart(device.cart),
        };
      }
      const item = {
        id,
        productId: product.id,
        name: product.name,
        imageUrl,
        unitPrice: product.price,
        color,
        size: Number(size),
        quantity: next,
      };
      if (existing) {
        const index = device.cart.items.indexOf(existing);
        device.cart.items[index] = item;
      } else {
        device.cart.items.push(item);
      }
      store.save();
      const message = requested > cap
        ? `Only ${cap} of this pair can be added. Your cart was updated.`
        : `${product.name} added to your cart.`;
      return { added: true, message, cart: publicCart(device.cart) };
    },

    setQuantity(device, id, quantity) {
      const next = Number(quantity);
      if (next <= 0) {
        device.cart.items = device.cart.items.filter((item) => item.id !== id);
        store.save();
        return publicCart(device.cart);
      }
      const existing = device.cart.items.find((item) => item.id === id);
      if (!existing) return publicCart(device.cart);
      const product = store.product(existing.productId);
      const cap = product ? capFor(product) : 5;
      existing.quantity = next > cap ? cap : next;
      store.save();
      return publicCart(device.cart);
    },

    remove(device, id) {
      device.cart.items = device.cart.items.filter((item) => item.id !== id);
      store.save();
      return publicCart(device.cart);
    },

    applyCoupon(device, code, { pickup = false } = {}) {
      const subtotal = device.cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const attempt = evaluate({
        subtotal,
        rawCode: code,
        pickup: pickup === true || pickup === 'true',
        coupons: store.coupons(),
      });
      if (attempt.accepted) device.cart.couponCode = attempt.quote.couponCode;
      store.save();
      return { ...attempt, cart: publicCart(device.cart) };
    },

    clearCoupon(device) {
      device.cart.couponCode = null;
      store.save();
      return publicCart(device.cart);
    },

    clear(device) {
      device.cart = { items: [], couponCode: null };
      store.save();
      return publicCart(device.cart);
    },
  };
}
