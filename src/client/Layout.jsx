import { Link } from 'react-router-dom';

export function Layout({ children }) {
  return (
    <main className="page">
      <nav>
        <Link className="brand" to="/"><img src="/wheel.svg" alt="" width="40" height="40" />Acme</Link>
        <Link to="/sitemap">Sitemap</Link>
        <Link to="/admin/login">Admin</Link>
      </nav>
      {children}
    </main>
  );
}
