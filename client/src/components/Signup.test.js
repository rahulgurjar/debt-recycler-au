import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Signup from './Signup';
import axios from 'axios';

jest.mock('axios');

const mockOnSignupSuccess = jest.fn();
const mockOnSwitchToLogin = jest.fn();

const renderSignup = () =>
  render(
    <Signup
      onSignupSuccess={mockOnSignupSuccess}
      onSwitchToLogin={mockOnSwitchToLogin}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('Signup Component', () => {
  it('renders email, company, password, and confirm password inputs', () => {
    renderSignup();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('renders sign up submit button', () => {
    renderSignup();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('renders link to login page', () => {
    renderSignup();
    expect(screen.getByRole('button', { name: /login here/i })).toBeInTheDocument();
  });

  it('calls onSwitchToLogin when login link clicked', () => {
    renderSignup();
    fireEvent.click(screen.getByRole('button', { name: /login here/i }));
    expect(mockOnSwitchToLogin).toHaveBeenCalled();
  });

  it('updates email field on input', () => {
    renderSignup();
    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    expect(emailInput.value).toBe('new@example.com');
  });

  it('updates company name field on input', () => {
    renderSignup();
    const companyInput = screen.getByLabelText(/company name/i);
    fireEvent.change(companyInput, { target: { value: 'Acme Advisory' } });
    expect(companyInput.value).toBe('Acme Advisory');
  });

  it('shows error when password does not meet requirements', async () => {
    renderSignup();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderSignup();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Different1!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('calls onSignupSuccess after successful signup', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'fake-jwt-token',
        user: { id: 1, email: 'test@example.com', role: 'admin' },
      },
    });

    renderSignup();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => expect(mockOnSignupSuccess).toHaveBeenCalled());
  });

  it('stores token and user in localStorage on signup', async () => {
    const fakeUser = { id: 1, email: 'test@example.com', role: 'admin' };
    axios.post.mockResolvedValueOnce({
      data: { token: 'stored-token-abc', user: fakeUser },
    });

    renderSignup();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('stored-token-abc');
      expect(JSON.parse(localStorage.getItem('user'))).toEqual(fakeUser);
    });
  });

  it('shows loading state while submitting', async () => {
    axios.post.mockImplementationOnce(() => new Promise(() => {}));

    renderSignup();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });

  it('shows error message from server on signup failure', async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { error: 'Email already registered' } },
    });

    renderSignup();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'dupe@example.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => expect(screen.getByText('Email already registered')).toBeInTheDocument());
  });

  it('shows fallback error when response has no error message', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network error'));

    renderSignup();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => expect(screen.getByText(/signup failed/i)).toBeInTheDocument());
  });

  it('posts to /auth/signup with email, password, and company_name', async () => {
    axios.post.mockResolvedValueOnce({
      data: { token: 'tok', user: { id: 1, email: 'test@example.com', role: 'admin' } },
    });

    renderSignup();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme Advisory' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ValidPass1!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/signup'),
        expect.objectContaining({
          email: 'test@example.com',
          password: 'ValidPass1!',
          company_name: 'Acme Advisory',
        })
      )
    );
  });
});
