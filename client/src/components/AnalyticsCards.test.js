import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsCards from './AnalyticsCards';
import axios from 'axios';

jest.mock('axios');

const mockAnalytics = {
  total_users: 42,
  signups_7d: 5,
  signups_30d: 18,
  mrr: 4500,
  arr: 54000,
  tier_breakdown: { starter: 10, professional: 25, enterprise: 7 },
  top_customers: [
    { email: 'top@example.com', company_name: 'Top Co', tier: 'enterprise', subscription_status: 'active' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'admin-token');
});

afterEach(() => {
  localStorage.clear();
});

describe('AnalyticsCards', () => {
  it('shows loading state initially', () => {
    axios.get.mockImplementationOnce(() => new Promise(() => {}));
    render(<AnalyticsCards />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders total users count', async () => {
    axios.get.mockResolvedValueOnce({ data: mockAnalytics });
    render(<AnalyticsCards />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
  });

  it('renders signups in last 7 days', async () => {
    axios.get.mockResolvedValueOnce({ data: mockAnalytics });
    render(<AnalyticsCards />);
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
  });

  it('renders signups in last 30 days', async () => {
    axios.get.mockResolvedValueOnce({ data: mockAnalytics });
    render(<AnalyticsCards />);
    await waitFor(() => expect(screen.getByText('18')).toBeInTheDocument());
  });

  it('renders MRR label', async () => {
    axios.get.mockResolvedValueOnce({ data: mockAnalytics });
    render(<AnalyticsCards />);
    await waitFor(() => expect(screen.getByText(/mrr/i)).toBeInTheDocument());
  });

  it('shows tier breakdown with starter label', async () => {
    axios.get.mockResolvedValueOnce({ data: mockAnalytics });
    render(<AnalyticsCards />);
    await waitFor(() => expect(screen.getByText(/starter/i)).toBeInTheDocument());
  });

  it('shows tier breakdown with professional label', async () => {
    axios.get.mockResolvedValueOnce({ data: mockAnalytics });
    render(<AnalyticsCards />);
    await waitFor(() => expect(screen.getByText(/professional/i)).toBeInTheDocument());
  });

  it('shows top customers section with company name', async () => {
    axios.get.mockResolvedValueOnce({ data: mockAnalytics });
    render(<AnalyticsCards />);
    await waitFor(() => expect(screen.getByText('Top Co')).toBeInTheDocument());
  });

  it('shows access denied message on 403', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Forbidden' } } });
    render(<AnalyticsCards />);
    await waitFor(() => expect(screen.getByText(/admin access required|forbidden/i)).toBeInTheDocument());
  });

  it('fetches from /admin/analytics with auth header', async () => {
    axios.get.mockResolvedValueOnce({ data: mockAnalytics });
    render(<AnalyticsCards />);
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/admin/analytics'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }) })
      )
    );
  });
});
