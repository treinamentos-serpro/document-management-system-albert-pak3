import { useEffect, useState } from 'react';
import { Files, LogOut, RefreshCw } from 'lucide-react';
import AuthComponent from './components/AuthComponent.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';
import { listDocuments, logout } from './services/api.js';
import './App.css';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [username, setUsername] = useState(null);
  const [sessionMessage, setSessionMessage] = useState('');

  function handleLogout() {
    logout();
    setUsername(null);
    setDocuments([]);
    setError('');
    setSessionMessage('');
  }

  function handleRequestError(error) {
    if (error.status === 401) {
      handleLogout();
      setSessionMessage('Sua sessao expirou. Entre novamente.');
    }
  }

  function refreshDocuments() {
    setRevision((current) => current + 1);
  }

  useEffect(() => {
    if (!username) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listDocuments({ signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setDocuments(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error.status === 401) {
            logout();
            setUsername(null);
            setDocuments([]);
            setSessionMessage('Sua sessao expirou. Entre novamente.');
          } else {
            setError(error.message || 'Nao foi possivel carregar os documentos. Tente atualizar a lista.');
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, username]);

  return (
    <main className="workspace">
      <header className="page-header">
        <Files size={32} aria-hidden="true" />
        <h1>Gestao de documentos</h1>
        {username && (
          <div className="account-controls">
            <span className="account-name">{username}</span>
            <button type="button" className="icon-button" onClick={handleLogout} title="Sair" aria-label="Sair">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </header>
      {!username ? (
        <AuthComponent message={sessionMessage} onSignedIn={(name) => {
          setSessionMessage('');
          setLoading(true);
          setUsername(name);
        }} />
      ) : (
        <>
          <UploadComponent onUploaded={refreshDocuments} onError={handleRequestError} />
          <section className="documents-section" aria-labelledby="documents-heading" aria-busy={loading}>
            <div className="section-heading">
              <h2 id="documents-heading">Documentos</h2>
              <button
                className="icon-button"
                type="button"
                onClick={refreshDocuments}
                disabled={loading}
                title="Atualizar lista"
                aria-label="Atualizar lista"
              >
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            </div>
            <DocumentList documents={documents} loading={loading} error={error} onError={handleRequestError} />
          </section>
        </>
      )}
    </main>
  );
}
