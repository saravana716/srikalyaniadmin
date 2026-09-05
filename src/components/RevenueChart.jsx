import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINR } from '../utils/currencyUtils';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RevenueChart = ({ payments = [] }) => {
  const chartData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Prepare 12 months array for current year
    const monthTotals = Array.from({ length: 12 }, (_, i) => ({
      name: MONTH_NAMES[i],
      monthIndex: i,
      value: 0,
    }));

    (payments || []).forEach((p) => {
      const status = String(p.status || 'Paid').toLowerCase();
      if (status === 'failed' || status === 'cancelled') return;

      const amt = Number(p.paidAmount ?? p.amount ?? p.dueAmount ?? 0) || 0;
      if (amt <= 0) return;

      const rawTs = p.paidDate || p.createdAt || p.date || p.dueDate;
      if (!rawTs) return;

      let d = null;
      if (typeof rawTs?.toDate === 'function') {
        d = rawTs.toDate();
      } else if (typeof rawTs === 'object' && rawTs.seconds) {
        d = new Date(rawTs.seconds * 1000);
      } else {
        const str = String(rawTs);
        d = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
      }

      if (d && !Number.isNaN(d.getTime())) {
        const m = d.getMonth();
        const y = d.getFullYear();
        if (y === currentYear || (y === currentYear - 1 && m > now.getMonth())) {
          monthTotals[m].value += amt;
        }
      }
    });

    // Show last 6-12 months window up to current month
    const curMonth = now.getMonth();
    const reordered = [
      ...monthTotals.slice(curMonth + 1),
      ...monthTotals.slice(0, curMonth + 1),
    ];

    return reordered;
  }, [payments]);

  return (
    <div style={styles.container} className="chart-card">
      <h3 style={styles.title}>Monthly Collection Report</h3>
      <div style={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
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
              stroke="#801A39"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#801A39' }}
              activeDot={{ r: 6, fill: '#801A39' }}
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
        <p style={tooltipStyles.label}>{payload[0].payload.name} Collection</p>
        <p style={tooltipStyles.value}>{formatINR(payload[0].value)}</p>
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
    flex: 2,
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '24px',
  },
  chartWrapper: {
    width: '100%',
  },
};

const tooltipStyles = {
  container: {
    backgroundColor: '#801A39',
    padding: '8px 14px',
    borderRadius: '8px',
    color: 'white',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  label: {
    fontSize: '11px',
    opacity: 0.9,
    margin: 0,
  },
  value: {
    fontSize: '15px',
    fontWeight: 'bold',
    margin: '2px 0 0 0',
  },
};

export default RevenueChart;
