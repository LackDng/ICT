import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  username: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export function signToken(username: string): string {
  const secret = process.env.JWT_SECRET || 'change-me-in-production';
  const expiry = process.env.JWT_EXPIRY || '8h';
  const jti = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return jwt.sign({ username, jti }, secret, { expiresIn: expiry } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET || 'change-me-in-production';
  return jwt.verify(token, secret) as JwtPayload;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing authorization token' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function handleLogin(req: Request, res: Response): void {
  const { username, password } = req.body as { username: string; password: string };

  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin';

  if (username === adminUser && password === adminPass) {
    const token = signToken(username);
    res.json({ success: true, data: { token, username } });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
}
