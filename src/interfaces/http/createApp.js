import express from 'express';
import cors from 'cors';

import { env } from '../../config/env.js';
import { createAccountService } from '../../application/accountService.js';
import { createCustomerNotifier } from '../../infrastructure/messaging/customerNotifier.js';
import { createBranchService } from '../../application/branchService.js';
import { createCartService } from '../../application/cartService.js';
import { createCatalogService } from '../../application/catalogService.js';
import { createCheckoutService } from '../../application/checkoutService.js';
import { createDeskService } from '../../application/deskService.js';
import { createNoticeService } from '../../application/noticeService.js';
import { createOrderService } from '../../application/orderService.js';
import { createSessionService } from '../../application/sessionService.js';
import { createWishlistService } from '../../application/wishlistService.js';
import { accountController } from './controllers/accountController.js';
import { branchController } from './controllers/branchController.js';
import { cartController } from './controllers/cartController.js';
import { catalogController } from './controllers/catalogController.js';
import { checkoutController } from './controllers/checkoutController.js';
import { deskController } from './controllers/deskController.js';
import { noticeController } from './controllers/noticeController.js';
import { orderController } from './controllers/orderController.js';
import { profileController } from './controllers/profileController.js';
import { sessionController } from './controllers/sessionController.js';
import { wishlistController } from './controllers/wishlistController.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler } from './middleware/errorHandler.js';
import { registerRoutes } from './routes/registerRoutes.js';

export function createApp({ store, tokens }) {
  const catalog = createCatalogService(store);
  const cart = createCartService(store);
  const wishlist = createWishlistService(store);
  const orders = createOrderService(store, cart, createCustomerNotifier({
    channel: env.notifyChannel,
    accountSid: env.twilioAccountSid,
    authToken: env.twilioAuthToken,
    smsFrom: env.twilioSmsFrom,
    whatsappFrom: env.twilioWhatsappFrom,
  }));
  const checkout = createCheckoutService(orders, store);
  const desk = createDeskService(store);
  const account = createAccountService(store);
  const branches = createBranchService(store);
  const notices = createNoticeService(store);
  const session = createSessionService(store, account, cart, wishlist, orders, notices, branches, catalog);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '12mb' }));
  app.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok' } });
  });

  registerRoutes(app, {
    auth: authenticate(store, tokens),
    controllers: {
      session: sessionController(session, tokens),
      catalog: catalogController(catalog),
      branch: branchController(branches),
      account: accountController(account),
      profile: profileController(account),
      checkout: checkoutController(checkout),
      cart: cartController(cart),
      wishlist: wishlistController(wishlist),
      order: orderController(orders),
      notice: noticeController(notices),
      desk: deskController(desk),
    },
  });

  app.use(errorHandler);
  return app;
}
