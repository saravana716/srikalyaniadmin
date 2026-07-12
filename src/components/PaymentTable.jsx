import React, { useEffect, useState } from 'react';
import { subscribePayments } from '../services/paymentsService';
import { formatToIST } from '../utils/dateUtils';

const PaymentTable = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = subscribePayments((data) => {
            setPayments(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const recent = payments.slice(0, 5);

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Recent Payment</h3>
            {loading && <p style={{ color: '#888', fontSize: 14 }}>Loading payments…</p>}
            {!loading && recent.length === 0 && (
                <p style={{ color: '#888', fontSize: 14 }}>No payments yet.</p>
            )}
            {recent.length > 0 && (
                <div style={styles.tableWrapper} className="payment-table-wrapper">
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Plan ID <span style={styles.sortIcon}>↕</span></th>
                                <th style={styles.th}>Customer Name <span style={styles.sortIcon}>↕</span></th>
                                <th style={styles.th}>Plan Name <span style={styles.sortIcon}>↕</span></th>
                                <th style={styles.th}>Amount <span style={styles.sortIcon}>↕</span></th>
                                <th style={styles.th}>Due Date <span style={styles.sortIcon}>↕</span></th>
                                <th style={styles.th}>Paid Amount <span style={styles.sortIcon}>↕</span></th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recent.map((row) => (
                                <tr key={row.id} style={styles.tr}>
                                    <td style={styles.td}>{row.id.slice(0, 8)}</td>
                                    <td style={styles.td}>{row.customerName}</td>
                                    <td style={styles.td}>{row.chitPlan}</td>
                                    <td style={styles.td}>{row.dueAmount}</td>
                                    <td style={styles.td}>{formatToIST(row.dueDate)}</td>
                                    <td style={styles.td}>{row.paidAmount}</td>
                                    <td style={styles.td}>
                                        <span style={row.status === 'Pending' ? styles.statusPending : styles.statusPaid}>
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
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
    statusPending: {
        backgroundColor: '#ff0000',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
    },
    statusPaid: {
        backgroundColor: '#00b300',
        color: 'white',
        padding: '4px 20px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
    }
};

export default PaymentTable;
