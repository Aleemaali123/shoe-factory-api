import { asyncHandler } from '../middleware/asyncHandler.js';

export function noticeController(noticeService) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json({ data: noticeService.list(req.device) });
    }),
    markAllRead: asyncHandler(async (req, res) => {
      res.json({ data: noticeService.markAllRead(req.device) });
    }),
    markRead: asyncHandler(async (req, res) => {
      res.json({ data: noticeService.markRead(req.device, req.params.id) });
    }),
    dismiss: asyncHandler(async (req, res) => {
      res.json({ data: noticeService.dismiss(req.device, req.params.id) });
    }),
  };
}
