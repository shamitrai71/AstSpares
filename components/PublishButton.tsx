'use client';

import { useState } from 'react';
import { publishCatalog } from '@/lib/publish';

type State = 'idle' | 'publishing' | 'done' | 'error';

export function PublishButton() {
  const [state, setState] = useState<State>('idle');
  const [err, setErr] = useState('');

  const run = async () => {
    if (state === 'publishing') return;
    setState('publishing');
    setErr('');
    try {
      await publishCatalog();
      setState('done');
      setTimeout(() => setState('idle'), 8000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the build.');
      setState('error');
    }
  };

  if (state === 'done') {
    return <span className="text-sm text-safety-600">✓ Build started — live in ~2–3 min</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {state === 'error' && <span className="max-w-[16rem] truncate text-xs text-safety-600" title={err}>{err}</span>}
      <button
        onClick={run}
        disabled={state === 'publishing'}
        title="Rebuild and redeploy the public catalog with the latest content"
        className="btn-primary px-3 py-1.5"
      >
        {state === 'publishing' ? 'Starting build…' : 'Publish changes'}
      </button>
    </div>
  );
}
