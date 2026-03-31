import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScenarioVersions from './ScenarioVersions';
import axios from 'axios';

jest.mock('axios');

const mockVersions = [
  { id: 1, version_number: 1, created_at: '2026-01-01T10:00:00Z', parameters: { initial_outlay: 55000, gearing_ratio: 0.45 } },
  { id: 2, version_number: 2, created_at: '2026-02-01T10:00:00Z', parameters: { initial_outlay: 60000, gearing_ratio: 0.5 } },
];

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
});

describe('ScenarioVersions', () => {
  it('shows loading state initially', () => {
    axios.get.mockImplementationOnce(() => new Promise(() => {}));
    render(<ScenarioVersions scenarioId={10} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders version list', async () => {
    axios.get.mockResolvedValueOnce({ data: { versions: mockVersions } });
    render(<ScenarioVersions scenarioId={10} />);
    await waitFor(() => expect(screen.getByText(/version 1/i)).toBeInTheDocument());
    expect(screen.getByText(/version 2/i)).toBeInTheDocument();
  });

  it('shows empty state when no versions', async () => {
    axios.get.mockResolvedValueOnce({ data: { versions: [] } });
    render(<ScenarioVersions scenarioId={10} />);
    await waitFor(() => expect(screen.getByText(/no versions/i)).toBeInTheDocument());
  });

  it('shows restore button for each version', async () => {
    axios.get.mockResolvedValueOnce({ data: { versions: mockVersions } });
    render(<ScenarioVersions scenarioId={10} />);
    await waitFor(() => {
      const restoreBtns = screen.getAllByRole('button', { name: /restore/i });
      expect(restoreBtns.length).toBe(2);
    });
  });

  it('calls restore endpoint when restore clicked', async () => {
    axios.get.mockResolvedValueOnce({ data: { versions: mockVersions } });
    axios.post.mockResolvedValueOnce({ data: { message: 'Restored' } });
    axios.get.mockResolvedValueOnce({ data: { versions: mockVersions } });

    render(<ScenarioVersions scenarioId={10} />);
    await waitFor(() => screen.getAllByRole('button', { name: /restore/i }));

    fireEvent.click(screen.getAllByRole('button', { name: /restore/i })[0]);

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/10/versions/1/restore'),
        expect.any(Object),
        expect.any(Object)
      )
    );
  });

  it('shows version parameters details', async () => {
    axios.get.mockResolvedValueOnce({ data: { versions: mockVersions } });
    render(<ScenarioVersions scenarioId={10} />);
    await waitFor(() => expect(screen.getByText(/55,000|55000/)).toBeInTheDocument());
  });

  it('fetches from /scenarios/:id/versions with auth', async () => {
    axios.get.mockResolvedValueOnce({ data: { versions: [] } });
    render(<ScenarioVersions scenarioId={10} />);
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/10/versions'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
      )
    );
  });
});
