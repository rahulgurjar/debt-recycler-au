import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function ClientsTable() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    dob: '',
    annual_income: '',
    risk_profile: 'moderate',
  });
  const [formError, setFormError] = useState('');

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API_URL}/clients`, authHeader());
      setClients(res.data.clients);
    } catch (err) {
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await axios.post(
        `${API_URL}/clients`,
        { ...formData, annual_income: parseFloat(formData.annual_income) },
        authHeader()
      );
      setShowForm(false);
      setFormData({ name: '', email: '', dob: '', annual_income: '', risk_profile: 'moderate' });
      setLoading(true);
      fetchClients();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save client');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/clients/${id}`, authHeader());
      setLoading(true);
      fetchClients();
    } catch (err) {
      setError('Failed to delete client');
    }
  };

  if (loading) return <div>Loading clients...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="clients-table">
      <div className="table-header">
        <h2>Clients</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          Add Client
        </button>
      </div>

      {showForm && (
        <form className="client-form" onSubmit={handleSave}>
          <h3>New Client</h3>
          {formError && <div className="error-message">{formError}</div>}
          <div className="form-group">
            <label htmlFor="client-name">Full Name</label>
            <input
              id="client-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="client-email">Email</label>
            <input
              id="client-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="client-dob">Date of Birth</label>
            <input
              id="client-dob"
              type="date"
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="client-income">Annual Income</label>
            <input
              id="client-income"
              type="number"
              value={formData.annual_income}
              onChange={(e) => setFormData({ ...formData, annual_income: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="client-risk">Risk Profile</label>
            <select
              id="client-risk"
              value={formData.risk_profile}
              onChange={(e) => setFormData({ ...formData, risk_profile: e.target.value })}
            >
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
              <option value="balanced">Balanced</option>
              <option value="growth">Growth</option>
              <option value="high_growth">High Growth</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Save Client</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {clients.length === 0 && !showForm ? (
        <p className="empty-state">No clients yet. Add your first client above.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Risk Profile</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td>{client.email}</td>
                <td>{client.risk_profile}</td>
                <td>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete(client.id)}
                  >
                    Delete
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

export default ClientsTable;
