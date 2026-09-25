import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { requireAuth, requireHouseholdMember } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// List households the current user belongs to
router.get('/', async (req, res) => {
  const memberships = await prisma.householdMember.findMany({
    where: { userId: req.userId },
    include: { household: true },
  });
  res.json({ households: memberships.map((m) => m.household) });
});

// Create a new household
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  let inviteCode;
  let attempts = 0;
  while (attempts < 5) {
    inviteCode = generateInviteCode();
    const existing = await prisma.household.findUnique({ where: { inviteCode } });
    if (!existing) break;
    attempts += 1;
  }

  const household = await prisma.household.create({
    data: {
      name,
      inviteCode,
      members: { create: { userId: req.userId } },
    },
  });

  res.status(201).json({ household });
});

// Join an existing household via invite code
router.post('/join', async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'inviteCode is required' });

  const household = await prisma.household.findUnique({
    where: { inviteCode: inviteCode.toUpperCase() },
  });
  if (!household) return res.status(404).json({ error: 'No household with that invite code' });

  const existing = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: req.userId, householdId: household.id } },
  });
  if (existing) return res.status(200).json({ household });

  await prisma.householdMember.create({
    data: { userId: req.userId, householdId: household.id },
  });

  res.status(201).json({ household });
});

// Get household details + members
router.get('/:householdId', requireHouseholdMember, async (req, res) => {
  const household = await prisma.household.findUnique({
    where: { id: req.householdId },
    include: { members: { include: { user: true } } },
  });
  if (!household) return res.status(404).json({ error: 'Household not found' });

  res.json({
    household: {
      id: household.id,
      name: household.name,
      inviteCode: household.inviteCode,
      createdAt: household.createdAt,
      members: household.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        joinedAt: m.joinedAt,
      })),
    },
  });
});

export default router;
