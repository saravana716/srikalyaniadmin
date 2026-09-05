import React, { useEffect, useState } from 'react';
import { subscribeAllPayments } from '../services/paymentsService';
import { formatPaidDate } from '../utils/dateUtils';
import { formatINR } from '../utils/currencyUtils';

const MAROON = '#801A39';

const PaymentTable = ({ payments: externalPayments }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (externalPayments && Array.isArray(externalPayments)) {
      setPayments(externalPayments);
      setLoading(false);
      return;
    }
    const unsub = subscribeAllPayments((data) => {
      setPayments(data);
      setLoading(false);
    });
    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {}
    };
  }, [externalPayments]);

  const recent = payments.slice(0, 6);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Recent Payments & Collections</h3>
      {loading && <p style={{ color: '#888', fontSize: 14 }}>Loading recent payments…</p>}
      {!loading && recent.length === 0 && (
        <p style={{ color: '#888', fontSize: 14 }}>No payments recorded yet.</p>
      )}
      {recent.length > 0 && (
        <div style={styles.tableWrapper} className="payment-table-wrapper">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Plan / Description</th>
                <th style={styles.th}>Payment Mode</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Paid Amount</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => {
                const rowId = row.id || Math.random().toString();
                const custName = row.customerName || row.name || 'Customer';
                const cusId = row.cusId || row.customerId || '';
                const planName = row.chitPlan || row.planName || row.note || 'Gold Scheme';
                const mode = row.mode || row.paymentMode || 'Cash';
                const dateVal = row.paidDate || row.createdAt || row.date || row.dueDate;
                const paidAmt = Number(row.paidAmount ?? row.amount ?? row.dueAmount ?? 0);
                const status = row.status || 'Paid';

                return (
                  <tr key={rowId} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '13.5px', color: '#111827' }}>{custName}</strong>
                        {cusId && <span style={{ fontSize: '11px', color: MAROON, fontWeight: 600 }}>{cusId}</span>}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 500, color: '#374151' }}>{planName}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.modeBadge}>{mode}</span>
                    </td>
                    <td style={styles.td}>
                      {formatPaidDate(dateVal, { dateOnly: true })}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 700, color: '#15803d' }}>
                      {formatINR(paidAmt)}
                    </td>
                    <td style={styles.td}>
                      <span style={String(status).toLowerCase() === 'pending' ? styles.statusPending : styles.statusPaid}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const styles = {
    container: {
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #eee',
        padding: '24px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    },
    title: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#000',
        marginBottom: '20px',
    },
    tableWrapper: {
        overflowX: 'auto',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '800px',
    },
    th: {
        textAlign: 'left',
        padding: '16px',
        color: '#888',
        fontWeight: '500',
        fontSize: '14px',
        borderBottom: '1px solid #f0f0f0',
    },
    tr: {
        borderBottom: '1px solid #f9f9f9',
    },
    td: {
        padding: '16px',
        fontSize: '14px',
        color: '#333',
    },
    sortIcon: {
        fontSize: '12px',
        marginLeft: '4px',
        opacity: 0.5
    },
    modeBadge: {
        backgroundColor: '#f3f4f6',
        color: '#374151',
        padding: '3px 10px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600',
        border: '1px solid #e5e7eb',
    },
    statusPending: {
        backgroundColor: '#ef4444',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
    },
    statusPaid: {
        backgroundColor: '#16a34a',
        color: 'white',
        padding: '4px 16px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
    }
};

export default PaymentTable;
