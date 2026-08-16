import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import ChitFundPlans from './pages/ChitFundPlans';
import Payment from './pages/Payment';
import Settings from './pages/Settings';
import GoldRateManage from './pages/GoldRateManage';
import Reports from './pages/Reports';
import PlanPurchases from './pages/PlanPurchases';
import Products from './pages/Products';
import Offers from './pages/Offers';
import AdminAccounts from './pages/AdminAccounts';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/plans" element={<ProtectedRoute><ChitFundPlans /></ProtectedRoute>} />
          <Route path="/plan-purchases" element={<ProtectedRoute><PlanPurchases /></ProtectedRoute>} />
          <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="/installments" element={<Navigate to="/payment" replace />} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/offers" element={<ProtectedRoute><Offers /></ProtectedRoute>} />
          <Route path="/gold-rate" element={<ProtectedRoute><GoldRateManage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin-accounts" element={<ProtectedRoute><AdminAccounts /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
