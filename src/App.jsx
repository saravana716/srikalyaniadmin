import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Products from './pages/Products';
import AddProduct from './pages/AddProduct';
import EditProduct from './pages/EditProduct';
import Categories from './pages/Categories';
import LensEnhancements from './pages/LensEnhancements';
import Coupons from './pages/Coupons';
import Discounts from './pages/Discounts';
import Inventory from './pages/Inventory';
import VirtualTryOn from './pages/VirtualTryOn';
import CMS from './pages/CMS';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {/* Protected Admin Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/add-product" element={<ProtectedRoute><AddProduct /></ProtectedRoute>} />
      <Route path="/edit-product/:id" element={<ProtectedRoute><EditProduct /></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
      <Route path="/lens-enhancements" element={<ProtectedRoute><LensEnhancements /></ProtectedRoute>} />
      <Route path="/coupons" element={<ProtectedRoute><Coupons /></ProtectedRoute>} />
      <Route path="/discounts" element={<ProtectedRoute><Discounts /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/virtual-try-on" element={<ProtectedRoute><VirtualTryOn /></ProtectedRoute>} />
      <Route path="/cms" element={<ProtectedRoute><CMS /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
