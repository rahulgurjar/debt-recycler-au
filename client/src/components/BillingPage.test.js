import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BillingPage from './BillingPage';
import axios from 'axios';

jest.mock('axios');

const mockWorkspace = {
  workspace: {
    id: 1,
    company_name: 'Acme Advisory',
    subscription_tier: 'starter',
    subscription_status: 'active',
  },
  team_members: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
});

describe('BillingPage', () => {
  it('shows loading state initially', () => {
    axios.get.mockImplementationOnce(() => new Promise(() => {}));
    render(<BillingPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows current tier', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<BillingPage />);
    await waitFor(() => expect(screen.getAllByText(/starter/i).length).toBeGreaterThan(0));
  });

  it('shows all three plan options', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<BillingPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/professional/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/enterprise/i).length).toBeGreaterThan(0);
    });
  });

  it('shows upgrade button for higher tiers', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<BillingPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /upgrade/i }).length).toBeGreaterThan(0)
    );
  });

  it('shows current plan badge on active tier', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<BillingPage />);
    await waitFor(() => expect(screen.getByText('Current Plan')).toBeInTheDocument());
  });

  it('shows subscription form when upgrade clicked', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<BillingPage />);
    await waitFor(() => {
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      fireEvent.click(upgradeButtons[0]);
    });
    expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();
  });

  it('calls /subscribe on form submit', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    axios.post.mockResolvedValueOnce({ data: { subscription_id: 'sub_123', tier: 'professional' } });
    axios.get.mockResolvedValueOnce({ data: { ...mockWorkspace, workspace: { ...mockWorkspace.workspace, subscription_tier: 'professional' } } });

    render(<BillingPage />);
    await waitFor(() => {
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      fireEvent.click(upgradeButtons[0]);
    });

    fireEvent.change(screen.getByLabelText(/payment method/i), {
      target: { value: 'pm_test_card' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm upgrade/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/subscribe'),
        expect.objectContaining({ payment_method_id: 'pm_test_card' }),
        expect.any(Object)
      )
    );
  });

  it('shows success message after upgrade', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    axios.post.mockResolvedValueOnce({ data: { subscription_id: 'sub_123', tier: 'professional' } });
    axios.get.mockResolvedValueOnce({ data: { ...mockWorkspace, workspace: { ...mockWorkspace.workspace, subscription_tier: 'professional' } } });

    render(<BillingPage />);
    await waitFor(() => {
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      fireEvent.click(upgradeButtons[0]);
    });

    fireEvent.change(screen.getByLabelText(/payment method/i), {
      target: { value: 'pm_test_card' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm upgrade/i }));

    await waitFor(() => expect(screen.getByText(/upgraded/i)).toBeInTheDocument());
  });

  it('shows plan features list', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    render(<BillingPage />);
    await waitFor(() => expect(screen.getByText('Excel export')).toBeInTheDocument());
  });

  it('shows error on upgrade failure', async () => {
    axios.get.mockResolvedValueOnce({ data: mockWorkspace });
    axios.post.mockRejectedValueOnce({ response: { data: { error: 'Card declined' } } });

    render(<BillingPage />);
    await waitFor(() => {
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      fireEvent.click(upgradeButtons[0]);
    });

    fireEvent.change(screen.getByLabelText(/payment method/i), {
      target: { value: 'pm_card_declined' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm upgrade/i }));

    await waitFor(() => expect(screen.getByText('Card declined')).toBeInTheDocument());
  });
});
