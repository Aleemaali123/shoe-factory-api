import { AppError } from '../../../domain/errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function orderController(orderService) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json({ data: orderService.list(req.device) });
    }),
    get: asyncHandler(async (req, res) => {
      const order = orderService.find(req.device, req.params.id);
      if (!order) throw new AppError('That order could not be found.', 404);
      res.json({ data: order });
    }),
    place: asyncHandler(async (req, res) => {
      res.status(201).json({ data: await orderService.place(req.device, req.body) });
    }),
    cancel: asyncHandler(async (req, res) => {
      res.json({ data: orderService.cancel(req.device, req.params.id) });
    }),
    reorder: asyncHandler(async (req, res) => {
      res.json({ data: orderService.reorder(req.device, req.params.id) });
    }),
  };
}
