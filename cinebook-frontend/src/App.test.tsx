import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';

describe('App smoke test', () => {
  it('renders App component within AuthProvider without crashing', () => {
    const { container } = render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
    expect(container).toBeDefined();
  });
});
