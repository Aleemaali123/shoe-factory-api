import { asyncHandler } from '../middleware/asyncHandler.js';

export function accountController(accountService) {
  return {
    me: asyncHandler(async (req, res) => {
      res.json({ data: accountService.profile(req.device) });
    }),
    register: asyncHandler(async (req, res) => {
      res.status(201).json({ data: await accountService.register(req.device, req.body) });
    }),
    login: asyncHandler(async (req, res) => {
      res.json({ data: await accountService.login(req.device, req.body) });
    }),
    logout: asyncHandler(async (req, res) => {
      res.json({ data: accountService.logout(req.device) });
    }),
    requestOtp: asyncHandler(async (req, res) => {
      res.json({ data: accountService.requestOtp(req.body.phone) });
    }),
    verifyOtp: asyncHandler(async (req, res) => {
      res.json({ data: await accountService.verifyOtp(req.device, req.body) });
    }),
    registerWithOtp: asyncHandler(async (req, res) => {
      res.status(201).json({ data: await accountService.registerWithOtp(req.device, req.body) });
    }),
    requestPasswordReset: asyncHandler(async (req, res) => {
      res.json({ data: accountService.requestPasswordReset(req.body) });
    }),
    resetPassword: asyncHandler(async (req, res) => {
      res.json({ data: await accountService.resetPassword(req.body) });
    }),
    updateProfile: asyncHandler(async (req, res) => {
      res.json({ data: accountService.updateProfile(req.device, req.body) });
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
