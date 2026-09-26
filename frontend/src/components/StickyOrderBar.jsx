export default function StickyOrderBar({
  pendingCount,
  plan,
  needsPricingCount,
  liveConfigured,
  pricing,
  priceMsg,
  onPriceAll,
}) {
  if (pendingCount === 0) return null;

  const hasPlan = plan && plan.stores.length > 0;
  // Pricing wins over ordering while anything is unpriced - completing the
  // picture first is what stops someone ordering a half-known list.
  const canPrice = liveConfigured && needsPricingCount > 0;

  function scrollToPlan() {
    document.getElementById('recommended-order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let detail;
  if (priceMsg) detail = priceMsg;
  else if (pricing) detail = 'Checking all four apps...';
  else if (canPrice) detail = `${needsPricingCount} still need live prices`;
  else if (hasPlan) detail = `₹${plan.totalCost.toFixed(2)} · ${plan.storesUsed} store${plan.storesUsed === 1 ? '' : 's'}`;
  else detail = 'Add prices to see your best deal';

  return (
    <div className="sticky-order-bar">
      <div className="sticky-order-info">
        <span className="sticky-order-count">
          {pendingCount} item{pendingCount === 1 ? '' : 's'} on the list
        </span>
        <span className="sticky-order-total">{detail}</span>
      </div>
      {canPrice ? (
        <button type="button" className="sticky-order-cta" disabled={pricing} onClick={onPriceAll}>
          {pricing ? 'Pricing...' : `Price ${needsPricingCount} item${needsPricingCount === 1 ? '' : 's'}`}
        </button>
      ) : (
        <button type="button" className="sticky-order-cta" onClick={scrollToPlan}>
          {hasPlan ? 'View order' : 'Check prices'}
        </button>
      )}
    </div>
  );
}
