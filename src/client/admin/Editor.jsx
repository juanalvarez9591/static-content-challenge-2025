import { marked } from 'marked';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { imageMarkdown, insertAt, replaceOnce } from '../lib/text.js';

const ERRORS = {
  invalid_path: 'Invalid path: use lowercase letters, digits, - and _.',
  exists: 'A page already exists at that path.',
  not_found: 'That page no longer exists.',
};

export function Editor({ mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editPath = params.get('path') ?? '';
  const textarea = useRef(null);
  const uploadCount = useRef(0);

  const [path, setPath] = useState(mode === 'edit' ? editPath : '');
  const [markdown, setMarkdown] = useState('');
  const [loaded, setLoaded] = useState(mode === 'new');
  const [error, setError] = useState();
  const [uploading, setUploading] = useState(0);

  useEffect(() => {
    if (mode !== 'edit') return;
    api.getPage(editPath).then((d) => { setMarkdown(d.markdown); setLoaded(true); }, () => setError(ERRORS.not_found));
  }, [mode, editPath]);

  const preview = useMemo(() => marked.parse(markdown), [markdown]);

  async function addImage(file) {
    const placeholder = `![Uploading image ${++uploadCount.current}…]()`;
    const el = textarea.current;
    const { selectionStart, selectionEnd } = el ?? {};
    setMarkdown((current) => insertAt(current, selectionStart ?? current.length, selectionEnd ?? current.length, placeholder).text);
    setUploading((n) => n + 1);
    try {
      const url = await api.uploadImage(file);
      setMarkdown((current) => replaceOnce(current, placeholder, imageMarkdown(url)));
    } catch (err) {
      setMarkdown((current) => replaceOnce(current, placeholder, ''));
      setError(err.status === 415 || err.status === 413
        ? 'That image is not supported (PNG, JPEG, GIF or WebP, up to 5 MB).' : 'Could not upload the image.');
    } finally {
      setUploading((n) => n - 1);
    }
  }

  const imagesIn = (files) => [...files].filter((f) => f.type.startsWith('image/'));

  function onPaste(event) {
    const images = imagesIn(event.clipboardData?.files ?? []);
    if (images.length === 0) return;
    event.preventDefault();
    images.forEach(addImage);
  }
  function onDrop(event) {
    const images = imagesIn(event.dataTransfer?.files ?? []);
    if (images.length === 0) return;
    event.preventDefault();
    images.forEach(addImage);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError(undefined);
    try {
      if (mode === 'new') await api.createPage(path, markdown);
      else await api.savePage(path, markdown);
      navigate('/admin');
    } catch (err) {
      setError(ERRORS[err.code] ?? 'Could not save the page.');
    }
  }

  return (
    <>
      <h1>{mode === 'new' ? 'New page' : 'Edit page'}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {loaded && (
        <form onSubmit={onSubmit}>
          {mode === 'new'
            ? <label>Path (e.g. blog/july/news)<input name="path" value={path} onChange={(e) => setPath(e.target.value)} required /></label>
            : <p>/{path}</p>}
          <div className="editor">
            <label>
              Markdown <small>(paste or drop images)</small>
              <textarea
                ref={textarea} name="markdown" rows={16} value={markdown}
                onChange={(e) => setMarkdown(e.target.value)} onPaste={onPaste} onDrop={onDrop}
              />
            </label>
            <div>
              <strong>Preview</strong>
              <div className="preview" dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          </div>
          <button type="submit" disabled={uploading > 0}>{uploading > 0 ? 'Uploading…' : 'Save'}</button>{' '}
          <Link to="/admin">Cancel</Link>
        </form>
      )}
    </>
  );
}
