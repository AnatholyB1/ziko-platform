import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Suspense fallback={<div className="text-sm text-muted">Chargement…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
