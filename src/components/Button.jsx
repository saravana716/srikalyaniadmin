import React from 'react';

const VARIANTS = {
  primary: 'app-btn--primary',
  secondary: 'app-btn--secondary',
  danger: 'app-btn--danger',
  login: 'app-btn--login',
  ghost: 'app-btn--ghost',
};

const SIZES = {
  sm: 'app-btn--sm',
  md: 'app-btn--md',
  lg: 'app-btn--lg',
};

/**
 * Professional shared button — consistent padding, height, and alignment app-wide.
 * Size/layout come from CSS classes so inline style props cannot crush the design.
 */
const Button = ({
  children,
  loading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  onClick,
  className = '',
  style = {},
  fullWidth = false,
}) => {
  const isDisabled = disabled || loading;
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={[
        'app-btn',
        variantClass,
        sizeClass,
        loading ? 'app-btn--loading' : '',
        fullWidth ? 'app-btn--block' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      {loading && <span className="app-btn-spinner" aria-hidden="true" />}
      <span className="app-btn-label">{loading ? (loadingText || children) : children}</span>
    </button>
  );
};

export default Button;
