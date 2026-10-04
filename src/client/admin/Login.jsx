import { useState } from 'react';
import { useAuth } from './AdminArea.jsx';

const MESSAGES = {
  invalid_credentials: 'Invalid username or password.',
  too_many_attempts: 'Too many attempts. Try again later.',
  too_many_requests: 'Too many attempts. Try again later.',
};

export function Login() {
  const { login } = useAuth();
  const [error, setError] = useState();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      await login(form.get('username'), form.get('password'));
    } catch (err) {
      setError(MESSAGES[err.code] ?? 'Could not sign in. Try again.');
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Sign in</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <form onSubmit={onSubmit}>
        <label>Username<input name="username" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button type="submit" disabled={busy}>Sign in</button>
      </form>
    </>
  );
}
