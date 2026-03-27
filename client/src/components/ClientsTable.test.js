import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClientsTable from './ClientsTable';
import axios from 'axios';

jest.mock('axios');

const mockClients = [
  { id: 1, name: 'John Smith', email: 'john@example.com', risk_profile: 'moderate', dob: '1980-01-01', annual_income: 120000, created_at: '2026-01-01' },
  { id: 2, name: 'Jane Doe', email: 'jane@example.com', risk_profile: 'aggressive', dob: '1990-06-15', annual_income: 95000, created_at: '2026-01-02' },
];

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
});

describe('ClientsTable', () => {
  it('shows loading state initially', () => {
    axios.get.mockImplementationOnce(() => new Promise(() => {}));
    render(<ClientsTable />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders clients table with data', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ClientsTable />);
    await waitFor(() => expect(screen.getByText('John Smith')).toBeInTheDocument());
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows empty state when no clients', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: [], total: 0 } });
    render(<ClientsTable />);
    await waitFor(() => expect(screen.getByText(/no clients/i)).toBeInTheDocument());
  });

  it('shows client email in table', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ClientsTable />);
    await waitFor(() => expect(screen.getByText('john@example.com')).toBeInTheDocument());
  });

  it('shows risk profile for each client', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    render(<ClientsTable />);
    await waitFor(() => expect(screen.getByText('moderate')).toBeInTheDocument());
    expect(screen.getByText('aggressive')).toBeInTheDocument();
  });

  it('shows add client button', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: [], total: 0 } });
    render(<ClientsTable />);
    await waitFor(() => expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument());
  });

  it('shows add client form when button clicked', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: [], total: 0 } });
    render(<ClientsTable />);
    await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /add client/i })));
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('creates a new client on form submit', async () => {
    const newClient = { id: 3, name: 'New Client', email: 'new@example.com', risk_profile: 'conservative', dob: '1985-03-20', annual_income: 80000 };
    axios.get.mockResolvedValueOnce({ data: { clients: [], total: 0 } });
    axios.post.mockResolvedValueOnce({ data: { client: newClient } });
    axios.get.mockResolvedValueOnce({ data: { clients: [newClient], total: 1 } });

    render(<ClientsTable />);
    await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /add client/i })));

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New Client' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1985-03-20' } });
    fireEvent.change(screen.getByLabelText(/annual income/i), { target: { value: '80000' } });
    fireEvent.change(screen.getByLabelText(/risk profile/i), { target: { value: 'conservative' } });
    fireEvent.click(screen.getByRole('button', { name: /save client/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/clients'),
        expect.objectContaining({ name: 'New Client', email: 'new@example.com' }),
        expect.any(Object)
      )
    );
  });

  it('deletes a client when delete button clicked', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: mockClients, total: 2 } });
    axios.delete.mockResolvedValueOnce({ data: { message: 'Client deleted' } });
    axios.get.mockResolvedValueOnce({ data: { clients: [mockClients[1]], total: 1 } });

    render(<ClientsTable />);
    await waitFor(() => screen.getByText('John Smith'));

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() =>
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/clients/1'),
        expect.any(Object)
      )
    );
  });

  it('shows error when fetch fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    render(<ClientsTable />);
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
  });

  it('fetches clients from /clients endpoint with auth header', async () => {
    axios.get.mockResolvedValueOnce({ data: { clients: [], total: 0 } });
    render(<ClientsTable />);
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/clients'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
      )
    );
  });
});
