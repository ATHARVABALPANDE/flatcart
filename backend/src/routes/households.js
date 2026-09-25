import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { requireAuth, requireHouseholdMember } from '../middleware/auth.js';
import { STORES } from '../planner.js';

const router = Router();
router.use(requireAuth);

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Rough, editable defaults - actual thresholds vary by city and change often.
const DEFAULT_STORE_SETTINGS = {
  BLINKIT: { deliveryFee: 25, freeDeliveryThreshold: 199 },
  ZEPTO: { deliveryFee: 25, freeDeliveryThreshold: 149 },
  INSTAMART: { deliveryFee: 30, freeDeliveryThreshold: 199 },
  BIGBASKET: { deliveryFee: 30, freeDeliveryThreshold: 600 },
};

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
      storeSettings: {
        create: STORES.map((store) => ({ store, ...DEFAULT_STORE_SETTINGS[store] })),
      },
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

// Get delivery fee / free-delivery-threshold settings for each store
router.get('/:householdId/store-settings', requireHouseholdMember, async (req, res) => {
  let settings = await prisma.storeSetting.findMany({ where: { householdId: req.householdId } });
  if (settings.length === 0) {
    // Household created before this feature existed - seed defaults now.
    await prisma.storeSetting.createMany({
      data: STORES.map((store) => ({ householdId: req.householdId, store, ...DEFAULT_STORE_SETTINGS[store] })),
      skipDuplicates: true,
    });
    settings = await prisma.storeSetting.findMany({ where: { householdId: req.householdId } });
  }
  res.json({ storeSettings: settings });
});

// Update delivery fee / free-delivery-threshold for one store
router.patch('/:householdId/store-settings/:store', requireHouseholdMember, async (req, res) => {
  const { store } = req.params;
  if (!STORES.includes(store)) {
    return res.status(400).json({ error: `store must be one of ${STORES.join(', ')}` });
  }
  const { deliveryFee, freeDeliveryThreshold } = req.body;
  const data = {};
  if (deliveryFee !== undefined) data.deliveryFee = deliveryFee;
  if (freeDeliveryThreshold !== undefined) data.freeDeliveryThreshold = freeDeliveryThreshold;

  const setting = await prisma.storeSetting.upsert({
    where: { householdId_store: { householdId: req.householdId, store } },
    create: { householdId: req.householdId, store, ...DEFAULT_STORE_SETTINGS[store], ...data },
    update: data,
  });

  res.json({ storeSetting: setting });
});

export default router;
