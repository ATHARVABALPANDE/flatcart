// Converts pack-size strings like "45 pcs", "500 ml", "1 L" to a common base
// (ml for volume, g for weight, a raw count for anything else) - used to (a)
// prefer smaller/more-standard matches when picking a live-search result, and
// (b) figure out how many discrete units a single pack actually contains, so
// "3 pcs pack" can be compared against "1 pc x3" for a given desired quantity.
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
