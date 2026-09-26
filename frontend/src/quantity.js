// Converts pack-size strings like "750 ml", "1 L", "500 g", "45 pcs", "combo"
// to a common base unit within their physical category (volume -> ml, weight
// -> g) so prices are genuinely comparable, not just superficially divided.
// Anything that isn't a recognized volume/weight unit (e.g. "combo", "pack",
// or no unit at all) is kept as its own count-style category, keyed by its
// exact unit label - two "combo" listings are comparable to each other, but
// "combo" and "pc" are not, and neither is comparable to a volume/weight one.

const VOLUME_UNITS = {
  ml: 1, millilitre: 1, millilitres: 1, milliliter: 1, milliliters: 1,
  l: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000,
};

const WEIGHT_UNITS = {
  g: 1, gm: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
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
  // Simple singularization so "pc"/"pcs" and "combo"/"combos" bucket together.
  const label = (rawUnit || 'unit').replace(/s$/, '');
  return { category: `count:${label}`, baseQty: count, baseUnit: label };
}

// A human-readable per-unit price: per litre for volume, per kg for weight,
// per the original label for anything else (e.g. "₹7.51/pc").
export function formatPerUnit(price, qty) {
  const parsed = parseQuantity(qty);
  if (!parsed) return null;
  if (parsed.category === 'volume') {
    return `₹${((price / parsed.baseQty) * 1000).toFixed(2)}/L`;
  }
  if (parsed.category === 'weight') {
    return `₹${((price / parsed.baseQty) * 1000).toFixed(2)}/kg`;
  }
  return `₹${(price / parsed.baseQty).toFixed(2)}/${parsed.baseUnit}`;
}

// Returns a reason string if this item's in-stock listings can't be honestly
// compared side by side, or null if they're on the same footing.
export function comparisonIssue(listings) {
  const inStock = listings.filter((l) => l.inStock);
  if (inStock.length < 2) return null;

  // A listing with no packSize at all, or one that doesn't parse (e.g.
  // "combo" has no number to extract), is equally "unclear" for comparison.
  const parsed = inStock.map((l) => (l.packSize ? parseQuantity(l.packSize) : null));
  const unclearCount = parsed.filter((p) => p === null).length;
  const valid = parsed.filter(Boolean);

  if (unclearCount > 0 && valid.length > 0) {
    return 'Some stores don\'t give a clear quantity (e.g. "combo") — add a size like "750 ml" so this can be compared properly.';
  }
  if (valid.length < 2) return null;

  const categories = new Set(valid.map((p) => p.category));
  if (categories.size > 1) {
    return "These aren't the same kind of pack (e.g. volume vs. a combo/count) — compare with care.";
  }

  const values = valid.map((p) => p.baseQty);
  if (Math.max(...values) / Math.min(...values) >= 3) {
    return 'Different pack sizes — compare the per-unit price below, not the raw price.';
  }
  return null;
}
