import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { Layout } from './Layout.jsx';

function readInitialData() {
  try {
    return JSON.parse(document.getElementById('initial-data')?.textContent ?? 'null') ?? undefined;
  } catch {
    return undefined;
  }
}
const initial = readInitialData();
const DEFAULT_TITLE = document.title;

const isAppLink = (a) => {
  const href = a.getAttribute('href') ?? '';
  return href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/uploads/')
    && !a.target && !a.hasAttribute('download');
};

export function PublicPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(() => (initial?.path === pathname ? initial : undefined));

  useEffect(() => {
    if (page?.path === pathname) return undefined;
    let cancelled = false;
    api.content(pathname)
      .catch((err) => ({ html: err.status === 404 ? '<h1>Page not found</h1>' : '<h1>Could not load this page</h1>' }))
      .then((data) => { if (!cancelled) setPage({ path: pathname, ...data }); });
    return () => { cancelled = true; };
  }, [pathname, page?.path]);

  useEffect(() => {
    document.title = page?.title ? `${page.title} - Acme` : DEFAULT_TITLE;
  }, [page]);

  const onArticleClick = (event) => {
    const a = event.target.closest?.('a');
    if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (isAppLink(a)) {
      event.preventDefault();
      navigate(a.getAttribute('href'));
    }
  };

  return (
    <Layout>
      <article onClick={onArticleClick} dangerouslySetInnerHTML={{ __html: page?.html ?? '' }} />
    </Layout>
  );
}
