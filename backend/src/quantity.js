// Converts pack-size strings like "45 pcs", "500 ml", "1 L" to a common base
// (ml for volume, g for weight, a raw count for anything else) - used to (a)
// prefer smaller/more-standard matches when picking a live-search result, and
// (b) figure out how many discrete units a single pack actually contains, so
// "3 pcs pack" can be compared against "1 pc x3" for a given desired quantity.
// Spelled out generously on purpose: these are matched against both what a
// person types ("2 ltr") and whatever a store calls its pack ("1 Ltr"), and an
// unrecognized unit silently falls into a count bucket where 2 litres would be
// read as "2 of anything" - which is how a 2 L request got 360 ml of shampoo.
const VOLUME_UNITS = {
  ml: 1, mls: 1, millilitre: 1, millilitres: 1, milliliter: 1, milliliters: 1,
  l: 1000, lt: 1000, lts: 1000, ltr: 1000, ltrs: 1000,
  litre: 1000, litres: 1000, liter: 1000, liters: 1000,
};

const WEIGHT_UNITS = {
  g: 1, gm: 1, gms: 1, gram: 1, grams: 1, grm: 1, grms: 1,
  kg: 1000, kgs: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
};

export function parseQuantity(qty) {
  if (!qty) return null;
  const match = String(qty).trim().match(/([\d.]+)\s*([a-zA-Z]*)/);
  if (!match) return null;
  const count = parseFloat(match[1]);
  if (isNaN(count) || count <= 0) return null;
  const rawUnit = match[2].toLowerCase();

  if (rawUnit in VOLUME_UNITS) {
    return { category: 'volume', baseQty: count * VOLUME_UNITS[rawUnit], baseUnit: 'ml' };
  }
  if (rawUnit in WEIGHT_UNITS) {
    return { category: 'weight', baseQty: count * WEIGHT_UNITS[rawUnit], baseUnit: 'g' };
  }
  const label = (rawUnit || 'unit').replace(/s$/, '');
  return { category: `count:${label}`, baseQty: count, baseUnit: label };
}

// Returns a normalized base quantity for ranking "smallest pack" - not
// necessarily comparable across categories, but good enough within one.
export function parseLeadingCount(qty) {
  const parsed = parseQuantity(qty);
  return parsed ? parsed.baseQty : null;
}

// How many discrete units of the shopping-list item does buying ONE of this
// pack actually give you? "3 pcs" -> 3. Anything that isn't a plain count
// (volume, weight, or unparseable) is treated as 1 discrete purchase unit -
// buying "750 ml" once gets you 1 bottle, regardless of what's inside it.
export function packUnits(packSize) {
  const parsed = parseQuantity(packSize);
  if (parsed && parsed.category.startsWith('count:')) return parsed.baseQty;
  return 1;
}

// How many of THIS item does the shopping list actually want? Free-text
// fields like "1", "2", "3 cans" - just pull the leading number, default 1.
export function desiredCount(quantityText) {
  const match = String(quantityText || '1').match(/([\d.]+)/);
  if (!match) return 1;
  const n = parseFloat(match[1]);
  return isNaN(n) || n <= 0 ? 1 : Math.round(n);
}

// How many of this pack you must buy to satisfy what was asked for. When the
// request and the pack are the same measurable kind ("2 L" wanted against
// "500 ml" bottles) the real amounts are compared, so asking for 2 L can't be
// answered with two 180 ml bottles. Otherwise the request is read as a plain
// count of packs, which is what "3" against "1 pc" means.
export function packsNeededFor(requestedQty, packSize) {
  const want = parseQuantity(requestedQty);
  const pack = parseQuantity(packSize);

  if (want && pack && want.category === pack.category && pack.baseQty > 0) {
    return Math.ceil(want.baseQty / pack.baseQty);
  }
  return Math.ceil(desiredCount(requestedQty) / packUnits(packSize));
}
