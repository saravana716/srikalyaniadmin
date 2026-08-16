import React, { useRef, useEffect, useCallback } from 'react';

const MAROON = '#801A39';

/**
 * Simple canvas signature pad. Calls onChange(dataUrl | '') whenever drawn/cleared.
 */
const SignaturePad = ({ label, value, onChange, required = false }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth || 300;
    const height = 120;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
      hasStroke.current = true;
    }
  }, [value]);

  useEffect(() => {
    resizeCanvas();
  }, [resizeCanvas]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches?.[0] || e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStroke.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasStroke.current && canvasRef.current) {
      onChange?.(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    onChange?.('');
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <label style={styles.label}>
          {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <button type="button" style={styles.clearBtn} onClick={clear}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <p style={styles.hint}>Sign inside the box with mouse or finger</p>
    </div>
  );
};

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: '14px', fontWeight: '500', color: '#374151' },
  clearBtn: {
    border: 'none',
    background: 'none',
    color: MAROON,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  canvas: {
    width: '100%',
    height: '120px',
    borderRadius: '8px',
    border: '1px dashed #9ca3af',
    backgroundColor: '#fafafa',
    touchAction: 'none',
    cursor: 'crosshair',
  },
  hint: { margin: 0, fontSize: '12px', color: '#6b7280' },
};

export default SignaturePad;
