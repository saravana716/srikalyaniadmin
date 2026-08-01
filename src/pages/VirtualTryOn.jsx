import React, { useState } from 'react';
import { Monitor, Camera, Settings as SettingsIcon } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import '../assets/styles/Dashboard.css';

const VirtualTryOn = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="main-content">
                <Header toggleSidebar={toggleSidebar} />
                <div className="dashboard-content">
                    <div className="content-header">
                        <div className="breadcrumb">
                            <span className="cursor-pointer" onClick={() => window.location.href = '/dashboard'}>Dashboard</span>
                            <span className="separator"> &gt; </span>
                            <span className="active">Virtual Try-On</span>
                        </div>
                        <div className="page-title-row">
                            <h1 className="text-2xl font-bold">Virtual Try-On</h1>
                        </div>
                    </div>

                    <div className="table-card">
                        <div className="empty-state" style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                            <Monitor size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                            <h3 className="text-lg font-semibold">Virtual Try-On Management</h3>
                            <p>Manage 3D models and virtual fitting settings here.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VirtualTryOn;
