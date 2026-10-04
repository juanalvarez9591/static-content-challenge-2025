export function renderPage(template, contentHtml) {
  return template.replace('{{content}}', () => contentHtml);
}
