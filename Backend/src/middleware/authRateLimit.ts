import { Request, Response, NextFunction } from 'express';

interface AttemptWindow { count: number; expiresAt: number }
const attempts = new Map<string, AttemptWindow>();

export function authRateLimit(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`;
    let current = attempts.get(key);
    if (!current || current.expiresAt <= now) {
      current = { count: 0, expiresAt: now + windowMs };
      attempts.set(key, current);
    }

    current.count += 1;
    if (current.count > limit) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((current.expiresAt - now) / 1000)));
      res.status(429).json({ code: 'rate_limited', message: 'Too many attempts. Wait a few minutes and try again.' });
      return;
    }

    // Bound memory use on a long-running single process.
    if (attempts.size > 5000) {
      for (const [attemptKey, window] of attempts) {
        if (window.expiresAt <= now) attempts.delete(attemptKey);
      }
    }
    next();
  };
}
