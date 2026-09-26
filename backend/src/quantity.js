// Pulls the leading number out of a pack-size string like "45 pcs", "500 ml",
// "1 L" - used to (a) prefer single-unit matches over bulk packs when picking
// a live-search result, and (b) is re-parsed on the frontend to show a
// per-unit price so absolute prices aren't compared across different pack sizes.
export function parseLeadingCount(qty) {
  if (!qty) return null;
  const match = String(qty).match(/([\d.]+)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return isNaN(n) || n <= 0 ? null : n;
}
