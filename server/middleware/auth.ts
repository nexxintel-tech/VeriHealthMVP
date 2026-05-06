import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, userProfiles } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be set');
  }
  return secret;
})();

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'patient' | 'clinician' | 'admin' | 'institution_admin';
        institutionId?: string | null;
        approvalStatus?: string | null;
        disabledAt?: Date | null;
      };
    }
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const [userData] = await db
      .select({ id: users.id, email: users.email, approvalStatus: users.approvalStatus, disabledAt: users.disabledAt })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!userData) {
      return res.status(403).json({ error: 'User not found' });
    }

    if (userData.disabledAt) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const [profileData] = await db
      .select({ userId: userProfiles.userId, role: userProfiles.role, institutionId: userProfiles.institutionId })
      .from(userProfiles)
      .where(eq(userProfiles.userId, payload.userId))
      .limit(1);

    if (!profileData) {
      return res.status(403).json({ error: 'User profile not found' });
    }

    req.user = {
      id: userData.id,
      email: userData.email,
      role: profileData.role as 'patient' | 'clinician' | 'admin' | 'institution_admin',
      institutionId: profileData.institutionId,
      approvalStatus: userData.approvalStatus,
      disabledAt: userData.disabledAt,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requireRole(...allowedRoles: Array<'patient' | 'clinician' | 'admin' | 'institution_admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
}

export function requireApproved(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role === 'clinician' && req.user.approvalStatus !== 'approved') {
    return res.status(403).json({
      error: 'Account pending approval',
      approvalStatus: req.user.approvalStatus,
    });
  }

  next();
}
