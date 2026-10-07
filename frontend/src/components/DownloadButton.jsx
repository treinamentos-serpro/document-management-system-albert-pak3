import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadDocument } from '../services/api.js';

export default function DownloadButton({ documentId, filename, onError }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setError('');
    try {
      const blob = await downloadDocument(documentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      setError(error.message || 'Nao foi possivel baixar o documento. Tente novamente.');
      onError?.(error);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="download-action">
      <button
        type="button"
        className="icon-button"
        onClick={handleDownload}
        disabled={downloading}
        aria-label={downloading ? `Baixando ${filename}` : `Baixar ${filename}`}
        title={downloading ? 'Baixando...' : `Baixar ${filename}`}
      >
        <Download size={19} aria-hidden="true" />
      </button>
      {error && <p className="error-message" role="alert">{error}</p>}
    </div>
  );
}