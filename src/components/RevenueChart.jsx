import React from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Jan', value: 2000 },
    { name: 'Feb', value: 1500 },
    { name: 'Mar', value: 2500 },
    { name: 'Apr', value: 1800 },
    { name: 'May', value: 1600 },
    { name: 'Jun', value: 2678 },
    { name: 'Jul', value: 1400 },
    { name: 'Aug', value: 2000 },
    { name: 'Sep', value: 3000 },
    { name: 'Oct', value: 2200 },
];

const RevenueChart = () => {
    return (
        <div style={styles.container} className="chart-card">
            <h3 style={styles.title}>Monthly Collection Repoert</h3>
            <div style={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data}>
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#999' }}
                            dy={10}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#ddd' }} />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#8b4513"
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#8b4513' }}
                            activeDot={{ r: 6, fill: '#8b4513' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div style={tooltipStyles.container}>
                <p style={tooltipStyles.label}>Collection</p>
                <p style={tooltipStyles.value}>₹{payload[0].value}</p>
            </div>
        );
    }
    return null;
};

const styles = {
    container: {
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #eee',
        padding: '24px',
        flex: 2, // Take up 2/3 space
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    },
    title: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#000',
        marginBottom: '24px',
    },
    chartWrapper: {
        width: '100%',
    }
};

const tooltipStyles = {
    container: {
        backgroundColor: '#0f0c29', // Dark background like image
        padding: '8px 12px',
        borderRadius: '8px',
        color: 'white',
        textAlign: 'center',
    },
    label: {
        fontSize: '10px',
        opacity: 0.8,
        margin: 0,
    },
    value: {
        fontSize: '14px',
        fontWeight: 'bold',
        margin: 0,
    }
}

export default RevenueChart;
