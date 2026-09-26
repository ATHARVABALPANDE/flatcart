// Pulls the leading number + unit word out of a pack-size string like
// "45 pcs", "500 ml", "1 L" - used to show a per-unit price so ₹37 (1 can)
// and ₹338 (45 cans) aren't mistaken for directly comparable prices.
export function parseQuantity(qty) {
  if (!qty) return null;
  const match = String(qty).match(/([\d.]+)\s*(.*)/);
  if (!match) return null;
  const count = parseFloat(match[1]);
  if (isNaN(count) || count <= 0) return null;
  return { count, unit: match[2].trim() || 'unit' };
}

export function pricePerUnit(price, packSize) {
  const parsed = parseQuantity(packSize);
  if (!parsed) return null;
  return { value: price / parsed.count, unit: parsed.unit };
}

// Flags when listings for the same item have wildly different pack sizes
// (e.g. one store's "1 pc" vs another's "45 pcs"), which makes their absolute
// prices meaningless to compare side by side.
export function packSizesMismatched(listings) {
  const counts = listings
    .filter((l) => l.inStock && l.packSize)
    .map((l) => parseQuantity(l.packSize)?.count)
    .filter((c) => c != null);
  if (counts.length < 2) return false;
  return Math.max(...counts) / Math.min(...counts) >= 3;
}
