import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { FiMail, FiLock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import BrandLogo from '../components/BrandLogo';
import loginBg from '../assets/login_bg.png';

const Login = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (loading) return null;
    if (isAuthenticated) return <Navigate to="/dashboard" replace />;

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err?.message || 'Login failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={styles.container} className="login-container">
            <div style={styles.contentWrapper} className="login-content-wrapper">
                <div style={styles.leftSpacer} className="login-left-spacer"></div>

                <div style={styles.formSection} className="login-form-section">
                    <div style={styles.formContainer} className="login-form-container">
                        <div style={styles.brandBlock}>
                            <BrandLogo width={220} />
                        </div>
                        <h2 style={styles.welcomeText}>WELCOME ADMIN</h2>

                        <form onSubmit={handleLogin} style={styles.form}>
                            {error && <p style={styles.errorText}>{error}</p>}

                            <div style={styles.inputGroup} className="login-input-group">
                                <FiMail style={styles.icon} />
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    style={styles.input}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>

                            <div style={styles.inputGroup} className="login-input-group">
                                <FiLock style={styles.icon} />
                                <input
                                    type="password"
                                    placeholder="Enter your Password"
                                    style={styles.input}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>

                            <Button
                                type="submit"
                                variant="login"
                                size="lg"
                                fullWidth
                                loading={submitting}
                                loadingText="Logging in…"
                            >
                                LOGIN
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        height: '100vh',
        width: '100vw',
        backgroundImage: `url(${loginBg})`,
        backgroundSize: '95% 100%',
        backgroundPosition: 'left',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentWrapper: {
        display: 'flex',
        width: '100%',
        height: '100%',
    },
    leftSpacer: {
        flex: 1,
    },
    formSection: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
    },
    formContainer: {
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        padding: '2rem',
    },
    brandBlock: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '2rem',
    },
    welcomeText: {
        color: '#3f1d1d',
        fontSize: '1.5rem',
        marginBottom: '2rem',
        fontWeight: '800',
        letterSpacing: '0.05em',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    errorText: {
        color: '#dc2626',
        fontSize: '0.9rem',
        margin: 0,
        textAlign: 'left',
    },
    inputGroup: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    icon: {
        position: 'absolute',
        left: '15px',
        color: '#3f1d1d',
        zIndex: 1,
    },
    input: {
        width: '100%',
        padding: '12px 12px 12px 40px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#dcdcdc',
        fontSize: '0.9rem',
        outline: 'none',
        color: '#333',
    },
    button: {
        marginTop: '1rem',
        padding: '12px',
        backgroundColor: '#5c202a',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: '700',
        cursor: 'pointer',
        letterSpacing: '0.05em',
        transition: 'background-color 0.3s',
    },
};

export default Login;
