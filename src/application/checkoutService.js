import { AppError } from '../domain/errors.js';
import { calculate } from '../domain/pricing.js';
import { digits } from '../domain/validators.js';

const fulfilments = new Set(['delivery', 'pickup']);
const payments = new Set(['razorpay', 'cod']);

export function createCheckoutService(orderService, store) {
  return {
    quote(device, { fulfilment = 'delivery' } = {}) {
      if (!fulfilments.has(fulfilment)) {
        throw new AppError('Choose home delivery or store pickup.');
      }
      const subtotal = device.cart.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      return calculate({
        subtotal,
        couponCode: device.cart.couponCode,
        pickup: fulfilment === 'pickup',
        coupons: store.coupons(),
      });
    },

    async place(device, input) {
      const fulfilment = input.fulfilment === 'pickup' ? 'pickup' : 'delivery';
      const paymentMethod = payments.has(input.paymentMethod) ? input.paymentMethod : '';
      if (!paymentMethod) throw new AppError('Choose Razorpay or cash on delivery.');
      const contactName = String(input.contactName ?? '').trim();
      const contactPhone = digits(input.contactPhone);
      const destination = String(input.destination ?? '').trim();
      if (contactName.length < 2) throw new AppError('Enter the recipient name.');
      if (destination.length < 5) throw new AppError('Enter where this order should go.');
      if (contactPhone.length !== 10) throw new AppError('Enter a 10-digit phone number.');
      if (paymentMethod === 'razorpay' && !String(input.paymentReference ?? '').trim()) {
        throw new AppError('Complete the Razorpay payment before placing this order.');
      }
      return orderService.place(device, {
        fulfilment,
        paymentMethod,
        contactName,
        contactPhone,
        destination,
        paymentReference: input.paymentReference ?? null,
        branchId: input.branchId ?? null,
      });
    },
  };
}
