import { useState } from 'react';
import { Upload } from 'lucide-react';
import { MAX_UPLOAD_SIZE, uploadDocument } from '../services/api.js';

export default function UploadComponent({ onUploaded, onError }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || uploading) return;
    const form = event.currentTarget;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      await uploadDocument(file);
      form.reset();
      setFile(null);
      setSuccess('Documento enviado com sucesso.');
      onUploaded();
    } catch (error) {
      setError(error.message || 'Nao foi possivel enviar o documento. Tente novamente.');
      onError?.(error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="upload-section" aria-labelledby="upload-heading">
      <h2 id="upload-heading">Novo documento</h2>
      <form onSubmit={handleSubmit} aria-busy={uploading}>
        <label htmlFor="document-file">Arquivo</label>
        <div className="upload-controls">
          <input
            id="document-file"
            type="file"
            accept="image/*,.pdf,.docx,.xlsx,.pptx,.txt"
            aria-describedby="upload-formats upload-limit"
            required
            disabled={uploading}
            onChange={(event) => {
              const selectedFile = event.target.files[0] ?? null;
              if (selectedFile && selectedFile.size > MAX_UPLOAD_SIZE) {
                setFile(null);
                setSuccess('');
                setError('O arquivo excede o limite de 10 MiB. Escolha um arquivo menor.');
                return;
              }
              setFile(selectedFile);
              setError('');
              setSuccess('');
            }}
          />
          <button className="primary-button" type="submit" disabled={!file || uploading}>
            <Upload size={18} aria-hidden="true" />
            {uploading ? 'Enviando...' : 'Enviar documento'}
          </button>
        </div>
        <div className="upload-help">
          <p id="upload-formats">
            Imagens: PNG, JPG/JPEG, GIF, WebP, SVG, BMP, TIFF, AVIF, HEIC e outros formatos de imagem.
            Documentos: PDF, DOCX, XLSX, PPTX e TXT.
          </p>
          <p id="upload-limit">Limite: 10 MiB por arquivo (10.485.760 bytes). Um arquivo por envio.</p>
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        {success && <p className="success-message" role="status">{success}</p>}
      </form>
    </section>
  );
}