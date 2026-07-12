import React from 'react';

const VARIANTS = {
  primary: {
    backgroundColor: '#801A39',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    backgroundColor: '#fff',
    color: '#374151',
    border: '1px solid #9ca3af',
  },
  danger: {
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
  },
  login: {
    backgroundColor: '#5c202a',
    color: '#fff',
    border: 'none',
  },
};

/**
 * Professional button with loading spinner and disabled state.
 */
const Button = ({
  children,
  loading = false,
  loadingText,
  variant = 'primary',
  type = 'button',
  disabled = false,
  onClick,
  className = '',
  style = {},
  fullWidth = false,
}) => {
  const isDisabled = disabled || loading;
  const variantStyle = VARIANTS[variant] || VARIANTS.primary;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`app-btn app-btn--${variant} ${loading ? 'app-btn--loading' : ''} ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: variant === 'login' ? '12px' : '10px 20px',
        borderRadius: '8px',
        fontSize: variant === 'login' ? '1rem' : '14px',
        fontWeight: '600',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled && !loading ? 0.65 : 1,
        transition: 'opacity 0.2s, transform 0.1s',
        width: fullWidth ? '100%' : undefined,
        letterSpacing: variant === 'login' ? '0.05em' : undefined,
        ...variantStyle,
        ...style,
      }}
    >
      {loading && <span className="app-btn-spinner" aria-hidden="true" />}
      <span>{loading ? (loadingText || children) : children}</span>
    </button>
  );
};

export default Button;
