import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const BORDER_GRAY = '#e0e0e0';
const PORTAL_Z_INDEX = 99999;

/**
 * Action dropdown (View, Edit, Delete) rendered in a portal so it appears
 * outside table overflow and above all content. Pass anchorEl (trigger DOM node).
 */
const ActionMenu = ({ isOpen, onClose, anchorEl, onView, onEdit, onDelete, busy = false, placement = 'bottom-end' }) => {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !anchorEl) return;
    const handleClickOutside = (e) => {
      if (menuRef.current?.contains(e.target) || anchorEl?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [isOpen, onClose, anchorEl]);

  useEffect(() => {
    if (!isOpen || !anchorEl || !menuRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 120;
    const menuHeight = 120;
    const gap = 4;
    const padding = 8;
    let top = rect.bottom + gap;
    let left = placement === 'bottom-end' ? rect.right - menuWidth : rect.left;
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding;
    if (top + menuHeight > window.innerHeight - padding) top = rect.top - menuHeight - gap;
    if (top < padding) top = padding;
    setPosition({ top, left });
  }, [isOpen, anchorEl, placement]);

  if (!isOpen) return null;

  const menu = (
    <div
      ref={menuRef}
      className="action-dropdown action-dropdown-portal"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: PORTAL_Z_INDEX,
        minWidth: '120px',
        backgroundColor: '#fafafa',
        border: `1px solid ${BORDER_GRAY}`,
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: '8px 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button type="button" className="action-dropdown-item" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (busy) return; onView?.(); onClose(); }}>View</button>
      <button type="button" className="action-dropdown-item" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (busy) return; onEdit?.(); onClose(); }}>Edit</button>
      <button
        type="button"
        className={`action-dropdown-item${busy ? ' action-dropdown-item--loading' : ''}`}
        disabled={busy}
        onMouseDown={(e) => e.preventDefault()}
        onClick={async () => {
          if (busy) return;
          try {
            await onDelete?.();
          } finally {
            onClose();
          }
        }}
      >
        {busy && <span className="app-btn-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />}
        {busy ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  );

  return createPortal(menu, document.body);
};

export default ActionMenu;
