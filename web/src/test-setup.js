import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/preact';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  window.location.hash = '';
});
