// Converts pack-size strings like "45 pcs", "500 ml", "1 L" to a common base
// (ml for volume, g for weight) so "prefer the smallest pack" picks correctly
// - a raw leading-number comparison would wrongly think "1 L" (1000ml) is
// smaller than "750 ml" just because 1 < 750.
const VOLUME_UNITS = {
  ml: 1, millilitre: 1, millilitres: 1, milliliter: 1, milliliters: 1,
  l: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000,
};

const WEIGHT_UNITS = {
  g: 1, gm: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
};

// Returns a normalized base quantity for ranking "smallest pack" - not
// necessarily comparable across categories (e.g. volume vs a bare count),
// but good enough to prefer the smallest within the same physical unit type.
export function parseLeadingCount(qty) {
  if (!qty) return null;
  const match = String(qty).trim().match(/([\d.]+)\s*([a-zA-Z]*)/);
  if (!match) return null;
  const count = parseFloat(match[1]);
  if (isNaN(count) || count <= 0) return null;
  const unit = match[2].toLowerCase();

  if (unit in VOLUME_UNITS) return count * VOLUME_UNITS[unit];
  if (unit in WEIGHT_UNITS) return count * WEIGHT_UNITS[unit];
  return count;
}
