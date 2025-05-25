import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  test('renders event cards on home page', () => {
    render(<App />);
    
    // Check for event cards
    const malvikingenCard = screen.getByText(/Malvikingen Opp 2025/i);
    const kutcCard = screen.getByText(/Kruke's Ultra-Trail Challenge 2025/i);
    
    expect(malvikingenCard).toBeInTheDocument();
    expect(kutcCard).toBeInTheDocument();
  });
});
