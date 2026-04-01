import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceManager from './WorkspaceManager';
import axios from 'axios';

jest.mock('axios');

const mockWorkspace = {
  workspace: {
    id: 1,
    admin_email: 'admin@example.com',
    company_name: 'Acme Advisory',
    settings: { notifications_enabled: true, max_clients: 50 },
  },
  team_members: [
    { id: 1, email: 'admin@example.com', role: 'admin', first_name: 'Admin', last_name: 'User' },
    { id: 2, email: 'advisor@example.com', role: 'advisor', first_name: 'Jane', last_name: 'Smith' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'admin-token');
});

afterEach(() => {
  localStorage.clear();
});

describe('WorkspaceManager', () => {
  it('shows loading state initially', () => {
    axios.get.mockImplementationOnce(() => new Promise(() => {}));
    render(<WorkspaceManager userRole="admin" />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders company name', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<WorkspaceManager userRole="admin" />);
    await waitFor(() => expect(screen.getByText('Acme Advisory')).toBeInTheDocument());
  });

  it('renders team members list with emails', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<WorkspaceManager userRole="admin" />);
    await waitFor(() => expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0));
    expect(screen.getByText('advisor@example.com')).toBeInTheDocument();
  });

  it('shows team member roles', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<WorkspaceManager userRole="admin" />);
    await waitFor(() => expect(screen.getAllByText('admin').length).toBeGreaterThan(0));
    expect(screen.getByText('advisor')).toBeInTheDocument();
  });

  it('shows invite member button for admin', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<WorkspaceManager userRole="admin" />);
    await waitFor(() => expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument());
  });

  it('does not show invite button for non-admin', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<WorkspaceManager userRole="advisor" />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /invite member/i })).not.toBeInTheDocument();
    });
  });

  it('shows invite form when invite button clicked', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<WorkspaceManager userRole="admin" />);
    await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /invite member/i })));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('sends invite on form submit', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    axios.post.mockResolvedValueOnce({ data: { message: 'Invitation sent' } });
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });

    render(<WorkspaceManager userRole="admin" />);
    await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /invite member/i })));

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'newadvisor@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/workspace/users'),
        expect.objectContaining({ email: 'newadvisor@example.com' }),
        expect.any(Object)
      )
    );
  });

  it('shows error when workspace fetch fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    render(<WorkspaceManager userRole="admin" />);
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
  });

  it('fetches from /workspace endpoint with auth header', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<WorkspaceManager userRole="admin" />);
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/workspace'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }) })
      )
    );
  });
});
