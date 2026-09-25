import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireHouseholdMember } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const VALID_STORES = ['BLINKIT', 'ZEPTO', 'INSTAMART', 'BIGBASKET', 'OTHER'];

function serializeItem(item) {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    store: item.store,
    note: item.note,
    status: item.status,
    addedBy: item.addedBy ? { id: item.addedBy.id, name: item.addedBy.name } : null,
    orderedBy: item.orderedBy ? { id: item.orderedBy.id, name: item.orderedBy.name } : null,
    orderedAt: item.orderedAt,
    createdAt: item.createdAt,
  };
}

// Get all cart items for a household, grouped by store
router.get('/households/:householdId/cart', requireHouseholdMember, async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { householdId: req.householdId },
    include: { addedBy: true, orderedBy: true },
    orderBy: { createdAt: 'asc' },
  });

  const grouped = {};
  for (const store of VALID_STORES) grouped[store] = [];
  for (const item of items) grouped[item.store].push(serializeItem(item));

  res.json({ items: grouped });
});

// Add an item to the household cart
router.post('/households/:householdId/cart', requireHouseholdMember, async (req, res) => {
  const { name, quantity, store, note } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (store && !VALID_STORES.includes(store)) {
    return res.status(400).json({ error: `store must be one of ${VALID_STORES.join(', ')}` });
  }

  const item = await prisma.cartItem.create({
    data: {
      householdId: req.householdId,
      name,
      quantity: quantity || '1',
      store: store || 'OTHER',
      note: note || null,
      addedById: req.userId,
    },
    include: { addedBy: true, orderedBy: true },
  });

  res.status(201).json({ item: serializeItem(item) });
});

// Mark every pending item for a given store as ordered by the current user
router.patch('/households/:householdId/cart/order-store', requireHouseholdMember, async (req, res) => {
  const { store } = req.body;
  if (!store || !VALID_STORES.includes(store)) {
    return res.status(400).json({ error: `store must be one of ${VALID_STORES.join(', ')}` });
  }

  await prisma.cartItem.updateMany({
    where: { householdId: req.householdId, store, status: 'PENDING' },
    data: { status: 'ORDERED', orderedById: req.userId, orderedAt: new Date() },
  });

  res.json({ ok: true });
});

async function loadItemAndCheckMembership(req, res, next) {
  const item = await prisma.cartItem.findUnique({ where: { id: req.params.itemId } });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const membership = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: req.userId, householdId: item.householdId } },
  });
  if (!membership) return res.status(403).json({ error: 'Not a member of this household' });

  req.cartItem = item;
  next();
}

// Update a single item (quantity, note, status)
router.patch('/cart/:itemId', loadItemAndCheckMembership, async (req, res) => {
  const { quantity, note, status } = req.body;
  const data = {};
  if (quantity !== undefined) data.quantity = quantity;
  if (note !== undefined) data.note = note;
  if (status !== undefined) {
    if (!['PENDING', 'ORDERED'].includes(status)) {
      return res.status(400).json({ error: 'status must be PENDING or ORDERED' });
    }
    data.status = status;
    data.orderedById = status === 'ORDERED' ? req.userId : null;
    data.orderedAt = status === 'ORDERED' ? new Date() : null;
  }

  const item = await prisma.cartItem.update({
    where: { id: req.params.itemId },
    data,
    include: { addedBy: true, orderedBy: true },
  });

  res.json({ item: serializeItem(item) });
});

// Remove an item
router.delete('/cart/:itemId', loadItemAndCheckMembership, async (req, res) => {
  await prisma.cartItem.delete({ where: { id: req.params.itemId } });
  res.status(204).end();
});

export default router;
