import { FileText } from 'lucide-react';
import DownloadButton from './DownloadButton.jsx';

function formatSize(size) {
  if (!Number.isFinite(size) || size < 0) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
}

export default function DocumentList({ documents, loading, error, onError }) {
  if (loading) return <p className="list-state" role="status">Carregando documentos...</p>;
  if (error) return <p className="error-message list-state" role="alert">{error}</p>;
  if (!documents.length) return <p className="list-state">Nenhum documento enviado.</p>;

  return (
    <ul className="document-list" aria-label="Documentos">
      {documents.map((document) => {
        const filename = document.originalName || document.name || 'Documento';
        return (
          <li className="document-row" key={document.id}>
            <FileText className="document-icon" size={24} aria-hidden="true" />
            <div className="document-details">
              <span className="document-name">{filename}</span>
              <span className="document-metadata">
                {formatSize(document.size)} | {formatDate(document.uploadedAt)}
                {document.owner && ` | ${document.owner}`}
              </span>
            </div>
            <DownloadButton documentId={document.id} filename={filename} onError={onError} />
          </li>
        );
      })}
    </ul>
  );
}