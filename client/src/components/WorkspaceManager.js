import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function WorkspaceManager({ userRole }) {
  const [workspace, setWorkspace] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('advisor');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  const fetchWorkspace = async () => {
    try {
      const res = await axios.get(`${API_URL}/workspace`, authHeader());
      setWorkspace(res.data.workspace);
      setTeamMembers(res.data.team_members || []);
    } catch (err) {
      setError('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    try {
      await axios.post(
        `${API_URL}/workspace/users`,
        { email: inviteEmail, role: inviteRole },
        authHeader()
      );
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteForm(false);
      fetchWorkspace();
    } catch (err) {
      setInviteError(err.response?.data?.error || 'Failed to send invite');
    }
  };

  if (loading) return <div>Loading workspace...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="workspace-manager">
      <h2>Workspace</h2>

      {workspace && (
        <div className="workspace-info">
          <p><strong>Company:</strong> {workspace.company_name}</p>
          <p><strong>Admin:</strong> {workspace.admin_email}</p>
        </div>
      )}

      <div className="team-section">
        <div className="section-header">
          <h3>Team Members</h3>
          {userRole === 'admin' && (
            <button
              className="btn-primary"
              onClick={() => setShowInviteForm(!showInviteForm)}
            >
              Invite Member
            </button>
          )}
        </div>

        {inviteSuccess && <div className="success-message">{inviteSuccess}</div>}

        {showInviteForm && userRole === 'admin' && (
          <form className="invite-form" onSubmit={handleInvite}>
            <h4>Invite Team Member</h4>
            {inviteError && <div className="error-message">{inviteError}</div>}
            <div className="form-group">
              <label htmlFor="invite-email">Email</label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="invite-role">Role</label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="advisor">Advisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">Send Invite</button>
              <button type="button" className="btn-secondary" onClick={() => setShowInviteForm(false)}>Cancel</button>
            </div>
          </form>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member) => (
              <tr key={member.id}>
                <td>{member.email}</td>
                <td>{member.first_name} {member.last_name}</td>
                <td>{member.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WorkspaceManager;
