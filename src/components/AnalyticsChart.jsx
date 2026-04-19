import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Completed', value: 80, color: '#5c202a' }, // Dark Maroon
    { name: 'Active', value: 15, color: '#d4af37' }, // Gold
    { name: 'Default', value: 5, color: '#f0f0f0' }, // Light Gray
];

const AnalyticsChart = () => {
    return (
        <div style={styles.container} className="chart-card">
            <h3 style={styles.title}>Analytics</h3>
            <div style={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius={70}
                            outerRadius={90}
                            startAngle={90}
                            endAngle={450}
                            paddingAngle={0}
                            dataKey="value"
                            cornerRadius={10} // Rounded ends
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div style={styles.centerText}>
                    <div style={styles.percentage}>80%</div>
                    <div style={styles.label}>Completed</div>
                </div>
            </div>

            <div style={styles.legend}>
                <LegendItem color="#d4af37" label="Active" />
                <LegendItem color="#5c202a" label="Completed" />
                <LegendItem color="#f0f0f0" label="Default" />
            </div>

        </div>
    );
};

const LegendItem = ({ color, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: color }}></div>
        <span style={{ fontSize: '14px', color: '#666' }}>{label}</span>
    </div>
)

const styles = {
    container: {
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #eee',
        padding: '24px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    },
    title: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#000',
        marginBottom: '16px',
    },
    chartContainer: {
        position: 'relative',
        height: '250px',
        marginBottom: '20px'
    },
    centerText: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
    },
    percentage: {
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#333',
    },
    label: {
        fontSize: '12px',
        color: '#999',
    },
    legend: {
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        flexWrap: 'wrap'
    }
};

export default AnalyticsChart;
