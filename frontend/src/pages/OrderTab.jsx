import { useOutletContext } from 'react-router-dom';
import PlanSummary from '../components/PlanSummary.jsx';

export default function OrderTab() {
  const { list, pendingItems, pickedStore, setPickedStore, onOrderStore } = useOutletContext();

  if (list === null) return <p className="muted">Loading...</p>;

  if (pendingItems.length === 0) {
    return (
      <section className="cart-section">
        <h2>Recommended order</h2>
        <p className="muted">Nothing on the list right now. Add items and they'll be priced up here.</p>
      </section>
    );
  }

  return (
    <PlanSummary
      plan={list.plan}
      perStore={list.perStore}
      unchecked={list.unchecked}
      unavailableEverywhere={list.unavailableEverywhere}
      items={list.items}
      onOrderStore={onOrderStore}
      pickedStore={pickedStore}
      onPickStore={setPickedStore}
    />
  );
}
