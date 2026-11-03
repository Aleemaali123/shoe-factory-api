import { AppError } from '../domain/errors.js';
import { calculate } from '../domain/pricing.js';
import { orderUpdateNotice } from '../domain/notices.js';

const cancellable = new Set(['confirmed', 'preparing']);

export function createOrderService(store, cartService, notifier = null) {
  return {
    list(device) {
      return device.orders;
    },

    find(device, id) {
      return device.orders.find((order) => order.id === id) ?? null;
    },

    async place(device, input) {
      const items = device.cart.items;
      if (!items.length) throw new AppError('Your cart is empty.');
      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const pickup = input.fulfilment === 'pickup';
      const quote = calculate({
        subtotal,
        couponCode: device.cart.couponCode,
        pickup,
        coupons: store.coupons(),
      });
      store.adjustStock(items, -1);
      const order = {
        id: store.nextOrderId(),
        placedAt: new Date().toISOString(),
        lines: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          imageUrl: item.imageUrl,
          unitPrice: item.unitPrice,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
        })),
        subtotal: quote.subtotal,
        discount: quote.discount,
        deliveryFee: quote.deliveryFee,
        total: quote.total,
        fulfilment: input.fulfilment || 'delivery',
        paymentMethod: input.paymentMethod || 'razorpay',
        status: 'confirmed',
        destination: String(input.destination ?? ''),
        contactName: String(input.contactName ?? ''),
        contactPhone: String(input.contactPhone ?? ''),
        couponCode: quote.couponCode,
        paymentReference: input.paymentReference ?? null,
        branchId: branchFor(store, input),
        stockHeld: true,
      };
      device.orders.unshift(order);
      store.pushNotice(device, orderUpdateNotice(order.id, 'confirmed'));
      cartService.clear(device);
      const customerMessage = notifier ? await notifier.orderConfirmed(order) : '';
      return customerMessage ? { ...order, customerMessage } : order;
    },

    cancel(device, id) {
      const order = this.find(device, id);
      if (!order || !cancellable.has(order.status)) return { cancelled: false, order };
      if (order.stockHeld) {
        store.adjustStock(order.lines, 1);
        order.stockHeld = false;
      }
      order.status = 'cancelled';
      store.pushNotice(device, orderUpdateNotice(order.id, 'cancelled'));
      store.save();
      return { cancelled: true, order };
    },

    reorder(device, id) {
      const order = this.find(device, id);
      if (!order) throw new AppError('That order could not be found.', 404);
      let units = 0;
      for (const line of order.lines) {
        if (!store.product(line.productId)) continue;
        const key = `${line.productId}|${line.size}|${line.color}`;
        const before = device.cart.items.find((item) => item.id === key)?.quantity ?? 0;
        const result = cartService.add(device, {
          productId: line.productId,
          size: line.size,
          color: line.color,
          quantity: line.quantity,
        });
        const after = device.cart.items.find((item) => item.id === key)?.quantity ?? 0;
        if (result.added) units += Math.max(0, after - before);
      }
      return { units, cart: resultCart(device) };
    },
  };
}

function branchFor(store, input) {
  const requested = String(input.branchId ?? '').trim().toLowerCase();
  const branches = store.branches();
  if (requested && branches.some((branch) => branch.id === requested)) return requested;
  if (input.fulfilment !== 'pickup') return '';
  const destination = String(input.destination ?? '').toLowerCase();
  const match = branches.find((branch) => (
    destination.startsWith(branch.name.toLowerCase())
    || destination.includes(branch.address.toLowerCase())
  ));
  return match?.id ?? '';
}

function resultCart(device) {
  return { items: device.cart.items, couponCode: device.cart.couponCode };
}
