import React from 'react';

const StatsCard = ({ title, value }) => {
    return (
        <div style={styles.card}>
            <h3 style={styles.title}>{title}</h3>
            <div style={styles.value}>{value}</div>
        </div>
    );
};

const styles = {
    card: {
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #eee',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        flex: 1,
        minWidth: '200px',
    },
    title: {
        color: '#333',
        fontSize: '16px',
        marginBottom: '12px',
        fontWeight: '500',
    },
    value: {
        color: '#8b4513', // Brownish red
        fontSize: '28px',
        fontWeight: '700',
    },
};

export default StatsCard;
