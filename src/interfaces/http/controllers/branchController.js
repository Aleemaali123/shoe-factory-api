import { asyncHandler } from '../middleware/asyncHandler.js';

export function branchController(branchService) {
  return {
    list: asyncHandler(async (_req, res) => {
      res.json({ data: branchService.list() });
    }),
  };
}
