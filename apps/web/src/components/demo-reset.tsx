import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import type { Session } from '@rafnexa/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/session-context';
import { Confirm } from './confirm';

export function DemoReset() {
  const [confirming, setConfirming] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => setConfirming(true)}>
        Reset demo <RotateCcw size={13} aria-hidden="true" />
      </button>
      {confirming ? (
        <Confirm
          title="Start with a fresh workspace?"
          description="Your changes in this browser will be replaced with the original sample projects, clients and tasks."
          actionLabel="Reset demo"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const session = await api<Session>('/demo/reset', { method: 'POST' });
            auth.establish(session);
            navigate('/overview', { replace: true });
          }}
        />
      ) : null}
    </>
  );
}
