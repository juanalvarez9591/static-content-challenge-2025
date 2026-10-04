export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error ?? `HTTP ${status}`);
    this.status = status;
    this.code = data?.error;
  }
}

let csrf = null;
export const setCsrf = (token) => { csrf = token; };

export async function request(method, url, { json, body, headers } = {}) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(csrf && method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  async login(username, password) {
    const { csrf: loginToken } = await request('GET', '/api/admin/login-token');
    const data = await request('POST', '/api/admin/login', { json: { username, password, _csrf: loginToken } });
    setCsrf(data.csrf);
  },
  async me() {
    const data = await request('GET', '/api/admin/me');
    setCsrf(data.csrf);
  },
  async logout() {
    await request('POST', '/api/admin/logout');
    setCsrf(null);
  },
  listPages: () => request('GET', '/api/admin/pages').then((d) => d.pages),
  getPage: (path) => request('GET', `/api/admin/pages/content?path=${encodeURIComponent(path)}`),
  createPage: (path, markdown) => request('POST', '/api/admin/pages', { json: { path, markdown } }),
  savePage: (path, markdown) => request('PUT', '/api/admin/pages', { json: { path, markdown } }),
  deletePage: (path) => request('DELETE', `/api/admin/pages?path=${encodeURIComponent(path)}`),
  uploadImage: (file) =>
    request('POST', '/api/admin/images', { body: file, headers: { 'Content-Type': file.type } }).then((d) => d.url),
  content: (path) => request('GET', `/api/content?path=${encodeURIComponent(path)}`),
};
