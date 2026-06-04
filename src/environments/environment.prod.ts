export const environment = {
  production: true,
  apiUrl:
    (globalThis as { __AFNOGHAR_API_URL__?: string }).__AFNOGHAR_API_URL__ ||
    'https://afnoghar.onrender.com',
};
