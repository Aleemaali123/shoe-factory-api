import { asyncHandler } from '../middleware/asyncHandler.js';

export function cartController(cartService) {
  return {
    get: asyncHandler(async (req, res) => {
      res.json({ data: cartService.get(req.device) });
    }),
    add: asyncHandler(async (req, res) => {
      res.json({ data: cartService.add(req.device, req.body) });
    }),
    setQuantity: asyncHandler(async (req, res) => {
      res.json({ data: cartService.setQuantity(req.device, req.params.id, req.body.quantity) });
    }),
    remove: asyncHandler(async (req, res) => {
      res.json({ data: cartService.remove(req.device, req.params.id) });
    }),
    applyCoupon: asyncHandler(async (req, res) => {
      res.json({ data: cartService.applyCoupon(req.device, req.body.code, { pickup: req.body.pickup }) });
    }),
    clearCoupon: asyncHandler(async (req, res) => {
      res.json({ data: cartService.clearCoupon(req.device) });
    }),
  };
}
