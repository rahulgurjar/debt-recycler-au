import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScenarioForm from './ScenarioForm';
import axios from 'axios';

jest.mock('axios');

const mockClients = [
  { id: 1, name: 'John Smith', email: 'john@example.com' },
  { id: 2, name: 'Jane Doe', email: 'jane@example.com' },
];

const mockScenarioResult = {
  scenario: {
    id: 10,
    name: 'Test Scenario',
    client_id: 1,
    final_wealth: 1200000,
    xirr: 0.082,
    initial_outlay: 55000,
  },
  projection: [
    { year: 1, wealth: 60000, pf_value: 105000, loan: 45000 },
    { year: 2, wealth: 72000, pf_value: 115000, loan: 43000 },
  ],
};

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
});

describe('ScenarioForm', () => {
  it('shows loading while fetching clients', () => {
    axios.get.mockImplementationOnce(() => new Promise(() => {}));
    render(<ScenarioForm />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders client dropdown after loading', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ScenarioForm />);
    await waitFor(() => expect(screen.getByLabelText(/client/i)).toBeInTheDocument());
  });

  it('populates client dropdown with client names', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ScenarioForm />);
    await waitFor(() => expect(screen.getByText('John Smith')).toBeInTheDocument());
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('renders scenario name field', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ScenarioForm />);
    await waitFor(() => expect(screen.getByLabelText(/scenario name/i)).toBeInTheDocument());
  });

  it('renders initial outlay field', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ScenarioForm />);
    await waitFor(() => expect(screen.getByLabelText(/initial outlay/i)).toBeInTheDocument());
  });

  it('renders gearing ratio field', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ScenarioForm />);
    await waitFor(() => expect(screen.getByLabelText(/gearing ratio/i)).toBeInTheDocument());
  });

  it('renders annual investment field', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ScenarioForm />);
    await waitFor(() => expect(screen.getByLabelText(/annual investment/i)).toBeInTheDocument());
  });

  it('submits scenario with client_id and name', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    axios.post.mockResolvedValueOnce({ data: mockScenarioResult });

    render(<ScenarioForm />);
    await waitFor(() => screen.getByLabelText(/client/i));

    fireEvent.change(screen.getByLabelText(/client/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: 'My Plan' } });
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios'),
        expect.objectContaining({ client_id: 1, name: 'My Plan' }),
        expect.any(Object)
      )
    );
  });

  it('shows projection results after successful submission', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    axios.post.mockResolvedValueOnce({ data: mockScenarioResult });

    render(<ScenarioForm />);
    await waitFor(() => screen.getByLabelText(/client/i));

    fireEvent.change(screen.getByLabelText(/client/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: 'My Plan' } });
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }));

    await waitFor(() => expect(screen.getByText(/final wealth/i)).toBeInTheDocument());
  });

  it('shows error when no client selected on submit', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ScenarioForm />);
    await waitFor(() => screen.getByRole('button', { name: /run scenario/i }));
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }));
    expect(screen.getByText(/please select a client/i)).toBeInTheDocument();
  });

  it('shows error from API on failure', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    axios.post.mockRejectedValueOnce({ response: { data: { error: 'Scenario limit reached' } } });

    render(<ScenarioForm />);
    await waitFor(() => screen.getByLabelText(/client/i));

    fireEvent.change(screen.getByLabelText(/client/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: 'Limit Test' } });
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }));

    await waitFor(() => expect(screen.getByText('Scenario limit reached')).toBeInTheDocument());
  });
});
