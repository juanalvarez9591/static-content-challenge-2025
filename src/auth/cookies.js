export const SESSION_COOKIE = 'sid';
export const LOGIN_CSRF_COOKIE = 'login_csrf';
export const COOKIE_PATH = '/api/admin';

export const cookieOptions = (config) => ({
  httpOnly: true, secure: config.secureCookies, sameSite: 'strict', path: COOKIE_PATH,
});
