export function createWishlistService(store) {
  return {
    list(device) {
      return device.wishlist
        .map((id) => store.product(id))
        .filter(Boolean);
    },
    ids(device) {
      return device.wishlist;
    },
    toggle(device, productId) {
      if (!store.product(productId)) return device.wishlist;
      if (device.wishlist.includes(productId)) {
        device.wishlist = device.wishlist.filter((id) => id !== productId);
      } else {
        device.wishlist.unshift(productId);
      }
      store.save();
      return device.wishlist;
    },
  };
}
