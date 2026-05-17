import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-sm font-normal text-muted">Chargement…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
