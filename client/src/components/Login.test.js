import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from './Login';
import axios from 'axios';

jest.mock('axios');

const mockOnLoginSuccess = jest.fn();
const mockOnSwitchToSignup = jest.fn();

const renderLogin = () =>
  render(
    <Login
      onLoginSuccess={mockOnLoginSuccess}
      onSwitchToSignup={mockOnSwitchToSignup}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Login Component', () => {
  it('renders email and password inputs', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('renders link to signup page', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('calls onSwitchToSignup when signup link clicked', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(mockOnSwitchToSignup).toHaveBeenCalled();
  });

  it('updates email field on input', () => {
    renderLogin();
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(emailInput.value).toBe('test@example.com');
  });

  it('updates password field on input', () => {
    renderLogin();
    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    expect(passwordInput.value).toBe('SecurePass123!');
  });

  it('calls onLoginSuccess after successful login', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'fake-jwt-token',
        user: { id: 1, email: 'test@example.com', role: 'admin' },
      },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(mockOnLoginSuccess).toHaveBeenCalled());
  });

  it('stores token in localStorage on login', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'stored-token-123',
        user: { id: 1, email: 'test@example.com', role: 'admin' },
      },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(localStorage.getItem('token')).toBe('stored-token-123'));
  });

  it('shows error message on invalid credentials', async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'WrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
  });

  it('shows loading state while submitting', async () => {
    axios.post.mockImplementationOnce(() => new Promise(() => {}));

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
  });

  it('posts to /auth/login endpoint', async () => {
    axios.post.mockResolvedValueOnce({
      data: { token: 'tok', user: { id: 1, email: 'test@example.com', role: 'admin' } },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Pass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ email: 'test@example.com', password: 'Pass123!' })
      )
    );
  });

  it('shows fallback error when response has no error message', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network error'));

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Pass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(screen.getByText(/login failed/i)).toBeInTheDocument());
  });
});
