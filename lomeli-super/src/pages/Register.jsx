import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import API_BASE_URL from "../config";

const Register = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", display_name: "" });
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/invitations/${code}/validate`)
      .then(r => r.json())
      .then(data => {
        setValid(data.valid);
        if (!data.valid) {
          const reasons = { not_found: "Invitación no encontrada", already_used: "Esta invitación ya fue utilizada", expired: "Esta invitación ha expirado", deactivated: "Esta invitación fue desactivada" };
          setError(reasons[data.reason] || "Invitación inválida");
        }
      })
      .catch(() => setError("Error al validar la invitación"))
      .finally(() => setValidating(false));
  }, [code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email: form.email, password: form.password, display_name: form.display_name }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("local_token", data.token);
        localStorage.setItem("local_user", JSON.stringify({ uid: data.uid, email: data.email, display_name: data.display_name }));
        navigate("/order");
        window.location.reload();
      } else {
        const errText = await res.text();
        setError(errText || "Error al registrarse");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/auth/register-google`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        navigate("/order");
      } else {
        const errText = await res.text();
        setError(errText || "Error al registrarse con Google");
        await auth.signOut();
      }
    } catch (err) {
      console.error("Google register error:", err);
      setError("Error al registrarse con Google");
      try { await auth.signOut(); } catch (_) {}
    } finally {
      setGoogleLoading(false);
    }
  };

  if (validating) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" }}>
      <p style={{ color: "#6b7280" }}>Validando invitación...</p>
    </div>
  );

  if (!valid) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" }}>
      <div style={{ background: "#fff", borderRadius: "20px", padding: "48px 40px", boxShadow: "0 8px 32px rgba(0,0,0,0.10)", maxWidth: "380px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>❌</div>
        <h2 style={{ margin: "0 0 12px", color: "#ef4444", fontWeight: 800 }}>Invitación Inválida</h2>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>{error}</p>
        <button onClick={() => navigate("/login")} style={{ marginTop: "20px", padding: "10px 24px", background: "#15803d", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
          Ir al Login
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" }}>
      <div style={{ background: "#fff", borderRadius: "20px", padding: "48px 40px", boxShadow: "0 8px 32px rgba(0,0,0,0.10)", maxWidth: "400px", width: "100%" }}>
        <div style={{ display: "flex", gap: "8px", fontSize: "40px", justifyContent: "center" }}>🥦🥕🍓</div>
        <h1 style={{ margin: "12px 0 4px", fontSize: "28px", fontWeight: 800, color: "#15803d", textAlign: "center" }}>Lomeli Super</h1>
        <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: "14px", textAlign: "center" }}>Crea tu cuenta con invitación</p>

        {error && <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "8px", background: "#fef2f2", color: "#dc2626", fontSize: "13px" }}>⚠️ {error}</div>}

        <button onClick={handleGoogleRegister} disabled={googleLoading} style={{
          display: "flex", alignItems: "center", gap: "12px", padding: "12px 24px",
          background: googleLoading ? "#f3f4f6" : "#fff", border: "1.5px solid #e5e7eb",
          borderRadius: "10px", cursor: googleLoading ? "not-allowed" : "pointer",
          fontSize: "15px", fontWeight: 600, color: "#374151", width: "100%",
          justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "8px",
        }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          {googleLoading ? "Registrando..." : "Registrarse con Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
          <hr style={{ flex: 1, border: "none", borderTop: "1px solid #e5e7eb" }} />
          <span style={{ color: "#9ca3af", fontSize: "13px" }}>o con email</span>
          <hr style={{ flex: 1, border: "none", borderTop: "1px solid #e5e7eb" }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input type="text" placeholder="Nombre (opcional)" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
            style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "15px" }} />
          <input type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "15px" }} />
          <input type="password" placeholder="Contraseña" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "15px" }} />
          <input type="password" placeholder="Confirmar contraseña" required value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
            style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "15px" }} />
          <button type="submit" disabled={loading} style={{
            padding: "14px", background: loading ? "#86efac" : "#15803d", color: "#fff",
            border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer"
          }}>
            {loading ? "Registrando..." : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;