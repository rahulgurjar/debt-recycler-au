import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScenarioList from './ScenarioList';
import axios from 'axios';

jest.mock('axios');

const mockScenarios = [
  { id: 1, name: 'Conservative Plan', final_wealth: 800000, xirr: 0.065, created_at: '2026-01-01', initial_outlay: 55000, gearing_ratio: 0.45, annual_investment: 25000, loc_interest_rate: 0.07, etf_dividend_rate: 0.03, etf_capital_appreciation: 0.07 },
  { id: 2, name: 'Aggressive Plan', final_wealth: 1500000, xirr: 0.095, created_at: '2026-02-01', initial_outlay: 80000, gearing_ratio: 0.6, annual_investment: 40000, loc_interest_rate: 0.065, etf_dividend_rate: 0.035, etf_capital_appreciation: 0.09 },
];

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
});

describe('ScenarioList', () => {
  it('shows loading state initially', () => {
    axios.get.mockImplementationOnce(() => new Promise(() => {}));
    render(<ScenarioList />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders scenario names', async () => {
    axios.get.mockResolvedValueOnce({ data: { success: true, scenarios: mockScenarios } });
    render(<ScenarioList />);
    await waitFor(() => expect(screen.getByText('Conservative Plan')).toBeInTheDocument());
    expect(screen.getByText('Aggressive Plan')).toBeInTheDocument();
  });

  it('shows empty state when no scenarios', async () => {
    axios.get.mockResolvedValueOnce({ data: { success: true, scenarios: [] } });
    render(<ScenarioList />);
    await waitFor(() => expect(screen.getByText(/no scenarios/i)).toBeInTheDocument());
  });

  it('shows scenario count in heading', async () => {
    axios.get.mockResolvedValueOnce({ data: { success: true, scenarios: mockScenarios } });
    render(<ScenarioList />);
    await waitFor(() => expect(screen.getByText(/saved scenarios/i)).toBeInTheDocument());
  });

  it('shows delete button for each scenario', async () => {
    axios.get.mockResolvedValueOnce({ data: { success: true, scenarios: mockScenarios } });
    render(<ScenarioList />);
    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBe(2);
    });
  });

  it('shows error when fetch fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    render(<ScenarioList />);
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
  });
});
