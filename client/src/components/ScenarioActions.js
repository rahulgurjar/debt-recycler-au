import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function ScenarioActions({ scenario, userTier }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [emailError, setEmailError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/scenarios/${scenario.id}/report`,
        { title: scenario.name, include_company_branding: true },
        { ...authHeader(), responseType: 'blob' }
      );
      downloadBlob(res.data, `${scenario.name}-report.pdf`);
    } catch (err) {
      alert('Failed to generate PDF report');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExcelLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/scenarios/${scenario.id}/export`,
        {},
        { ...authHeader(), responseType: 'blob' }
      );
      downloadBlob(res.data, `${scenario.name}-export.xlsx`);
    } catch (err) {
      alert('Failed to export Excel');
    } finally {
      setExcelLoading(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailStatus('');
    try {
      await axios.post(
        `${API_URL}/scenarios/${scenario.id}/email`,
        { recipient_email: recipientEmail, subject: `Debt Recycling Scenario: ${scenario.name}` },
        authHeader()
      );
      setEmailStatus('Email sent successfully');
      setRecipientEmail('');
      setEmailOpen(false);
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Failed to send email');
    }
  };

  const isProfessional = ['professional', 'enterprise'].includes(userTier);

  return (
    <div className="scenario-actions">
      <h3>{scenario.name}</h3>

      <div className="actions-row">
        <button
          className="btn-action"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
        >
          {pdfLoading ? 'Generating...' : 'Download PDF'}
        </button>

        {isProfessional ? (
          <button
            className="btn-action"
            onClick={handleExportExcel}
            disabled={excelLoading}
          >
            {excelLoading ? 'Exporting...' : 'Export Excel'}
          </button>
        ) : (
          <span className="upgrade-note">
            Excel export requires Professional plan
          </span>
        )}

        <button
          className="btn-action"
          onClick={() => {
            setEmailOpen(!emailOpen);
            setEmailStatus('');
            setEmailError('');
          }}
        >
          Email Report
        </button>
      </div>

      {emailStatus && <div className="success-message">{emailStatus}</div>}

      {emailOpen && (
        <form className="email-form" onSubmit={handleSendEmail}>
          <h4>Email Scenario Report</h4>
          {emailError && <div className="error-message">{emailError}</div>}
          <div className="form-group">
            <label htmlFor="recipient-email">Recipient Email</label>
            <input
              id="recipient-email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="client@example.com"
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Send Email</button>
            <button type="button" className="btn-secondary" onClick={() => setEmailOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default ScenarioActions;
