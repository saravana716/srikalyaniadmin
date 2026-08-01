import React from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { CONTACT_LENS_VOLUME_PRESETS, emptyContactLensRow } from '../config/contactLens';
import '../assets/styles/ContactLens.css';

export default function ContactLensVariantFields({ rows, setRows }) {
    const updateRow = (index, patch) => {
        setRows((prev) => prev.map((r, j) => (j === index ? { ...r, ...patch } : r)));
    };

    const addRow = () => setRows((prev) => [...prev, emptyContactLensRow()]);

    const removeRow = (index) => {
        setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== index)));
    };

    return (
        <div className="contact-lens-variants">
            <h3 className="section-title">Contact lens — volume &amp; price (optional)</h3>
            <p className="section-subtitle contact-lens-help">
                All fields are optional. You can save without any volume or price rows, or fill only what you need.
                Use &quot;Add volume option&quot; for more sizes.
            </p>
            <div className="contact-lens-rows">
                {rows.map((row, i) => (
                    <div key={i} className="contact-lens-variant-row">
                        <div className="form-group flex-1">
                            <label>Volume (optional)</label>
                            <div className="select-wrapper">
                                <select
                                    value={row.preset}
                                    onChange={(e) => updateRow(i, { preset: e.target.value, customMl: e.target.value === 'custom' ? row.customMl : '' })}
                                >
                                    <option value="">Select ml</option>
                                    {CONTACT_LENS_VOLUME_PRESETS.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="select-icon" size={18} />
                            </div>
                        </div>
                        {row.preset === 'custom' && (
                            <div className="form-group contact-lens-custom-ml">
                                <label>Custom (ml, optional)</label>
                                <input
                                    type="number"
                                    step="1"
                                    placeholder="e.g. 150"
                                    value={row.customMl}
                                    onChange={(e) => updateRow(i, { customMl: e.target.value })}
                                />
                            </div>
                        )}
                        <div className="form-group flex-1">
                            <label>Price (₹, optional)</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={row.price}
                                onChange={(e) => updateRow(i, { price: e.target.value })}
                            />
                        </div>
                        <button
                            type="button"
                            className="contact-lens-remove action-btn delete"
                            title="Remove row"
                            onClick={() => removeRow(i)}
                            disabled={rows.length <= 1}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
            </div>
            <button type="button" className="btn-secondary contact-lens-add" onClick={addRow}>
                <Plus size={18} /> Add volume option
            </button>
        </div>
    );
}
