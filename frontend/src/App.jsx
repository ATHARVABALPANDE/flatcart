import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Households from './pages/Households.jsx';
import HouseholdLayout from './pages/HouseholdLayout.jsx';
import ItemsTab from './pages/ItemsTab.jsx';
import OrderTab from './pages/OrderTab.jsx';
import FlatTab from './pages/FlatTab.jsx';
import ProfileTab from './pages/ProfileTab.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Households />
          </RequireAuth>
        }
      />
      <Route
        path="/household/:householdId"
        element={
          <RequireAuth>
            <HouseholdLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="list" replace />} />
        <Route path="list" element={<ItemsTab />} />
        <Route path="order" element={<OrderTab />} />
        <Route path="flat" element={<FlatTab />} />
        <Route path="me" element={<ProfileTab />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
