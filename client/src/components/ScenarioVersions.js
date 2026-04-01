import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function ScenarioVersions({ scenarioId }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(null);

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  const fetchVersions = async () => {
    try {
      const res = await axios.get(`${API_URL}/scenarios/${scenarioId}/versions`, authHeader());
      setVersions(res.data.versions || []);
    } catch (err) {
      setError('Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scenarioId) fetchVersions();
  }, [scenarioId]);

  const handleRestore = async (versionId) => {
    setRestoring(versionId);
    try {
      await axios.post(
        `${API_URL}/scenarios/${scenarioId}/versions/${versionId}/restore`,
        {},
        authHeader()
      );
      await fetchVersions();
    } catch (err) {
      setError('Failed to restore version');
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (iso) => new Date(iso).toLocaleString('en-AU');

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);

  if (loading) return <div>Loading versions...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="scenario-versions">
      <h4>Version History</h4>

      {versions.length === 0 ? (
        <p>No versions saved yet.</p>
      ) : (
        <table className="data-table versions-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Date</th>
              <th>Initial Outlay</th>
              <th>Gearing</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td>Version {v.version_number}</td>
                <td>{formatDate(v.created_at)}</td>
                <td>{formatCurrency(v.parameters?.initial_outlay || 0)}</td>
                <td>{((v.parameters?.gearing_ratio || 0) * 100).toFixed(0)}%</td>
                <td>
                  <button
                    className="btn-small"
                    onClick={() => handleRestore(v.id)}
                    disabled={restoring === v.id}
                  >
                    {restoring === v.id ? 'Restoring...' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ScenarioVersions;
