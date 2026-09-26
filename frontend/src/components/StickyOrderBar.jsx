export default function StickyOrderBar({ pendingCount, plan }) {
  if (pendingCount === 0) return null;
  const hasPlan = plan && plan.stores.length > 0;

  function scrollToPlan() {
    document.getElementById('recommended-order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="sticky-order-bar">
      <div className="sticky-order-info">
        <span className="sticky-order-count">
          {pendingCount} item{pendingCount === 1 ? '' : 's'} on the list
        </span>
        <span className="sticky-order-total">
          {hasPlan
            ? `₹${plan.totalCost.toFixed(2)} · ${plan.storesUsed} store${plan.storesUsed === 1 ? '' : 's'}`
            : 'Add prices to see your best deal'}
        </span>
      </div>
      <button type="button" className="sticky-order-cta" onClick={scrollToPlan}>
        {hasPlan ? 'View order' : 'Check prices'}
      </button>
    </div>
  );
}
