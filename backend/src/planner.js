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

// items: [{ id, status, listings: [{ store, price, inStock }] }]
// storeSettings: [{ store, deliveryFee, freeDeliveryThreshold }]
export function computePlan(items, storeSettings) {
  const settingsByStore = Object.fromEntries(storeSettings.map((s) => [s.store, s]));
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

  // Per-store summary: what buying everything possible from just this store looks like
  const perStore = STORES.map((store) => {
    const available = coverable.filter((item) => item.listings.some((l) => l.store === store && l.inStock));
    const subtotal = available.reduce((sum, item) => {
      const listing = item.listings.find((l) => l.store === store && l.inStock);
      return sum + listing.price;
    }, 0);
    const missingItemIds = coverable.filter((item) => !available.includes(item)).map((i) => i.id);
    const settings = settingsByStore[store] || { deliveryFee: 25, freeDeliveryThreshold: 199 };
    return {
      store,
      availableCount: available.length,
      totalCoverable: coverable.length,
      subtotal,
      missingItemIds,
      qualifiesFreeDelivery: subtotal >= settings.freeDeliveryThreshold,
      deliveryFee: subtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee,
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
      let bestPrice = Infinity;
      for (const store of candidateStores) {
        const listing = item.listings.find((l) => l.store === store && l.inStock);
        if (listing && listing.price < bestPrice) {
          bestPrice = listing.price;
          bestStore = store;
        }
      }
      if (bestStore) {
        coveredCount++;
        if (!assignment[bestStore]) assignment[bestStore] = [];
        assignment[bestStore].push({ id: item.id, name: item.name, price: bestPrice });
      }
    }

    if (coveredCount !== coverable.length) continue; // doesn't cover everything, skip

    const usedStores = Object.keys(assignment);
    let totalCost = 0;
    const storePlans = usedStores.map((store) => {
      const items = assignment[store];
      const subtotal = items.reduce((sum, i) => sum + i.price, 0);
      const settings = settingsByStore[store] || { deliveryFee: 25, freeDeliveryThreshold: 199 };
      const qualifiesFreeDelivery = subtotal >= settings.freeDeliveryThreshold;
      const deliveryFee = qualifiesFreeDelivery ? 0 : settings.deliveryFee;
      totalCost += subtotal + deliveryFee;
      return { store, items, subtotal, deliveryFee, qualifiesFreeDelivery };
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
