const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hrefFor = (folderPath) => `/${folderPath.split('/').map(encodeURIComponent).join('/')}`;

export function buildTree(folders) {
  const root = { children: new Map() };
  for (const folder of folders.filter((f) => f !== '')) {
    let node = root;
    const parts = [];
    for (const name of folder.split('/')) {
      parts.push(name);
      if (!node.children.has(name)) node.children.set(name, { name, path: parts.join('/'), hasPage: false, children: new Map() });
      node = node.children.get(name);
    }
    node.hasPage = true;
  }
  return root;
}

function renderList(node) {
  const items = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name)).map((child) => {
    const label = child.hasPage
      ? `<a href="${escapeHtml(hrefFor(child.path))}">${escapeHtml(child.name)}</a>`
      : `<span>${escapeHtml(child.name)}</span>`;
    return `<li>${label}${child.children.size > 0 ? renderList(child) : ''}</li>`;
  });
  return `<ul>${items.join('')}</ul>`;
}

export function renderSitemapHtml(folders) {
  const home = folders.includes('') ? '<p><a href="/">Home</a></p>' : '';
  const tree = buildTree(folders);
  return `<h1>Sitemap</h1>${home}${tree.children.size > 0 ? renderList(tree) : '<p>No pages yet.</p>'}`;
}
