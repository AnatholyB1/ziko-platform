// PHASE 23 SMOKE — DELETE IN PHASE 24
'use client';

import { useState } from 'react';
import { smokeReCheck } from './action';

type Result =
  | { ok: true; userId: string; ts: string }
  | { ok: false; error: string }
  | null;

export function SmokeButton() {
  const [result, setResult] = useState<Result>(null);
  const [pending, setPending] = useState(false);

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const r = await smokeReCheck();
            setResult(r);
          } finally {
            setPending(false);
          }
        }}
        style={{
          padding: '8px 16px',
          background: '#FF5C1A',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 6,
          cursor: pending ? 'not-allowed' : 'pointer',
        }}
      >
        {pending ? 'Re-checking\u2026' : 'Re-check session'}
      </button>
      {result && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: '#F7F6F3',
            border: '1px solid #E2E0DA',
            borderRadius: 6,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
