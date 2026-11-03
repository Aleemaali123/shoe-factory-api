export function authenticate(store, tokens) {
  return (req, _res, next) => {
    try {
      const deviceId = tokens.read(req.header('authorization'));
      req.device = store.device(deviceId);
      next();
    } catch (error) {
      next(error);
    }
  };
}
