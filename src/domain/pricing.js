export const freeDeliveryThreshold = 4999;
export const standardDelivery = 49;

export const defaultCoupons = [
  { code: 'TREND10', label: '10% off', kind: 'percent', value: 10, minSubtotal: 0, active: true },
  { code: 'FACTORY200', label: '₹200 off above ₹1,999', kind: 'flat', value: 200, minSubtotal: 1999, active: true },
  { code: 'FREESHIP', label: 'Free delivery above ₹999', kind: 'shipping', value: 0, minSubtotal: 999, active: true },
];

export function asOffer(coupon) {
  if (!coupon || coupon.active === false) return null;
  const code = String(coupon.code ?? '').trim().toUpperCase();
  if (!code) return null;
  if (coupon.kind === 'percent' || coupon.kind === 'flat' || coupon.kind === 'shipping') {
    return {
      code,
      label: coupon.label || code,
      percent: coupon.kind === 'percent' ? Number(coupon.value) || 0 : 0,
      flatOff: coupon.kind === 'flat' ? Number(coupon.value) || 0 : 0,
      freeShipping: coupon.kind === 'shipping',
      minSubtotal: Number(coupon.minSubtotal) || 0,
    };
  }
  return {
    code,
    label: coupon.label || code,
    percent: Number(coupon.percent) || 0,
    flatOff: Number(coupon.flatOff) || 0,
    freeShipping: Boolean(coupon.freeShipping),
    minSubtotal: Number(coupon.minSubtotal) || 0,
  };
}

export function shopCoupons(list = defaultCoupons) {
  return list.map(asOffer).filter(Boolean);
}

export function findCoupon(code, list = defaultCoupons) {
  if (!code || !String(code).trim()) return null;
  const key = String(code).trim().toUpperCase();
  return shopCoupons(list).find((coupon) => coupon.code === key) ?? null;
}

function deliveryFee({ subtotal, pickup, freeShipping }) {
  if (pickup || subtotal <= 0) return 0;
  if (freeShipping || subtotal >= freeDeliveryThreshold) return 0;
  return standardDelivery;
}

export function calculate({ subtotal, couponCode, pickup, coupons = defaultCoupons }) {
  const coupon = findCoupon(couponCode, coupons);
  let discount = 0;
  let freeShipping = false;
  let appliedCode;
  let appliedLabel;
  if (coupon && subtotal >= coupon.minSubtotal) {
    if (coupon.percent > 0) discount += Math.round((subtotal * coupon.percent) / 100);
    if (coupon.flatOff > 0) discount += coupon.flatOff;
    freeShipping = coupon.freeShipping;
    appliedCode = coupon.code;
    appliedLabel = coupon.label;
  }
  if (discount > subtotal) discount = subtotal;
  const delivery = deliveryFee({ subtotal, pickup, freeShipping });
  const total = Math.max(0, subtotal - discount + delivery);
  return {
    subtotal,
    discount,
    deliveryFee: delivery,
    total,
    couponCode: appliedCode ?? null,
    couponLabel: appliedLabel ?? null,
  };
}

export function evaluate({ subtotal, rawCode, pickup, coupons = defaultCoupons }) {
  const code = String(rawCode ?? '').trim().toUpperCase();
  const plain = calculate({ subtotal, pickup, coupons });
  if (!code) {
    return { accepted: false, message: 'Enter a coupon code.', quote: plain };
  }
  const coupon = findCoupon(code, coupons);
  if (!coupon) {
    const known = shopCoupons(coupons).map((item) => item.code);
    const hint = known.length ? ` Try ${known.join(', ')}.` : '';
    return {
      accepted: false,
      message: `That code is not recognised.${hint}`,
      quote: plain,
    };
  }
  if (subtotal < coupon.minSubtotal) {
    return {
      accepted: false,
      message: `Add a little more to your cart to use ${coupon.code}.`,
      quote: plain,
    };
  }
  const quote = calculate({ subtotal, couponCode: code, pickup, coupons });
  const message = pickup && coupon.freeShipping
    ? `Store pickup is already free. ${coupon.code} is saved on this order.`
    : `${coupon.code} applied. ${coupon.label}.`;
  return { accepted: true, message, quote };
}
