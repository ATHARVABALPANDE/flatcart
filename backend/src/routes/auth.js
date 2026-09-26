import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../asyncHandler.js';

const router = Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

router.post('/signup', ah(async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, name },
  });

  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
}));

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ token: signToken(user.id), user: publicUser(user) });
}));

router.get('/me', requireAuth, ah(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
}));

// Update your own name and/or password. Changing a password requires proving
// you know the current one, so a borrowed open session can't lock the owner
// out of their own account.
router.patch('/me', requireAuth, ah(async (req, res) => {
  const { name, currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const data = {};

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    data.name = name.trim();
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (!currentPassword) {
      return res.status(400).json({ error: 'Enter your current password to change it' });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is not correct' });
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const updated = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ user: publicUser(updated) });
}));

export default router;
