import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from './AdminArea.jsx';

export function Dashboard() {
  const { logout } = useAuth();
  const [pages, setPages] = useState();
  const [error, setError] = useState();

  const load = useCallback(() => {
    api.listPages().then(setPages, () => setError('Could not load pages.'));
  }, []);
  useEffect(load, [load]);

  async function remove(path) {
    if (!window.confirm(`Delete /${path}?`)) return;
    try {
      await api.deletePage(path);
      load();
    } catch {
      setError('Could not delete the page.');
    }
  }

  return (
    <>
      <h1>Pages</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <p><Link className="button" to="/admin/pages/new">New page</Link></p>
      {pages && (
        <ul className="pages">
          {pages.map((p) => (
            <li key={p}>
              <a className="page-path" href={`/${p}`}>/{p}</a>
              <Link to={`/admin/pages/edit?path=${encodeURIComponent(p)}`}>edit</Link>
              <button type="button" className="link" onClick={() => remove(p)}>delete</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="secondary" onClick={logout}>Sign out</button>
    </>
  );
}
