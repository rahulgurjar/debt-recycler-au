import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UpgradePrompt from './UpgradePrompt';

describe('UpgradePrompt', () => {
  it('renders upgrade message', () => {
    render(<UpgradePrompt message="Monthly scenario limit reached" onUpgrade={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText('Monthly scenario limit reached')).toBeInTheDocument();
  });

  it('renders upgrade button', () => {
    render(<UpgradePrompt message="Limit reached" onUpgrade={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
  });

  it('calls onUpgrade when upgrade button clicked', () => {
    const mockUpgrade = jest.fn();
    render(<UpgradePrompt message="Limit reached" onUpgrade={mockUpgrade} onDismiss={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /upgrade/i }));
    expect(mockUpgrade).toHaveBeenCalled();
  });

  it('renders dismiss button', () => {
    render(<UpgradePrompt message="Limit reached" onUpgrade={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const mockDismiss = jest.fn();
    render(<UpgradePrompt message="Limit reached" onUpgrade={jest.fn()} onDismiss={mockDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('shows plan features teaser', () => {
    render(<UpgradePrompt message="Limit reached" onUpgrade={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText(/professional/i)).toBeInTheDocument();
  });

  it('renders required tier label when passed', () => {
    render(<UpgradePrompt message="Excel requires Professional" requiredTier="professional" onUpgrade={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText(/professional plan required/i)).toBeInTheDocument();
  });
});
