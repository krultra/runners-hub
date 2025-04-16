import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders registration call-to-action', () => {
  render(<App />);
  const registerButton = screen.getByRole('link', { name: /register now/i });
  expect(registerButton).toBeInTheDocument();
});
