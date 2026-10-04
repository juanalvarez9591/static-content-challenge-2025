const NAV = '<nav><a class="brand" href="/"><img src="/wheel.svg" alt="" width="40" height="40">Acme</a>'
  + '<a href="/sitemap">Sitemap</a><a href="/admin/login">Admin</a></nav>';

export const escapeJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export function renderShell({ html, initial }) {
  return `<div id="root"><main class="page">${NAV}<article>${html}</article></main></div>`
    + `<script type="application/json" id="initial-data">${escapeJson(initial)}</script>`;
}

export const renderAdminShell = () => '<div id="root"></div>';
