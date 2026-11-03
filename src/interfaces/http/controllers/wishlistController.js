import { asyncHandler } from '../middleware/asyncHandler.js';

export function wishlistController(wishlistService) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json({ data: wishlistService.ids(req.device) });
    }),
    toggle: asyncHandler(async (req, res) => {
      res.json({ data: wishlistService.toggle(req.device, req.params.productId) });
    }),
  };
}
