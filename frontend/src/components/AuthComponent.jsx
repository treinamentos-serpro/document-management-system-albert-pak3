import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { login, registerUser } from '../services/api.js';

export default function AuthComponent({ onSignedIn, message }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const registering = mode === 'register';

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const username = fields.get('username');
    const password = fields.get('password');
    setBusy(true);
    setError('');
    setStatus('');
    try {
      if (registering) {
        await registerUser(username, password);
        setMode('login');
        setStatus('Conta criada.');
      }
      await login(username, password);
      form.reset();
      onSignedIn(username);
    } catch (error) {
      if (error.name === 'TimeoutError') {
        setError('O servidor demorou para responder. Tente novamente.');
      } else if (error instanceof TypeError) {
        setError('Nao foi possivel conectar ao servidor. Tente novamente.');
      } else {
        setError(error.message || 'Nao foi possivel entrar.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-section" aria-labelledby="auth-heading">
      <h2 id="auth-heading">{registering ? 'Criar conta' : 'Entrar'}</h2>
      <div className="auth-modes" role="group" aria-label="Acesso">
        {['login', 'register'].map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={mode === option}
            disabled={busy}
            onClick={() => {
              setMode(option);
              setError('');
              setStatus('');
            }}
          >
            {option === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>
      {message && <p className="error-message" role="alert">{message}</p>}
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <label htmlFor="username">Usuario</label>
        <input id="username" name="username" autoComplete="username" required
          minLength={3} maxLength={64} pattern="[a-zA-Z0-9_.\-]{3,64}" disabled={busy}
          aria-describedby="username-rules" />
        <p id="username-rules" className="field-hint">3 a 64 caracteres: letras, numeros, ponto, hifen ou sublinhado.</p>
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required
          autoComplete={registering ? 'new-password' : 'current-password'}
          minLength={registering ? 8 : 1} maxLength={128} disabled={busy}
          aria-describedby={registering ? 'password-rules' : undefined} />
        {registering && <p id="password-rules" className="field-hint">8 a 128 caracteres.</p>}
        <button className="primary-button" type="submit" disabled={busy}>
          {registering ? <UserPlus size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
          {busy ? 'Aguarde...' : registering ? 'Criar conta' : 'Entrar'}
        </button>
        {status && <p className="success-message" role="status">{status}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </form>
    </section>
  );
}