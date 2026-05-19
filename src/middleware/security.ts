import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

const AUTH_TOKEN = process.env.YAZICI_TOKEN || 'yazici-v4-supersecret';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Skipping auth for local dev unless token is set
  if (!process.env.YAZICI_TOKEN) return next();

  const token = req.headers['authorization'];
  if (token === `Bearer ${AUTH_TOKEN}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
