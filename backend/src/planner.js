import { packsNeededFor } from './quantity.js';

export const STORES = ['BLINKIT', 'ZEPTO', 'INSTAMART', 'BIGBASKET'];

function subsets(arr) {
  const result = [];
  const n = arr.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(arr[i]);
    }
    result.push(subset);
  }
  return result;
}

// Given all of a store's in-stock pack options for one item, find the
// cheapest way to reach the desired quantity by repeating a SINGLE option
// (doesn't mix pack sizes - "2x pack-of-3" or "3x single", not "1 pack-of-3 +
// 1 single"). That covers the common "is the bulk pack actually cheaper"
// question without a much more complex combinatorial search.
function bestOptionForStore(listings, requestedQty) {
  let best = null;
  for (const listing of listings) {
    if (!listing.inStock) continue;
    const packsNeeded = packsNeededFor(requestedQty, listing.packSize);
    const totalCost = packsNeeded * listing.price;
    if (!best || totalCost < best.totalCost) {
      best = { listing, packsNeeded, totalCost };
    }
  }
  return best;
}

// One line of an order: what to buy, how many packs, and what that costs.
function planItem(item, option) {
  return {
    id: item.id,
    name: item.name,
    price: option.totalCost,
    packSize: option.listing.packSize,
    packsNeeded: option.packsNeeded,
    unitPrice: option.listing.price,
    deeplink: option.listing.deeplink || null,
  };
}

// items: [{ id, quantity, status, listings: [{ store, price, inStock, packSize }] }]
export function computePlan(items) {
  const pending = items.filter((i) => i.status === 'PENDING');

  const unchecked = [];
  const unavailableEverywhere = [];
  const coverable = [];

  for (const item of pending) {
    if (!item.listings || item.listings.length === 0) {
      unchecked.push(item.id);
      continue;
    }
    const inStockListings = item.listings.filter((l) => l.inStock);
    if (inStockListings.length === 0) {
      unavailableEverywhere.push(item.id);
      continue;
    }
    coverable.push(item);
  }

  // Per-store summary: what buying everything possible from just this store
  // looks like, using the cheapest pack-size option per item at that store.
  const perStore = STORES.map((store) => {
    const availableWithOption = coverable
      .map((item) => ({ item, option: bestOptionForStore(item.listings.filter((l) => l.store === store), item.quantity) }))
      .filter((x) => x.option);
    const subtotal = availableWithOption.reduce((sum, x) => sum + x.option.totalCost, 0);
    const missingItemIds = coverable
      .filter((item) => !availableWithOption.some((x) => x.item.id === item.id))
      .map((i) => i.id);
    return {
      store,
      availableCount: availableWithOption.length,
      totalCoverable: coverable.length,
      subtotal,
      missingItemIds,
      // Full breakdown so someone who overrides the recommendation and picks
      // this store gets the same order detail the recommendation would give.
      items: availableWithOption.map(({ item, option }) => planItem(item, option)),
    };
  });

  // Try every combination of 1..4 stores, cheapest-per-item assignment within it,
  // pick the option using the fewest actual stores, tie-broken by lowest total cost.
  let bestPlan = null;

  for (const candidateStores of subsets(STORES)) {
    const assignment = {}; // store -> items[]
    let coveredCount = 0;

    for (const item of coverable) {
      let bestStore = null;
      let bestOption = null;
      for (const store of candidateStores) {
        const option = bestOptionForStore(item.listings.filter((l) => l.store === store), item.quantity);
        if (option && (!bestOption || option.totalCost < bestOption.totalCost)) {
          bestOption = option;
          bestStore = store;
        }
      }
      if (bestStore) {
        coveredCount++;
        if (!assignment[bestStore]) assignment[bestStore] = [];
        assignment[bestStore].push(planItem(item, bestOption));
      }
    }

    if (coveredCount !== coverable.length) continue; // doesn't cover everything, skip

    const usedStores = Object.keys(assignment);
    let totalCost = 0;
    const storePlans = usedStores.map((store) => {
      const items = assignment[store];
      const subtotal = items.reduce((sum, i) => sum + i.price, 0);
      totalCost += subtotal;
      return { store, items, subtotal };
    });

    const candidate = {
      storesUsed: usedStores.length,
      totalCost,
      stores: storePlans,
    };

    if (
      !bestPlan ||
      candidate.storesUsed < bestPlan.storesUsed ||
      (candidate.storesUsed === bestPlan.storesUsed && candidate.totalCost < bestPlan.totalCost)
    ) {
      bestPlan = candidate;
    }
  }

  return {
    perStore,
    plan: bestPlan || { storesUsed: 0, totalCost: 0, stores: [] },
    unchecked,
    unavailableEverywhere,
  };
}
