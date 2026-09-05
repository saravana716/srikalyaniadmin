import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const AnalyticsChart = ({ planPurchases = [] }) => {
  const { data, activePct, activeCount, totalCount } = useMemo(() => {
    let active = 0;
    let completed = 0;
    let closed = 0;

    (planPurchases || []).forEach((p) => {
      const s = String(p.status || 'Active').trim().toLowerCase();
      if (s === 'completed') {
        completed += 1;
      } else if (['closed', 'cancelled'].includes(s)) {
        closed += 1;
      } else {
        active += 1;
      }
    });

    const total = active + completed + closed || 1;
    const activePercent = Math.round((active / total) * 100);

    const chartData = [
      { name: 'Active', value: active || (total === 1 ? 1 : 0), color: '#d4af37' },
      { name: 'Completed', value: completed, color: '#801A39' },
      { name: 'Closed / Cancelled', value: closed, color: '#9ca3af' },
    ].filter((item) => item.value > 0);

    return {
      data: chartData,
      activePct: activePercent,
      activeCount: active,
      totalCount: planPurchases.length,
    };
  }, [planPurchases]);

  return (
    <div style={styles.container} className="chart-card">
      <h3 style={styles.title}>Chit Scheme Analytics</h3>
      <div style={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              innerRadius={70}
              outerRadius={90}
              startAngle={90}
              endAngle={450}
              paddingAngle={2}
              dataKey="value"
              cornerRadius={6}
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
          <div style={styles.percentage}>{activePct}%</div>
          <div style={styles.label}>Active Chits ({activeCount}/{totalCount})</div>
        </div>
      </div>

      <div style={styles.legend}>
        <LegendItem color="#d4af37" label="Active" />
        <LegendItem color="#801A39" label="Completed" />
        <LegendItem color="#9ca3af" label="Closed/Cancelled" />
      </div>
    </div>
  );
};

const LegendItem = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: color }}></div>
    <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 500 }}>{label}</span>
  </div>
);

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
    color: '#111827',
    marginBottom: '16px',
  },
  chartContainer: {
    position: 'relative',
    height: '250px',
    marginBottom: '20px',
  },
  centerText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    width: '120px',
  },
  percentage: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#111827',
  },
  label: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
    lineHeight: 1.2,
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
};

export default AnalyticsChart;
