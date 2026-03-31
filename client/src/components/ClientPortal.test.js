import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClientPortal from './ClientPortal';
import axios from 'axios';

jest.mock('axios');

const mockClient = { id: 1, name: 'Jane Smith', email: 'jane@example.com' };
const mockScenarios = [
  {
    id: 1,
    name: 'Conservative Plan',
    initial_outlay: 50000,
    gearing_ratio: 0.4,
    annual_investment: 20000,
    final_wealth: 850000,
    xirr: 0.082,
    created_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 2,
    name: 'Growth Plan',
    initial_outlay: 100000,
    gearing_ratio: 0.5,
    annual_investment: 30000,
    final_wealth: 1500000,
    xirr: 0.11,
    created_at: '2026-02-01T00:00:00Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ClientPortal', () => {
  it('shows loading state initially', () => {
    axios.get.mockReturnValue(new Promise(() => {}));
    render(<ClientPortal portalToken="valid-token" />);
    expect(screen.getByText(/loading your financial scenarios/i)).toBeInTheDocument();
  });

  it('renders client name after loading', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => expect(screen.getByText(/welcome, jane smith/i)).toBeInTheDocument());
  });

  it('renders client email', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => expect(screen.getByText('jane@example.com')).toBeInTheDocument());
  });

  it('renders portal header', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => expect(screen.getByText(/debt recycling portal/i)).toBeInTheDocument());
  });

  it('shows scenario count', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => expect(screen.getByText(/your scenarios \(2\)/i)).toBeInTheDocument());
  });

  it('renders scenario names in table', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => {
      expect(screen.getByText('Conservative Plan')).toBeInTheDocument();
      expect(screen.getByText('Growth Plan')).toBeInTheDocument();
    });
  });

  it('shows empty state when no scenarios', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: [] } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => expect(screen.getByText(/no scenarios available yet/i)).toBeInTheDocument());
  });

  it('shows error for invalid token (401)', async () => {
    axios.get.mockRejectedValue({ response: { status: 401 } });
    render(<ClientPortal portalToken="invalid-token" />);
    await waitFor(() => expect(screen.getByText(/invalid or expired portal link/i)).toBeInTheDocument());
  });

  it('shows generic error on network failure', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));
    render(<ClientPortal portalToken="some-token" />);
    await waitFor(() => expect(screen.getByText(/failed to load portal data/i)).toBeInTheDocument());
  });

  it('calls correct API endpoint with token', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: [] } });
    render(<ClientPortal portalToken="my-portal-token" />);
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('portal/scenarios?token=my-portal-token')));
  });

  it('shows scenario detail when row clicked', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => screen.getByText('Conservative Plan'));
    fireEvent.click(screen.getByText('Conservative Plan'));
    await waitFor(() => expect(screen.getAllByText('Conservative Plan').length).toBeGreaterThan(1));
  });

  it('shows final wealth in scenario detail', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => screen.getByText('Conservative Plan'));
    fireEvent.click(screen.getByText('Conservative Plan'));
    await waitFor(() => expect(screen.getAllByText(/850,000/).length).toBeGreaterThan(0));
  });

  it('shows XIRR percentage in scenario detail', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => screen.getByText('Conservative Plan'));
    fireEvent.click(screen.getByText('Conservative Plan'));
    await waitFor(() => expect(screen.getAllByText(/8\.20%/).length).toBeGreaterThan(0));
  });

  it('shows read-only footer message', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => expect(screen.getByText(/contact your financial advisor/i)).toBeInTheDocument());
  });

  it('shows portal read-only label in header', async () => {
    axios.get.mockResolvedValue({ data: { client: mockClient, scenarios: mockScenarios } });
    render(<ClientPortal portalToken="valid-token" />);
    await waitFor(() => expect(screen.getByText(/read-only view for jane smith/i)).toBeInTheDocument());
  });
});
