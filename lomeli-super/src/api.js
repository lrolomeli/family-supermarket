import { auth } from "./firebase";

let cachedToken = null;
let tokenExpiry = null;

// Refresca el token solo si está por expirar (margen de 5 minutos)
const getToken = async () => {
  const now = Date.now();
  if (cachedToken && tokenExpiry && now < tokenExpiry - 5 * 60 * 1000) {
    return cachedToken;
  }
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  cachedToken = await user.getIdToken(true);
  tokenExpiry = now + 60 * 60 * 1000; // tokens de Firebase duran 1 hora
  return cachedToken;
};

// Llama esto al hacer login para pre-cargar el token
export const primeToken = async () => {
  cachedToken = null;
  await getToken();
};

const apiFetch = async (url, options = {}) => {
  const token = await getToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
};

export default apiFetch;
