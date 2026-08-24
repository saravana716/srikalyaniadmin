import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiSearch, FiCreditCard, FiDollarSign, FiClock, FiCheckCircle } from 'react-icons/fi';
import Button from './Button';
import { subscribeCustomerAllPayments } from '../services/customersService';
import { formatINR } from '../utils/currencyUtils';
import { formatToIST } from '../utils/dateUtils';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

function formatPaymentTime(entry) {
  const ts = entry?.createdAt || entry?.paidDate || entry?.dueDate;
  if (!ts) return '—';
  if (typeof ts?.toDate === 'function') return formatToIST(ts.toDate().toISOString());
  return formatToIST(ts);
}

const CustomerPaymentHistoryModal = ({ customer, onClose, onAddFunds }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!customer) {
      setPayments([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeCustomerAllPayments(customer, (list) => {
      setPayments(list);
      setLoading(false);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [customer]);

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payments.filter((item) => {
      if (filterSource !== 'all') {
        if (filterSource === 'cash' && item.source !== 'customer_cash') return false;
        if (filterSource === 'installment' && item.source !== 'installment') return false;
        if (filterSource === 'payment' && item.source !== 'payment') return false;
      }
      if (q) {
        const text = [
          item.sourceLabel,
          item.chitPlan,
          item.mode,
          item.status,
          item.note,
          item.paidAmount,
          item.dueAmount,
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [payments, filterSource, searchQuery]);

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, item) => {
      const val = Number(item.paidAmount ?? item.amount ?? 0) || 0;
      return sum + val;
    }, 0);
  }, [payments]);

  if (!customer) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>All Payment History</h2>
            <p style={styles.modalSubtitle}>
              {customer.name} {customer.cusId ? `(${customer.cusId})` : ''} · {customer.mobile}
            </p>
          </div>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>

        {/* Stats Summary */}
        <div style={styles.statsContainer}>
          <div style={styles.statCard}>
            <div style={styles.statIconWrap}>
              <FiDollarSign size={20} color={MAROON} />
            </div>
            <div>
              <span style={styles.statLabel}>Total Account Balance</span>
              <div style={styles.statValue}>
                {formatINR(customer.accountBalance ?? customer.amount ?? 0)}
              </div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#dcfce7' }}>
              <FiCheckCircle size={20} color="#16a34a" />
            </div>
            <div>
              <span style={styles.statLabel}>Total Paid History</span>
              <div style={{ ...styles.statValue, color: '#16a34a' }}>
                {formatINR(totalPaid)}
              </div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#e0f2fe' }}>
              <FiCreditCard size={20} color="#0284c7" />
            </div>
            <div>
              <span style={styles.statLabel}>Total Payment Transactions</span>
              <div style={styles.statValue}>{payments.length} record{payments.length === 1 ? '' : 's'}</div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div style={styles.toolbar}>
          <div style={styles.tabFilterGroup}>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(filterSource === 'all' ? styles.tabBtnActive : {}) }}
              onClick={() => setFilterSource('all')}
            >
              All ({payments.length})
            </button>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(filterSource === 'cash' ? styles.tabBtnActive : {}) }}
              onClick={() => setFilterSource('cash')}
            >
              Add Cash
            </button>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(filterSource === 'installment' ? styles.tabBtnActive : {}) }}
              onClick={() => setFilterSource('installment')}
            >
              Installments
            </button>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(filterSource === 'payment' ? styles.tabBtnActive : {}) }}
              onClick={() => setFilterSource('payment')}
            >
              Direct Payments
            </button>
          </div>

          <div style={styles.searchBox}>
            <FiSearch style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* Content Body */}
        <div style={styles.modalBody}>
          {loading ? (
            <div style={styles.loadingState}>Loading payment history…</div>
          ) : filteredPayments.length === 0 ? (
            <div style={styles.emptyState}>
              <FiClock size={32} color="#9ca3af" />
              <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: 14 }}>
                {payments.length === 0
                  ? 'No payments or cash credits recorded for this customer yet.'
                  : 'No payment records match your search filter.'}
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date & Time</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Payment Mode</th>
                    <th style={styles.th}>Plan Name</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Note / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((item) => {
                    const isCash = item.source === 'customer_cash';
                    const isInstallment = item.source === 'installment';
                    const statusClass =
                      item.status === 'Completed' || item.status === 'Paid'
                        ? styles.statusCompleted
                        : styles.statusPending;

                    return (
                      <tr key={item.id} style={styles.tr}>
                        <td style={styles.td}>
                          <span style={styles.dateText}>{formatPaymentTime(item)}</span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badgeSource,
                              backgroundColor: isCash ? '#fef3c7' : isInstallment ? '#e0e7ff' : '#f3e8ff',
                              color: isCash ? '#92400e' : isInstallment ? '#3730a3' : '#6b21a8',
                            }}
                          >
                            {item.sourceLabel || (isCash ? 'Add Cash' : isInstallment ? 'Installment' : 'Payment')}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <strong style={{ color: '#16a34a', fontSize: 14 }}>
                            + {formatINR(item.paidAmount ?? item.amount ?? 0)}
                          </strong>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.badgeMode}>{item.mode || item.paymentMode || 'Cash'}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.planText}>{item.chitPlan || item.planName || '—'}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusBadge, ...statusClass }}>
                            {item.status || 'Completed'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.noteText}>{item.note || '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={styles.modalFooter}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onAddFunds && (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onAddFunds(customer);
              }}
            >
              + Add Cash / Credit Account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '20px',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: MAROON,
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '4px 0 0 0',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    padding: '16px 24px',
    backgroundColor: '#f9fafb',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
  },
  statIconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    backgroundColor: '#fce7f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: '500',
    display: 'block',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#111',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 24px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
    flexWrap: 'wrap',
  },
  tabFilterGroup: {
    display: 'flex',
    gap: '6px',
  },
  tabBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#fff',
    color: '#4b5563',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabBtnActive: {
    backgroundColor: MAROON,
    borderColor: MAROON,
    color: '#fff',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    padding: '6px 12px',
    width: '220px',
  },
  searchIcon: {
    color: '#9ca3af',
    marginRight: '6px',
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '13px',
    width: '100%',
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px',
  },
  loadingState: {
    padding: '40px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: `2px solid ${BORDER_GRAY}`,
    color: '#374151',
    fontWeight: '600',
    backgroundColor: '#f9fafb',
  },
  tr: {
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  td: {
    padding: '12px',
    verticalAlign: 'middle',
    color: '#1f2937',
  },
  dateText: {
    fontSize: '12px',
    color: '#4b5563',
  },
  badgeSource: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  badgeMode: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: '#fce7f0',
    color: MAROON,
  },
  planText: {
    fontWeight: '500',
    color: '#374151',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
  },
  noteText: {
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: `1px solid ${BORDER_GRAY}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    backgroundColor: '#fff',
  },
};

export default CustomerPaymentHistoryModal;
