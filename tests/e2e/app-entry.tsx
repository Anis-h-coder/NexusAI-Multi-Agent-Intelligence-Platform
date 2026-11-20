// TEST-ONLY entry: identical to src/main.tsx (minus the CSS import) plus a handle on the real apiClient module instance.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App.tsx';
import { safeFetchJson } from '../../src/utils/apiClient';

(window as unknown as { __api: unknown }).__api = { safeFetchJson };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
