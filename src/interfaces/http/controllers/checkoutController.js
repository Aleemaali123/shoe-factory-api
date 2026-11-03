import { asyncHandler } from '../middleware/asyncHandler.js';

export function checkoutController(checkoutService) {
  return {
    quote: asyncHandler(async (req, res) => {
      res.json({
        data: checkoutService.quote(req.device, { fulfilment: req.body.fulfilment }),
      });
    }),
    place: asyncHandler(async (req, res) => {
      res.status(201).json({ data: await checkoutService.place(req.device, req.body) });
    }),
  };
}
