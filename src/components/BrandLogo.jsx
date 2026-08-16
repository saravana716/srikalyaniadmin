import React from 'react';
import brandLogo from '../assets/sri-kalyani-logo.png';

/**
 * Exact brand logo — only size changes; no cropping, filters, or redesign.
 * Aspect ratio locked to the source image (approx 16:9).
 */
const BrandLogo = ({
  width = 180,
  height,
  alt = 'Sri Kalyani Jewellery',
  style = {},
  className = '',
}) => {
  const resolvedHeight = height ?? Math.round((Number(width) * 576) / 1024);
  return (
    <img
      src={brandLogo}
      alt={alt}
      width={width}
      height={resolvedHeight}
      className={className}
      style={{
        width,
        height: resolvedHeight,
        objectFit: 'contain',
        display: 'block',
        ...style,
      }}
      draggable={false}
    />
  );
};

export default BrandLogo;
export { brandLogo };
