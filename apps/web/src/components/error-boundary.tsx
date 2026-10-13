import { Component, type ReactNode } from 'react';
import { Brand, Button } from './ui';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <Brand />
          <h1>The workspace needs a refresh.</h1>
          <p>Your saved data is safe. Reload the page to continue.</p>
          <Button onClick={() => window.location.reload()}>Reload workspace</Button>
        </main>
      );
    return this.props.children;
  }
}
