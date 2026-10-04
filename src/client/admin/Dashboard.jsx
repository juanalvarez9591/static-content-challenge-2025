import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from './AdminArea.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';

export function Dashboard() {
  const { logout } = useAuth();
  const [pages, setPages] = useState();
  const [error, setError] = useState();
  const [pathToDelete, setPathToDelete] = useState();

  const load = useCallback(() => {
    api.listPages().then(setPages, () => setError('Could not load pages.'));
  }, []);
  useEffect(load, [load]);

  async function confirmDelete() {
    const path = pathToDelete;
    setPathToDelete(undefined);
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
              <button type="button" className="link" onClick={() => setPathToDelete(p)}>delete</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="secondary" onClick={logout}>Sign out</button>
      {pathToDelete && (
        <ConfirmDialog
          title={`Delete /${pathToDelete}?`}
          message="The page disappears from the site. This can't be undone."
          confirmLabel="Delete page"
          onConfirm={confirmDelete}
          onCancel={() => setPathToDelete(undefined)}
        />
      )}
    </>
  );
}
