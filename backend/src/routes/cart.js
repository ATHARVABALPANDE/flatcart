import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireHouseholdMember } from '../middleware/auth.js';
import { computePlan, STORES } from '../planner.js';
import { ah } from '../asyncHandler.js';
import { parseLeadingCount } from '../quantity.js';

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
      source: l.source,
      eta: l.eta,
      packSize: l.packSize,
      matchedName: l.matchedName,
      deeplink: l.deeplink,
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
router.get('/households/:householdId/cart', requireHouseholdMember, ah(async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { householdId: req.householdId },
    include: itemInclude,
    orderBy: { createdAt: 'asc' },
  });

  const serialized = items.map(serializeItem);
  const { perStore, plan, unchecked, unavailableEverywhere } = computePlan(serialized);

  res.json({
    items: serialized,
    perStore,
    plan,
    unchecked,
    unavailableEverywhere,
  });
}));

// Add an item to the household's shopping list
router.post('/households/:householdId/cart', requireHouseholdMember, ah(async (req, res) => {
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
}));

// Mark a specific set of items as ordered from a given store (from the suggested plan, or manually)
router.post('/households/:householdId/cart/order', requireHouseholdMember, ah(async (req, res) => {
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
}));

const loadItemAndCheckMembership = ah(async (req, res, next) => {
  const item = await prisma.cartItem.findUnique({ where: { id: req.params.itemId } });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const membership = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: req.userId, householdId: item.householdId } },
  });
  if (!membership) return res.status(403).json({ error: 'Not a member of this household' });

  req.cartItem = item;
  next();
});

// Update a single item (quantity, note, status)
router.patch('/cart/:itemId', loadItemAndCheckMembership, ah(async (req, res) => {
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
}));

// Remove an item
router.delete('/cart/:itemId', loadItemAndCheckMembership, ah(async (req, res) => {
  await prisma.cartItem.delete({ where: { id: req.params.itemId } });
  res.status(204).end();
}));

// Upsert the price/stock a flatmate has seen for an item at a given store
router.put('/cart/:itemId/listings/:store', loadItemAndCheckMembership, ah(async (req, res) => {
  const { store } = req.params;
  const { price, inStock, packSize, matchedName } = req.body;
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
      packSize: packSize || null,
      matchedName: matchedName || null,
      source: 'MANUAL',
      checkedById: req.userId,
    },
    update: {
      price: inStock ? price : 0,
      inStock: !!inStock,
      packSize: packSize || null,
      matchedName: matchedName || null,
      source: 'MANUAL',
      checkedById: req.userId,
    },
    include: { checkedBy: true },
  });

  res.json({
    listing: {
      store: listing.store,
      price: listing.price,
      inStock: listing.inStock,
      source: listing.source,
      packSize: listing.packSize,
      matchedName: listing.matchedName,
      deeplink: listing.deeplink,
      checkedBy: { id: listing.checkedBy.id, name: listing.checkedBy.name },
      checkedAt: listing.checkedAt,
    },
  });
}));

const QC_API_BASE = 'https://api.quickcommerceapi.com';
const QC_PLATFORM_TO_STORE = { BlinkIt: 'BLINKIT', Zepto: 'ZEPTO', Swiggy: 'INSTAMART', BigBasket: 'BIGBASKET' };

// Pull live price/stock for one item from quickcommerceapi.com across all 4 stores
router.post('/households/:householdId/cart/:itemId/refresh-price', requireHouseholdMember, ah(async (req, res) => {
  const item = await prisma.cartItem.findFirst({
    where: { id: req.params.itemId, householdId: req.householdId },
  });
  if (!item) return res.status(404).json({ error: 'Item not found in this household' });

  const household = await prisma.household.findUnique({ where: { id: req.householdId } });
  if (!household.qcApiKey || household.latitude == null || household.longitude == null) {
    return res.status(400).json({ error: 'Live pricing is not configured for this household yet' });
  }

  const params = new URLSearchParams({
    q: item.name,
    lat: String(household.latitude),
    lon: String(household.longitude),
    platforms: Object.keys(QC_PLATFORM_TO_STORE).join(','),
  });
  if (household.pincode) params.set('pincode', household.pincode);

  let data;
  try {
    const response = await fetch(`${QC_API_BASE}/v1/groupsearch?${params}`, {
      headers: { 'X-API-Key': household.qcApiKey },
      signal: AbortSignal.timeout(20000),
    });
    data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(502).json({ error: data.error || `Live pricing lookup failed (${response.status})` });
    }
  } catch (err) {
    return res.status(502).json({ error: `Could not reach live pricing service: ${err.message}` });
  }

  const results = data?.data?.results || {};
  const updated = [];
  const notFound = [];

  for (const [platform, store] of Object.entries(QC_PLATFORM_TO_STORE)) {
    const matches = Array.isArray(results[platform]) ? results[platform] : [];
    if (matches.length === 0) {
      notFound.push(store);
      continue;
    }

    // Search results aren't sorted by pack size, and the first hit is often a
    // bulk pack (e.g. "45 pcs") rather than a single unit - prefer whichever
    // candidate has the smallest parsed quantity, since that's what most
    // shopping-list items mean by default.
    let best = matches[0];
    let bestCount = parseLeadingCount(best.quantity) ?? Infinity;
    for (const candidate of matches.slice(1)) {
      const count = parseLeadingCount(candidate.quantity);
      if (count !== null && count < bestCount) {
        best = candidate;
        bestCount = count;
      }
    }

    const price = Number(best.offer_price ?? best.mrp ?? 0);
    const inStock = !!best.available;
    const eta = best.platform?.sla ? String(best.platform.sla) : null;
    const packSize = best.quantity ? String(best.quantity) : null;
    const matchedName = best.name ? String(best.name) + (best.brand ? ` (${best.brand})` : '') : null;
    const deeplink = best.deeplink ? String(best.deeplink) : null;
    if (isNaN(price)) {
      notFound.push(store);
      continue;
    }
    try {
      await prisma.itemListing.upsert({
        where: { itemId_store: { itemId: item.id, store } },
        create: { itemId: item.id, store, price, inStock, eta, packSize, matchedName, deeplink, source: 'LIVE_API', checkedById: req.userId },
        update: { price, inStock, eta, packSize, matchedName, deeplink, source: 'LIVE_API', checkedById: req.userId },
      });
      updated.push({ store, price, inStock, eta, packSize, matchedName });
    } catch {
      notFound.push(store);
    }
  }

  res.json({ updated, notFound, creditsRemaining: data?.credits_remaining ?? null });
}));

// Reset a listing back to "unknown"
router.delete('/cart/:itemId/listings/:store', loadItemAndCheckMembership, ah(async (req, res) => {
  const { store } = req.params;
  await prisma.itemListing
    .delete({ where: { itemId_store: { itemId: req.params.itemId, store } } })
    .catch(() => null);
  res.status(204).end();
}));

export default router;
