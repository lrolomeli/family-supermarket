import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useNavigate } from "react-router-dom";
import { primeToken } from "../api";
import API_BASE_URL from "../config";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showLocal, setShowLocal] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      await primeToken();
      const res = await fetch(`${API_BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.reason === "not_registered") {
          await auth.signOut();
          setError("No tienes cuenta. Necesitas un link de invitación para registrarte.");
          setLoading(false);
          return;
        }
      }
      navigate("/order");
    } catch (err) {
      console.error("Google Sign-In error:", err);
      setLoading(false);
    }
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("local_token", data.token);
        localStorage.setItem("local_user", JSON.stringify({
          uid: data.uid, email: data.email, display_name: data.display_name,
          is_approved: data.is_approved, is_admin: data.is_admin,
        }));
        navigate("/order");
        window.location.reload();
      } else {
        const errText = await res.text();
        setError(errText || "Credenciales incorrectas");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (res.ok) {
        setForgotSent(true);
      } else {
        setError("Error al enviar el correo");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      padding: "20px",
    }}>
      <div style={{
        background: "#fff", borderRadius: "20px",
        padding: "40px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
        maxWidth: "360px", width: "100%", boxSizing: "border-box",
      }}>
        <img src="/images/logo.svg" alt="Ay! Te Encargo" style={{ width: "120px", height: "120px" }} />
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", textAlign: "center" }}>
          Haz tu pedido de despensa fácil y rápido
        </p>

        <hr style={{ width: "100%", border: "none", borderTop: "1px solid #f3f4f6", margin: "4px 0" }} />

        {error && (
          <div style={{
            width: "100%", padding: "10px 14px", borderRadius: "12px",
            background: "#fef2f2", color: "#dc2626", fontSize: "13px",
            boxSizing: "border-box",
          }}>
            ⚠️ {error}
          </div>
        )}

        {!showLocal ? (
          <>
            <button onClick={handleGoogleSignIn} disabled={loading} style={{
              display: "flex", alignItems: "center", gap: "12px", padding: "14px 20px",
              background: loading ? "#f3f4f6" : "#fff", border: "1.5px solid #e5e7eb",
              borderRadius: "12px", cursor: loading ? "not-allowed" : "pointer",
              fontSize: "15px", fontWeight: 600, color: "#374151", width: "100%",
              justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              WebkitTapHighlightColor: "transparent", boxSizing: "border-box",
            }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              {loading ? "Entrando..." : "Continuar con Google"}
            </button>

            <button onClick={() => setShowLocal(true)} style={{
              padding: "14px 20px", background: "#f9fafb", border: "1.5px solid #e5e7eb",
              borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: 600,
              color: "#374151", width: "100%", textAlign: "center",
              WebkitTapHighlightColor: "transparent", boxSizing: "border-box",
            }}>
              Entrar con email y contraseña
            </button>
          </>
        ) : showForgot ? (
          forgotSent ? (
            <div style={{ textAlign: "center", width: "100%" }}>
              <div style={{
                padding: "10px 14px", borderRadius: "12px",
                background: "#f0fdf4", color: "#15803d", fontSize: "13px", marginBottom: "16px",
              }}>
                ✅ Si el email existe, recibirás un enlace para restablecer tu contraseña.
              </div>
              <button onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); setError(""); }} style={{
                padding: "10px", background: "none", border: "none", color: "#6b7280",
                cursor: "pointer", fontSize: "14px", WebkitTapHighlightColor: "transparent",
              }}>
                ← Volver al login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", textAlign: "center" }}>
                Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <input type="email" placeholder="Email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                style={{
                  padding: "14px", borderRadius: "12px", border: "1.5px solid #e5e7eb",
                  fontSize: "16px", width: "100%", boxSizing: "border-box",
                  WebkitAppearance: "none", background: "#f9fafb",
                }}
                onFocus={e => e.target.style.borderColor = "#15803d"}
                onBlur={e => e.target.style.borderColor = "#e5e7eb"}
              />
              <button type="submit" disabled={loading} style={{
                padding: "14px", background: loading ? "#86efac" : "#15803d", color: "#fff",
                border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", WebkitTapHighlightColor: "transparent",
              }}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>
              <button type="button" onClick={() => { setShowForgot(false); setError(""); }} style={{
                padding: "10px", background: "none", border: "none", color: "#6b7280",
                cursor: "pointer", fontSize: "14px", WebkitTapHighlightColor: "transparent",
              }}>
                ← Volver
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleLocalLogin} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
            <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{
                padding: "14px", borderRadius: "12px", border: "1.5px solid #e5e7eb",
                fontSize: "16px", width: "100%", boxSizing: "border-box",
                WebkitAppearance: "none", background: "#f9fafb",
              }}
              onFocus={e => e.target.style.borderColor = "#15803d"}
              onBlur={e => e.target.style.borderColor = "#e5e7eb"}
            />
            <input type="password" placeholder="Contraseña" required value={password} onChange={e => setPassword(e.target.value)}
              style={{
                padding: "14px", borderRadius: "12px", border: "1.5px solid #e5e7eb",
                fontSize: "16px", width: "100%", boxSizing: "border-box",
                WebkitAppearance: "none", background: "#f9fafb",
              }}
              onFocus={e => e.target.style.borderColor = "#15803d"}
              onBlur={e => e.target.style.borderColor = "#e5e7eb"}
            />
            <button type="submit" disabled={loading} style={{
              padding: "14px", background: loading ? "#86efac" : "#15803d", color: "#fff",
              border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              WebkitTapHighlightColor: "transparent",
            }}>
              {loading ? "Entrando..." : "Iniciar sesión"}
            </button>
            <button type="button" onClick={() => { setShowForgot(true); setError(""); }} style={{
              padding: "4px", background: "none", border: "none", color: "#15803d",
              cursor: "pointer", fontSize: "13px", WebkitTapHighlightColor: "transparent",
            }}>
              ¿Olvidaste tu contraseña?
            </button>
            <button type="button" onClick={() => { setShowLocal(false); setError(""); }} style={{
              padding: "10px", background: "none", border: "none", color: "#6b7280",
              cursor: "pointer", fontSize: "14px",
              WebkitTapHighlightColor: "transparent",
            }}>
              ← Volver
            </button>
          </form>
        )}

        <p style={{ margin: 0, color: "#9ca3af", fontSize: "12px", textAlign: "center" }}>
          Solo usuarios autorizados pueden acceder
        </p>
      </div>
    </div>
  );
};

export default Login;
