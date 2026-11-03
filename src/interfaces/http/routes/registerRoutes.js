import { Router } from 'express';

export function registerRoutes(app, { auth, controllers }) {
  const api = Router();

  api.post('/session', controllers.session.open);
  api.get('/session', auth, controllers.session.bootstrap);

  api.get('/catalog/categories', controllers.catalog.categories);
  api.get('/catalog/products', controllers.catalog.list);
  api.get('/catalog/products/:id', controllers.catalog.get);

  api.get('/admin/products', controllers.catalog.adminList);
  api.post('/admin/products', controllers.catalog.create);
  api.put('/admin/products/:id', controllers.catalog.update);
  api.patch('/admin/products/:id/stock', controllers.catalog.adjustStock);
  api.delete('/admin/products/:id', controllers.catalog.remove);
  api.get('/branches', controllers.branch.list);
  api.get('/coupons', controllers.desk.publicCoupons);

  api.get('/admin/orders', controllers.desk.orders);
  api.get('/admin/overview', controllers.desk.overview);
  api.patch('/admin/orders/:id/status', controllers.desk.setOrderStatus);
  api.get('/admin/customers', controllers.desk.customers);
  api.patch('/admin/customers/:id', controllers.desk.saveCustomer);
  api.get('/admin/branches', controllers.desk.branches);
  api.post('/admin/branches', controllers.desk.createBranch);
  api.put('/admin/branches/:id', controllers.desk.updateBranch);
  api.delete('/admin/branches/:id', controllers.desk.deleteBranch);
  api.get('/admin/coupons', controllers.desk.coupons);
  api.post('/admin/coupons', controllers.desk.createCoupon);
  api.put('/admin/coupons/:code', controllers.desk.updateCoupon);
  api.delete('/admin/coupons/:code', controllers.desk.deleteCoupon);
  api.get('/admin/notices', controllers.desk.notices);
  api.post('/admin/notices', controllers.desk.createNotice);
  api.put('/admin/notices/:id', controllers.desk.updateNotice);
  api.delete('/admin/notices/:id', controllers.desk.deleteNotice);
  api.post('/admin/restore', controllers.desk.restore);
  api.get('/admin/profile', controllers.desk.profile);
  api.patch('/admin/profile', controllers.desk.updateProfile);
  api.post('/admin/login', controllers.desk.login);
  api.patch('/admin/credentials', controllers.desk.updateCredentials);
  api.post('/admin/otp/request', controllers.desk.requestOtp);
  api.post('/admin/otp/verify', controllers.desk.verifyOtp);

  api.post('/auth/register', auth, controllers.account.register);
  api.post('/auth/login', auth, controllers.account.login);
  api.post('/auth/logout', auth, controllers.account.logout);
  api.post('/auth/otp/request', controllers.account.requestOtp);
  api.post('/auth/otp/verify', auth, controllers.account.verifyOtp);
  api.post('/auth/otp/register', auth, controllers.account.registerWithOtp);
  api.post('/auth/password/reset/request', controllers.account.requestPasswordReset);
  api.post('/auth/password/reset', controllers.account.resetPassword);
  api.get('/auth/me', auth, controllers.account.me);
  api.patch('/auth/me', auth, controllers.account.updateProfile);

  api.get('/profile', auth, controllers.profile.get);
  api.patch('/profile', auth, controllers.profile.update);
  api.get('/profile/addresses', auth, controllers.profile.addresses);
  api.post('/profile/addresses', auth, controllers.profile.saveAddress);
  api.patch('/profile/addresses/:id', auth, controllers.profile.saveAddress);
  api.delete('/profile/addresses/:id', auth, controllers.profile.deleteAddress);
  api.post('/profile/addresses/:id/default', auth, controllers.profile.setDefaultAddress);

  api.post('/checkout/quote', auth, controllers.checkout.quote);
  api.post('/checkout', auth, controllers.checkout.place);

  api.post('/addresses', auth, controllers.account.saveAddress);
  api.patch('/addresses/:id', auth, controllers.account.saveAddress);
  api.delete('/addresses/:id', auth, controllers.account.deleteAddress);
  api.post('/addresses/:id/default', auth, controllers.account.setDefaultAddress);

  api.get('/cart', auth, controllers.cart.get);
  api.post('/cart/items', auth, controllers.cart.add);
  api.patch('/cart/items/:id', auth, controllers.cart.setQuantity);
  api.delete('/cart/items/:id', auth, controllers.cart.remove);
  api.post('/cart/coupon', auth, controllers.cart.applyCoupon);
  api.delete('/cart/coupon', auth, controllers.cart.clearCoupon);

  api.get('/wishlist', auth, controllers.wishlist.list);
  api.post('/wishlist/:productId', auth, controllers.wishlist.toggle);

  api.get('/orders', auth, controllers.order.list);
  api.get('/orders/:id', auth, controllers.order.get);
  api.post('/orders', auth, controllers.order.place);
  api.post('/orders/:id/cancel', auth, controllers.order.cancel);
  api.post('/orders/:id/reorder', auth, controllers.order.reorder);

  api.get('/notices', auth, controllers.notice.list);
  api.post('/notices/read', auth, controllers.notice.markAllRead);
  api.post('/notices/:id/read', auth, controllers.notice.markRead);
  api.delete('/notices/:id', auth, controllers.notice.dismiss);

  app.use('/api', api);
}
