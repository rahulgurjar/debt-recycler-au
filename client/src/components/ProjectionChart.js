import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function ProjectionChart({ data }) {
  const formatCurrency = (value) => {
    return `$${(value / 1000).toFixed(0)}K`;
  };

  return (
    <div className="chart-container">
      <div className="chart-row">
        <div className="chart">
          <h3>Wealth Projection (20 Years)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }}
              />
              <YAxis
                label={{ value: 'Wealth ($)', angle: -90, position: 'insideLeft' }}
                tickFormatter={formatCurrency}
              />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="wealth_30_june"
                stroke="#2563eb"
                name="Net Wealth"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart">
          <h3>PF Value vs Loan</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }}
              />
              <YAxis
                tickFormatter={formatCurrency}
                label={{ value: 'Value ($)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="pf_value_30_june" fill="#10b981" name="PF Value" />
              <Bar dataKey="loan" fill="#ef4444" name="Loan" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart">
          <h3>Gearing Ratio</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }}
              />
              <YAxis
                label={{ value: 'Ratio (%)', angle: -90, position: 'insideLeft' }}
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <Tooltip
                formatter={(value) => `${(value * 100).toFixed(2)}%`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="gearing"
                stroke="#f59e0b"
                name="Gearing %"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart">
          <h3>Annual Dividend vs Interest</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }}
              />
              <YAxis
                tickFormatter={formatCurrency}
                label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="dividend" fill="#3b82f6" name="Dividend" />
              <Bar dataKey="loc_interest" fill="#ef4444" name="Interest" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default ProjectionChart;
