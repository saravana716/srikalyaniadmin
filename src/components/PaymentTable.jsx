import React from 'react';

const PaymentTable = () => {
    const data = [
        { id: '001', name: 'Sunil', plan: 'Chits', amount: '₹2000', date: '10 Jun2025', paidDate: '10 Jun2025', status: 'Pending' },
        { id: '002', name: 'Mari', plan: 'Chits', amount: '₹2000', date: '10 Jun2025', paidDate: '10 Jun2025', status: 'Paid' },
    ];

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Recent Payment</h3>
            <div style={styles.tableWrapper} className="payment-table-wrapper">
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Plan ID <span style={styles.sortIcon}>↕</span></th>
                            <th style={styles.th}>Customer Name <span style={styles.sortIcon}>↕</span></th>
                            <th style={styles.th}>Plan Name <span style={styles.sortIcon}>↕</span></th>
                            <th style={styles.th}>Amount <span style={styles.sortIcon}>↕</span></th>
                            <th style={styles.th}>Plan Start Date <span style={styles.sortIcon}>↕</span></th>
                            <th style={styles.th}>Paid Date <span style={styles.sortIcon}>↕</span></th>
                            <th style={styles.th}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr key={row.id} style={styles.tr}>
                                <td style={styles.td}>{row.id}</td>
                                <td style={styles.td}>{row.name}</td>
                                <td style={styles.td}>{row.plan}</td>
                                <td style={styles.td}>{row.amount}</td>
                                <td style={styles.td}>{row.date}</td>
                                <td style={styles.td}>{row.paidDate}</td>
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
        fontSize: '20px', // Slightly larger section title
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
        padding: '4px 20px', // Wider mostly
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
    }
};

export default PaymentTable;
