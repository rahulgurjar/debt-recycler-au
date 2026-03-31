import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScenarioActions from './ScenarioActions';
import axios from 'axios';

jest.mock('axios');

global.URL.createObjectURL = jest.fn(() => 'blob:fake-url');
global.URL.revokeObjectURL = jest.fn();

const mockScenario = {
  id: 42,
  name: 'My Test Plan',
  final_wealth: 1200000,
  xirr: 0.082,
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  document.body.innerHTML = '';
});

afterEach(() => {
  localStorage.clear();
});

describe('ScenarioActions', () => {
  it('renders Download PDF button', () => {
    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
  });

  it('renders Export Excel button', () => {
    render(<ScenarioActions scenario={mockScenario} userTier="professional" />);
    expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument();
  });

  it('renders Email Report button', () => {
    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    expect(screen.getByRole('button', { name: /email report/i })).toBeInTheDocument();
  });

  it('calls /scenarios/:id/report on PDF download', async () => {
    const fakeBlob = new Blob(['PDF content'], { type: 'application/pdf' });
    axios.post.mockResolvedValueOnce({ data: fakeBlob });

    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/42/report'),
        expect.any(Object),
        expect.objectContaining({ responseType: 'blob' })
      )
    );
  });

  it('calls /scenarios/:id/export on Excel download', async () => {
    const fakeBlob = new Blob(['Excel content'], { type: 'application/vnd.openxmlformats' });
    axios.post.mockResolvedValueOnce({ data: fakeBlob });

    render(<ScenarioActions scenario={mockScenario} userTier="professional" />);
    fireEvent.click(screen.getByRole('button', { name: /export excel/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/42/export'),
        expect.any(Object),
        expect.objectContaining({ responseType: 'blob' })
      )
    );
  });

  it('shows upgrade message for Excel when tier is starter', () => {
    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    expect(screen.getByText(/professional plan/i)).toBeInTheDocument();
  });

  it('shows email form when Email Report button clicked', async () => {
    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    fireEvent.click(screen.getByRole('button', { name: /email report/i }));
    await waitFor(() => expect(screen.getByLabelText(/recipient email/i)).toBeInTheDocument());
  });

  it('submits email to /scenarios/:id/email endpoint', async () => {
    axios.post.mockResolvedValueOnce({ data: { message: 'Email sent' } });

    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    fireEvent.click(screen.getByRole('button', { name: /email report/i }));

    await waitFor(() => screen.getByLabelText(/recipient email/i));
    fireEvent.change(screen.getByLabelText(/recipient email/i), {
      target: { value: 'client@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/42/email'),
        expect.objectContaining({ recipient_email: 'client@example.com' }),
        expect.any(Object)
      )
    );
  });

  it('shows success message after email sent', async () => {
    axios.post.mockResolvedValueOnce({ data: { message: 'Email sent' } });

    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    fireEvent.click(screen.getByRole('button', { name: /email report/i }));

    await waitFor(() => screen.getByLabelText(/recipient email/i));
    fireEvent.change(screen.getByLabelText(/recipient email/i), {
      target: { value: 'client@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));

    await waitFor(() => expect(screen.getByText(/email sent/i)).toBeInTheDocument());
  });

  it('shows error message when email fails', async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { error: 'Invalid email' } } });

    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    fireEvent.click(screen.getByRole('button', { name: /email report/i }));

    await waitFor(() => screen.getByLabelText(/recipient email/i));
    fireEvent.change(screen.getByLabelText(/recipient email/i), {
      target: { value: 'bad' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));

    await waitFor(() => expect(screen.getByText('Invalid email')).toBeInTheDocument());
  });

  it('renders scenario name in header', () => {
    render(<ScenarioActions scenario={mockScenario} userTier="starter" />);
    expect(screen.getByText('My Test Plan')).toBeInTheDocument();
  });
});
