import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import { ProtectedRoute, RequireRole } from './components/ProtectedRoute.jsx';
import AccessDenied from './pages/AccessDenied.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Issues from './pages/Issues.jsx';
import Ledger from './pages/Ledger.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import Notifications from './pages/Notifications.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Products from './pages/Products.jsx';
import Profile from './pages/Profile.jsx';
import Purchases from './pages/Purchases.jsx';
import Reports from './pages/Reports.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Transfers from './pages/Transfers.jsx';
import Users from './pages/Users.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="issues" element={<Issues />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="reports" element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route
          path="users"
          element={
            <RequireRole roles={['super_admin']}>
              <Users />
            </RequireRole>
          }
        />
        <Route
          path="audit"
          element={
            <RequireRole roles={['super_admin', 'principal']}>
              <AuditLog />
            </RequireRole>
          }
        />
        <Route path="access-denied" element={<AccessDenied />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
