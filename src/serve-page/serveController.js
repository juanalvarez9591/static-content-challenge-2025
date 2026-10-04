import { serializeError } from '../shared/errors.js';
import { HttpStatus } from '../shared/http/status.js';
import { Outcome, deriveResponseOutcome, deriveRouteOutcome } from './deriveRouteOutcome.js';
import { renderSitemapHtml } from './renderSitemap.js';

export const STATUS_BY_OUTCOME = {
  [Outcome.PAGE_FOUND]: HttpStatus.OK,
  [Outcome.SITEMAP]: HttpStatus.OK,
  [Outcome.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [Outcome.INVALID_PATH]: HttpStatus.NOT_FOUND,
};

const MALFORMED_ENCODING_MARKER = '\0';
const NOT_FOUND_HTML = '<h1>Page not found</h1>';

export function makeLoadPage({ repo, renderMarkdown }) {
  return async function loadPage(urlPath, event = {}) {
    const folders = await repo.listFolders();
    const routed = deriveRouteOutcome(decodePath(urlPath), folders);
    const page = routed.type === Outcome.PAGE_FOUND ? await repo.getPageByPath(routed.folderPath) : undefined;
    const outcome = deriveResponseOutcome(routed, page);

    event.outcome = outcome.type;
    if (outcome.reason) event.rejected_by = outcome.reason;
    const status = STATUS_BY_OUTCOME[outcome.type];

    switch (outcome.type) {
      case Outcome.PAGE_FOUND:
        event.content_folder = outcome.folderPath;
        event.markdown_bytes = Buffer.byteLength(page.markdown);
        return { status, html: renderMarkdown(page.markdown), title: page.title };
      case Outcome.SITEMAP:
        return { status, html: renderSitemapHtml(folders), title: 'Sitemap' };
      case Outcome.NOT_FOUND:
      case Outcome.INVALID_PATH:
        return { status, html: NOT_FOUND_HTML };
      default:
        throw new Error(`unhandled route outcome ${outcome.type}`);
    }
  };
}

export function makeServePage({ loadPage, templates, renderPage, renderShell }) {
  return async function servePage(req, res) {
    const event = res.locals.event ?? {};
    try {
      const template = await templates.get();
      const page = await loadPage(req.path, event);
      const body = renderShell({
        html: page.html,
        initial: { path: req.path, status: page.status, html: page.html, title: page.title },
      });
      return res.status(page.status).type('html').send(renderPage(template.source, body));
    } catch (err) {
      event.err = serializeError(err);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).type('html').send('<h1>Something went wrong</h1>');
    }
  };
}

export function makeServeContentApi({ loadPage }) {
  return async function serveContentApi(req, res) {
    const event = res.locals.event ?? {};
    try {
      const page = await loadPage(typeof req.query.path === 'string' ? req.query.path : '/', event);
      return res.status(page.status).json({ html: page.html, title: page.title });
    } catch (err) {
      event.err = serializeError(err);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'internal_error' });
    }
  };
}

function decodePath(p) {
  try {
    return decodeURIComponent(p);
  } catch {
    return MALFORMED_ENCODING_MARKER;
  }
}
