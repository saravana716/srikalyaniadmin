import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const adminUser = localStorage.getItem('admin_user');

    if (!adminUser) {
        // Redirect to login if no admin session exists
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
