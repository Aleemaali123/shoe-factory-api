import { asyncHandler } from '../middleware/asyncHandler.js';

export function deskController(desk) {
  return {
    publicCoupons: asyncHandler(async (_req, res) => {
      res.json({ data: desk.shopCoupons() });
    }),
    orders: asyncHandler(async (_req, res) => {
      res.json({ data: desk.orders() });
    }),
    overview: asyncHandler(async (_req, res) => {
      res.json({ data: desk.overview() });
    }),
    setOrderStatus: asyncHandler(async (req, res) => {
      res.json({ data: desk.setOrderStatus(req.params.id, req.body?.status) });
    }),
    customers: asyncHandler(async (_req, res) => {
      res.json({ data: desk.customers() });
    }),
    saveCustomer: asyncHandler(async (req, res) => {
      res.json({ data: desk.saveCustomer(req.params.id, req.body ?? {}) });
    }),
    branches: asyncHandler(async (_req, res) => {
      res.json({ data: desk.branches() });
    }),
    createBranch: asyncHandler(async (req, res) => {
      res.status(201).json({ data: desk.saveBranch(req.body ?? {}, { creating: true }) });
    }),
    updateBranch: asyncHandler(async (req, res) => {
      res.json({ data: desk.saveBranch({ ...(req.body ?? {}), id: req.params.id }) });
    }),
    deleteBranch: asyncHandler(async (req, res) => {
      res.json({ data: desk.deleteBranch(req.params.id) });
    }),
    coupons: asyncHandler(async (_req, res) => {
      res.json({ data: desk.coupons() });
    }),
    createCoupon: asyncHandler(async (req, res) => {
      res.status(201).json({ data: desk.saveCoupon(req.body ?? {}) });
    }),
    updateCoupon: asyncHandler(async (req, res) => {
      const previous = req.body?.previousCode || req.params.code;
      res.json({ data: desk.saveCoupon(req.body ?? {}, previous) });
    }),
    deleteCoupon: asyncHandler(async (req, res) => {
      res.json({ data: desk.deleteCoupon(req.params.code) });
    }),
    notices: asyncHandler(async (_req, res) => {
      res.json({ data: desk.notices() });
    }),
    createNotice: asyncHandler(async (req, res) => {
      res.status(201).json({ data: desk.saveNotice(req.body ?? {}) });
    }),
    updateNotice: asyncHandler(async (req, res) => {
      res.json({ data: desk.saveNotice({ ...(req.body ?? {}), id: req.params.id }) });
    }),
    deleteNotice: asyncHandler(async (req, res) => {
      res.json({ data: desk.deleteNotice(req.params.id) });
    }),
    restore: asyncHandler(async (_req, res) => {
      res.json({ data: desk.restore() });
    }),
    profile: asyncHandler(async (_req, res) => {
      res.json({ data: desk.profile() });
    }),
    updateProfile: asyncHandler(async (req, res) => {
      res.json({ data: desk.updateProfile(req.body ?? {}) });
    }),
    login: asyncHandler(async (req, res) => {
      res.json({ data: await desk.login(req.body?.username, req.body?.password) });
    }),
    updateCredentials: asyncHandler(async (req, res) => {
      res.json({ data: await desk.updateCredentials(req.body ?? {}) });
    }),
    requestOtp: asyncHandler(async (req, res) => {
      res.json({ data: desk.requestOtp(req.body?.phone) });
    }),
    verifyOtp: asyncHandler(async (req, res) => {
      res.json({ data: desk.verifyOtp(req.body?.phone, req.body?.code) });
    }),
  };
}
