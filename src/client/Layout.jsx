import { Link } from 'react-router-dom';

export function Layout({ children }) {
  return (
    <main className="page">
      <nav>
        <Link to="/">Acme</Link> <Link to="/sitemap">Sitemap</Link> <Link to="/admin/login">Admin</Link>
      </nav>
      {children}
    </main>
  );
}
