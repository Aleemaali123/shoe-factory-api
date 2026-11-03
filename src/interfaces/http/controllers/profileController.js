import { asyncHandler } from '../middleware/asyncHandler.js';

export function profileController(accountService) {
  return {
    get: asyncHandler(async (req, res) => {
      res.json({ data: accountService.profile(req.device) });
    }),
    update: asyncHandler(async (req, res) => {
      res.json({ data: accountService.updateProfile(req.device, req.body) });
    }),
    addresses: asyncHandler(async (req, res) => {
      res.json({ data: accountService.profile(req.device).addresses });
    }),
    saveAddress: asyncHandler(async (req, res) => {
      res.json({
        data: accountService.saveAddress(req.device, {
          ...req.body,
          id: req.params.id || req.body.id,
        }),
      });
    }),
    deleteAddress: asyncHandler(async (req, res) => {
      res.json({ data: accountService.deleteAddress(req.device, req.params.id) });
    }),
    setDefaultAddress: asyncHandler(async (req, res) => {
      res.json({ data: accountService.setDefault(req.device, req.params.id) });
    }),
  };
}
