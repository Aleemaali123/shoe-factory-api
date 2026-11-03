import { AppError } from '../domain/errors.js';

export function createNoticeService(store) {
  return {
    list(device) {
      return store.noticesFor(device);
    },
    markAllRead(device) {
      store.markNoticesRead(device);
      return store.noticesFor(device);
    },
    markRead(device, id) {
      if (!store.markNoticeRead(device, id)) {
        throw new AppError('That notification could not be found.', 404);
      }
      return store.noticesFor(device);
    },
    dismiss(device, id) {
      if (!store.dismissNotice(device, id)) {
        throw new AppError('That notification could not be found.', 404);
      }
      return store.noticesFor(device);
    },
  };
}
