import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock } from 'react-icons/fi';
import loginBg from '../assets/login_bg.png';

const Login = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        navigate('/dashboard');
    };

    return (
        <div style={styles.container} className="login-container">
            <div style={styles.contentWrapper} className="login-content-wrapper">
                {/* Left Side (Spacer for the diamond background visual) */}
                <div style={styles.leftSpacer} className="login-left-spacer"></div>

                {/* Right Form Side */}
                <div style={styles.formSection} className="login-form-section">
                    <div style={styles.formContainer} className="login-form-container">
                        <h1 style={styles.logoText}>Jewellery Logo</h1>

                        <h2 style={styles.welcomeText}>WELCOME ADMIN</h2>

                        <form onSubmit={handleLogin} style={styles.form}>
                            <div style={styles.inputGroup} className="login-input-group">
                                <FiUser style={styles.icon} />
                                <input
                                    type="text"
                                    placeholder="Enter your username"
                                    style={styles.input}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
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
                                />
                            </div>

                            <button type="submit" style={styles.button}>
                                LOGIN
                            </button>
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
        // This side is empty to let the background diamonds show through
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
    logoText: {
        color: '#3f1d1d', // Dark brown
        fontSize: '2rem',
        fontWeight: '700',
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
        backgroundColor: '#dcdcdc', // Light gray input background
        fontSize: '0.9rem',
        outline: 'none',
        color: '#333',
    },
    button: {
        marginTop: '1rem',
        padding: '12px',
        backgroundColor: '#5c202a', // Dark burgundy/brown
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
