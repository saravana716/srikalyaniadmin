import React from 'react';
import { Search, Bell, Menu, ChevronDown } from 'lucide-react';

const Header = ({ toggleSidebar }) => {
    const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
    const adminName = adminUser.name || 'Admin Name';
    const avatarSrc =
        adminUser.profileImage ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(adminName)}&background=dbeafe&color=1e40af`;

    return (
        <header className="top-bar">
            <div className="top-bar-left">
                <button onClick={toggleSidebar} className="menu-toggle">
                    <Menu size={24} />
                </button>

                <h1 className="page-title hidden md:block">Dashboard</h1>

                <div className="search-bar hidden lg:flex">
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Search orders, customers, products"
                        className="search-input"
                    />
                </div>
            </div>

            <div className="top-bar-right">
                <button className="notification-btn" aria-label="Notifications">
                    <Bell size={20} />
                    <span className="notification-badge"></span>
                </button>

                <div className="user-profile">
                    <img
                        src={avatarSrc}
                        alt="Admin"
                        className="user-avatar"
                    />
                    <div className="user-info hidden sm:flex">
                        <span className="user-name">{adminName}</span>
                    </div>
                    <ChevronDown size={16} className="text-gray-500 hidden sm:block" />
                </div>
            </div>
        </header>
    );
};

export default Header;
