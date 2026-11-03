export function createSessionService(store, accountService, cartService, wishlistService, orderService, noticeService, branchService, catalogService) {
  return {
    open() {
      const device = store.createDevice();
      return {
        deviceId: device.id,
        bootstrap: this.bootstrap(device),
      };
    },
    bootstrap(device) {
      return {
        user: accountService.profile(device).user,
        addresses: accountService.profile(device).addresses,
        cart: cartService.get(device),
        wishlist: wishlistService.ids(device),
        orders: orderService.list(device),
        notices: noticeService.list(device),
        branches: branchService.list(),
        coupons: store.shopCoupons(),
        products: catalogService.browse(),
        categories: catalogService.categories(),
      };
    },
  };
}
