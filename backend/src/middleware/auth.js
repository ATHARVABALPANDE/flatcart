import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function requireHouseholdMember(req, res, next) {
  const householdId = req.params.householdId || req.body.householdId;
  if (!householdId) return res.status(400).json({ error: 'Missing householdId' });

  const membership = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: req.userId, householdId } },
  });
  if (!membership) return res.status(403).json({ error: 'Not a member of this household' });

  req.householdId = householdId;
  next();
}
