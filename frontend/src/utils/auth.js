/**
 * Auth helpers for JWT-based API calls.
 * Use getAuthHeaders() in fetch() for all billing-reports API requests.
 */

const TOKEN_KEY = 'token';
const USER_NAME_KEY = 'userName';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getUserId = () => localStorage.getItem('userId');
export const getUserName = () => localStorage.getItem(USER_NAME_KEY) || '';

export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('userRoles');
  localStorage.removeItem(USER_NAME_KEY);
};

/** API base URL for billing-reports backend. */
export const getApiBaseUrl = () =>
  process.env.REACT_APP_API_URL || 'http://10.10.6.254/billing-reports';

/**
 * Returns headers object with Authorization: Bearer <token> for API requests.
 * Use: fetch(url, { ...options, headers: { ...options?.headers, ...getAuthHeaders() } })
 */
export const getAuthHeaders = () => {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

/**
 * Fetch with auth header. On 401, clears auth and returns null (caller can redirect to login).
 */
export const fetchWithAuth = async (url, options = {}) => {
  const headers = { ...options.headers, ...getAuthHeaders() };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearAuth();
    return null;
  }
  return res;
};
