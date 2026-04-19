import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import ChitFundPlans from './pages/ChitFundPlans';
import Payment from './pages/Payment';
import Installments from './pages/Installments';
import Settings from './pages/Settings';
import GoldRateManage from './pages/GoldRateManage';
import Reports from './pages/Reports';
import PlanPurchases from './pages/PlanPurchases';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/plans" element={<ChitFundPlans />} />
        <Route path="/plan-purchases" element={<PlanPurchases />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/installments" element={<Installments />} />
        <Route path="/gold-rate" element={<GoldRateManage />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
