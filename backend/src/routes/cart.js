import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireHouseholdMember } from '../middleware/auth.js';
import { computePlan, STORES } from '../planner.js';
import { ah } from '../asyncHandler.js';
import { parseLeadingCount } from '../quantity.js';

const DEFAULT_PACK_SIZE = '1 unit';
const REFRESH_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h - avoid re-spending credits on prices that haven't had time to change
const MAX_PACK_VARIANTS_PER_STORE = 3; // cap rows captured per store per refresh, so a search with many hits doesn't create clutter

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

// Add or update one pack-size option a flatmate has seen for an item at a
// given store. A store can have several of these (e.g. "1 pc" and "3 pcs
// pack" as separate rows) so the plan can compare buying them individually
// vs. in bulk - which row this touches is picked by (store, packSize).
router.put('/cart/:itemId/listings/:store', loadItemAndCheckMembership, ah(async (req, res) => {
  const { store } = req.params;
  const { price, inStock, matchedName } = req.body;
  const packSize = (req.body.packSize && req.body.packSize.trim()) || DEFAULT_PACK_SIZE;
  if (!STORES.includes(store)) {
    return res.status(400).json({ error: `store must be one of ${STORES.join(', ')}` });
  }
  if (inStock && (price === undefined || price === null || isNaN(price) || price < 0)) {
    return res.status(400).json({ error: 'price is required and must be a non-negative number when in stock' });
  }

  const listing = await prisma.itemListing.upsert({
    where: { itemId_store_packSize: { itemId: req.params.itemId, store, packSize } },
    create: {
      itemId: req.params.itemId,
      store,
      packSize,
      price: inStock ? price : 0,
      inStock: !!inStock,
      matchedName: matchedName || null,
      source: 'MANUAL',
      checkedById: req.userId,
    },
    update: {
      price: inStock ? price : 0,
      inStock: !!inStock,
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
    include: { listings: true },
  });
  if (!item) return res.status(404).json({ error: 'Item not found in this household' });

  const lastLiveCheck = item.listings
    .filter((l) => l.source === 'LIVE_API')
    .reduce((latest, l) => (!latest || l.checkedAt > latest ? l.checkedAt : latest), null);
  if (lastLiveCheck && !req.body.force) {
    const ageMs = Date.now() - new Date(lastLiveCheck).getTime();
    if (ageMs < REFRESH_COOLDOWN_MS) {
      const minutesLeft = Math.ceil((REFRESH_COOLDOWN_MS - ageMs) / 60000);
      return res.status(200).json({
        skipped: true,
        reason: `Checked ${Math.round(ageMs / 60000)}m ago - still fresh. Try again in ${minutesLeft}m, or pass force to check anyway.`,
        updated: [],
        notFound: [],
        creditsRemaining: null,
      });
    }
  }

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

    // Keep several distinct pack sizes (not just one "best" pick) so the plan
    // can compare e.g. "3 pcs pack" against "1 pc x3" - sorted smallest-first
    // since that's usually the most relevant default, deduped by pack size text.
    const sorted = [...matches].sort((a, b) => (parseLeadingCount(a.quantity) ?? Infinity) - (parseLeadingCount(b.quantity) ?? Infinity));
    const seenPackSizes = new Set();
    const variants = [];
    for (const candidate of sorted) {
      const packSize = candidate.quantity ? String(candidate.quantity).trim() : DEFAULT_PACK_SIZE;
      const key = packSize.toLowerCase();
      if (seenPackSizes.has(key)) continue;
      seenPackSizes.add(key);
      variants.push({ candidate, packSize });
      if (variants.length >= MAX_PACK_VARIANTS_PER_STORE) break;
    }

    const keptPackSizes = variants.map((v) => v.packSize);
    await prisma.itemListing.deleteMany({
      where: { itemId: item.id, store, source: 'LIVE_API', packSize: { notIn: keptPackSizes } },
    });

    let anySaved = false;
    for (const { candidate, packSize } of variants) {
      const price = Number(candidate.offer_price ?? candidate.mrp ?? 0);
      if (isNaN(price)) continue;
      const inStock = !!candidate.available;
      const eta = candidate.platform?.sla ? String(candidate.platform.sla) : null;
      const matchedName = candidate.name ? String(candidate.name) + (candidate.brand ? ` (${candidate.brand})` : '') : null;
      const deeplink = candidate.deeplink ? String(candidate.deeplink) : null;
      try {
        await prisma.itemListing.upsert({
          where: { itemId_store_packSize: { itemId: item.id, store, packSize } },
          create: { itemId: item.id, store, price, inStock, eta, packSize, matchedName, deeplink, source: 'LIVE_API', checkedById: req.userId },
          update: { price, inStock, eta, matchedName, deeplink, source: 'LIVE_API', checkedById: req.userId },
        });
        updated.push({ store, price, inStock, eta, packSize, matchedName });
        anySaved = true;
      } catch {
        // skip this variant, try the rest
      }
    }
    if (!anySaved) notFound.push(store);
  }

  res.json({ updated, notFound, creditsRemaining: data?.credits_remaining ?? null });
}));

// Remove one pack-size option for a store (defaults to the plain "1 unit" row)
router.delete('/cart/:itemId/listings/:store', loadItemAndCheckMembership, ah(async (req, res) => {
  const { store } = req.params;
  const packSize = (req.query.packSize && String(req.query.packSize).trim()) || DEFAULT_PACK_SIZE;
  await prisma.itemListing
    .delete({ where: { itemId_store_packSize: { itemId: req.params.itemId, store, packSize } } })
    .catch(() => null);
  res.status(204).end();
}));

export default router;
