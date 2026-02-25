import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory that checks if the authenticated user has the required role.
 * Must be used after the authenticate middleware.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 401 });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
        code: 403,
      });
      return;
    }

    next();
  };
}
