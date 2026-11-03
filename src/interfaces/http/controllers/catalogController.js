import { AppError } from '../../../domain/errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function catalogController(catalogService) {
  return {
    categories: asyncHandler(async (_req, res) => {
      res.json({ data: catalogService.categories() });
    }),
    list: asyncHandler(async (req, res) => {
      res.json({
        data: catalogService.browse({
          query: req.query.query,
          category: req.query.category,
          sort: req.query.sort,
        }),
      });
    }),
    get: asyncHandler(async (req, res) => {
      const product = catalogService.find(req.params.id);
      if (!product) throw new AppError('That pair could not be found.', 404);
      res.json({ data: product });
    }),
    adminList: asyncHandler(async (_req, res) => {
      res.json({ data: catalogService.listAdmin() });
    }),
    create: asyncHandler(async (req, res) => {
      res.status(201).json({ data: catalogService.create(req.body ?? {}) });
    }),
    update: asyncHandler(async (req, res) => {
      res.json({ data: catalogService.update(req.params.id, req.body ?? {}) });
    }),
    adjustStock: asyncHandler(async (req, res) => {
      res.json({ data: catalogService.adjustStock(req.params.id, req.body?.delta) });
    }),
    remove: asyncHandler(async (req, res) => {
      res.json({ data: catalogService.remove(req.params.id) });
    }),
  };
}
