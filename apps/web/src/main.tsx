import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from './lib/session';
import { ErrorBoundary } from './components/error-boundary';
import { App } from './app';
import './styles.css';

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <SessionProvider>
            <App />
          </SessionProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
