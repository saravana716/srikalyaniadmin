import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import '../assets/styles/Login.css';
import logo from '../assets/images/logo.png';

const Login = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        username: '', // This will be the email based on the screenshot
        password: '',
        rememberMe: false
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const adminRef = collection(db, 'admin');
            const q = query(adminRef, where("Email", "==", formData.username));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError('Admin account not found.');
                setLoading(false);
                return;
            }

            let authenticated = false;
            querySnapshot.forEach((doc) => {
                const adminData = doc.data();
                if (adminData.password === formData.password) {
                    authenticated = true;
                    // Store admin data in localStorage
                    localStorage.setItem('admin_user', JSON.stringify({
                        id: doc.id,
                        name: adminData.Name || 'Admin',
                        email: adminData.Email,
                        phone: adminData.Phone || '',
                        profileImage: adminData.ProfileImage || '',
                    }));
                }
            });

            if (authenticated) {
                window.location.href = '/dashboard';
            } else {
                setError('Invalid password. Please try again.');
            }
        } catch (err) {
            console.error("Login error:", err);
            setError('An error occurred during login. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <img src={logo} alt="VisionKart Logo" className="login-logo" />
                    <h2 className="login-title">Welcome Admin</h2>
                    <p className="login-subtitle">Access your dashboard to manage your system efficiently.</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && <div className="login-error" style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}
                    <div className="form-group">
                        <label htmlFor="username" className="form-label">Email Address</label>
                        <div className="input-wrapper">
                            <input
                                type="email"
                                id="username"
                                name="username"
                                className="form-input"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="admin@gmail.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">Password</label>
                        <div className="input-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                name="password"
                                className="form-input"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Enter your secure password"
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={togglePasswordVisibility}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-actions">
                        <label className="remember-me">
                            <input
                                type="checkbox"
                                name="rememberMe"
                                checked={formData.rememberMe}
                                onChange={handleChange}
                            />
                            Remember Me
                        </label>
                        <a href="#" className="forgot-password">Forgot Password?</a>
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" size={20} style={{ margin: '0 auto' }} /> : 'Log in'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
