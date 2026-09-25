import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireHouseholdMember } from '../middleware/auth.js';
import { computePlan, STORES } from '../planner.js';

const router = Router();
router.use(requireAuth);

function serializeItem(item) {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    note: item.note,
    status: item.status,
    addedBy: item.addedBy ? { id: item.addedBy.id, name: item.addedBy.name } : null,
    orderedBy: item.orderedBy ? { id: item.orderedBy.id, name: item.orderedBy.name } : null,
    orderedStore: item.orderedStore,
    orderedAt: item.orderedAt,
    createdAt: item.createdAt,
    listings: (item.listings || []).map((l) => ({
      store: l.store,
      price: l.price,
      inStock: l.inStock,
      checkedBy: l.checkedBy ? { id: l.checkedBy.id, name: l.checkedBy.name } : null,
      checkedAt: l.checkedAt,
    })),
  };
}

const itemInclude = {
  addedBy: true,
  orderedBy: true,
  listings: { include: { checkedBy: true } },
};

// Get the household's shopping list plus computed price-comparison plan
router.get('/households/:householdId/cart', requireHouseholdMember, async (req, res) => {
  const [items, storeSettings] = await Promise.all([
    prisma.cartItem.findMany({
      where: { householdId: req.householdId },
      include: itemInclude,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.storeSetting.findMany({ where: { householdId: req.householdId } }),
  ]);

  const serialized = items.map(serializeItem);
  const { perStore, plan, unchecked, unavailableEverywhere } = computePlan(serialized, storeSettings);

  res.json({
    items: serialized,
    storeSettings,
    perStore,
    plan,
    unchecked,
    unavailableEverywhere,
  });
});

// Add an item to the household's shopping list
router.post('/households/:householdId/cart', requireHouseholdMember, async (req, res) => {
  const { name, quantity, note } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const item = await prisma.cartItem.create({
    data: {
      householdId: req.householdId,
      name,
      quantity: quantity || '1',
      note: note || null,
      addedById: req.userId,
    },
    include: itemInclude,
  });

  res.status(201).json({ item: serializeItem(item) });
});

// Mark a specific set of items as ordered from a given store (from the suggested plan, or manually)
router.post('/households/:householdId/cart/order', requireHouseholdMember, async (req, res) => {
  const { store, itemIds } = req.body;
  if (!store || !STORES.includes(store)) {
    return res.status(400).json({ error: `store must be one of ${STORES.join(', ')}` });
  }
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ error: 'itemIds must be a non-empty array' });
  }

  await prisma.cartItem.updateMany({
    where: { id: { in: itemIds }, householdId: req.householdId },
    data: { status: 'ORDERED', orderedStore: store, orderedById: req.userId, orderedAt: new Date() },
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
  const { quantity, note, status, orderedStore } = req.body;
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
    data.orderedStore = status === 'ORDERED' ? orderedStore || null : null;
  }

  const item = await prisma.cartItem.update({
    where: { id: req.params.itemId },
    data,
    include: itemInclude,
  });

  res.json({ item: serializeItem(item) });
});

// Remove an item
router.delete('/cart/:itemId', loadItemAndCheckMembership, async (req, res) => {
  await prisma.cartItem.delete({ where: { id: req.params.itemId } });
  res.status(204).end();
});

// Upsert the price/stock a flatmate has seen for an item at a given store
router.put('/cart/:itemId/listings/:store', loadItemAndCheckMembership, async (req, res) => {
  const { store } = req.params;
  const { price, inStock } = req.body;
  if (!STORES.includes(store)) {
    return res.status(400).json({ error: `store must be one of ${STORES.join(', ')}` });
  }
  if (inStock && (price === undefined || price === null || isNaN(price) || price < 0)) {
    return res.status(400).json({ error: 'price is required and must be a non-negative number when in stock' });
  }

  const listing = await prisma.itemListing.upsert({
    where: { itemId_store: { itemId: req.params.itemId, store } },
    create: {
      itemId: req.params.itemId,
      store,
      price: inStock ? price : 0,
      inStock: !!inStock,
      checkedById: req.userId,
    },
    update: {
      price: inStock ? price : 0,
      inStock: !!inStock,
      checkedById: req.userId,
    },
    include: { checkedBy: true },
  });

  res.json({
    listing: {
      store: listing.store,
      price: listing.price,
      inStock: listing.inStock,
      checkedBy: { id: listing.checkedBy.id, name: listing.checkedBy.name },
      checkedAt: listing.checkedAt,
    },
  });
});

// Reset a listing back to "unknown"
router.delete('/cart/:itemId/listings/:store', loadItemAndCheckMembership, async (req, res) => {
  const { store } = req.params;
  await prisma.itemListing
    .delete({ where: { itemId_store: { itemId: req.params.itemId, store } } })
    .catch(() => null);
  res.status(204).end();
});

export default router;
