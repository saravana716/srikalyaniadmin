import React from 'react';
import {
    Home, ShoppingCart, Users, Package, Layers, FolderTree, Glasses,
    Monitor, Layout, FileText, Settings, LogOut, X, TicketPercent, Percent
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/images/logo.png';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const location = useLocation();

    const menuItems = [
        { icon: <Home size={20} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <ShoppingCart size={20} />, label: 'Orders', path: '/orders' },
        { icon: <Users size={20} />, label: 'Customers', path: '/customers' },
        { icon: <Package size={20} />, label: 'Products', path: '/products' },
        { icon: <FolderTree size={20} />, label: 'Categories', path: '/categories' },
        { icon: <Glasses size={20} />, label: 'Lens Enhancements', path: '/lens-enhancements' },
        { icon: <TicketPercent size={20} />, label: 'Coupons', path: '/coupons' },
        { icon: <Percent size={20} />, label: 'Discounts', path: '/discounts' },
        { icon: <Layers size={20} />, label: 'Inventory', path: '/inventory' },
        { icon: <Monitor size={20} />, label: 'Virtual Try-On', path: '/virtual-try-on' },
        { icon: <Layout size={20} />, label: 'CMS', path: '/cms' },
        { icon: <FileText size={20} />, label: 'Reports', path: '/reports' },
        { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
    ];

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('admin_user');
            window.location.href = '/login';
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`mobile-overlay ${isOpen ? 'open' : ''}`}
                onClick={toggleSidebar}
            />

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand no-bg">
                        <img src={logo} alt="VISIONKART" className="sidebar-logo-img" />
                    </div>
                    <button className="menu-toggle md:hidden" onClick={toggleSidebar}>
                        <X size={24} color="white" />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item, index) => (
                        <Link
                            key={index}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                        >
                            <div className="nav-icon">{item.icon}</div>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button className="nav-item logout-btn w-full text-left" onClick={handleLogout}>
                        <LogOut size={20} />
                        <span>Log out</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
