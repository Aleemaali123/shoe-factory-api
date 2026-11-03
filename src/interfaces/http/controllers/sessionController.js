import { asyncHandler } from '../middleware/asyncHandler.js';

export function sessionController(sessionService, tokens) {
  return {
    open: asyncHandler(async (_req, res) => {
      const opened = sessionService.open();
      res.status(201).json({
        data: {
          token: tokens.sign(opened.deviceId),
          ...opened.bootstrap,
        },
      });
    }),
    bootstrap: asyncHandler(async (req, res) => {
      res.json({ data: sessionService.bootstrap(req.device) });
    }),
  };
}
