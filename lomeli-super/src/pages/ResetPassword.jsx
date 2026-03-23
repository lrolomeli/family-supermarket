import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API_BASE_URL from "../config";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    if (password !== confirm) return setError("Las contraseñas no coinciden");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const text = await res.text();
        setError(text || "Error al restablecer la contraseña");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    padding: "14px", borderRadius: "12px", border: "1.5px solid #e5e7eb",
    fontSize: "16px", width: "100%", boxSizing: "border-box",
    WebkitAppearance: "none", background: "#f9fafb",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", padding: "20px",
    }}>
      <div style={{
        background: "#fff", borderRadius: "20px", padding: "40px 24px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
        maxWidth: "360px", width: "100%", boxSizing: "border-box",
      }}>
        <div style={{ fontSize: "44px", lineHeight: 1 }}>🔑</div>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#15803d" }}>
          Nueva Contraseña
        </h1>

        {error && (
          <div style={{
            width: "100%", padding: "10px 14px", borderRadius: "12px",
            background: "#fef2f2", color: "#dc2626", fontSize: "13px", boxSizing: "border-box",
          }}>
            ⚠️ {error}
          </div>
        )}

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: "100%", padding: "10px 14px", borderRadius: "12px",
              background: "#f0fdf4", color: "#15803d", fontSize: "13px",
              boxSizing: "border-box", marginBottom: "16px",
            }}>
              ✅ Contraseña actualizada exitosamente
            </div>
            <button onClick={() => navigate("/login")} style={{
              padding: "14px 24px", background: "#15803d", color: "#fff",
              border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 700,
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
            }}>
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
            <input type="password" placeholder="Nueva contraseña" required value={password}
              onChange={e => setPassword(e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#15803d"}
              onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
            <input type="password" placeholder="Confirmar contraseña" required value={confirm}
              onChange={e => setConfirm(e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#15803d"}
              onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
            <button type="submit" disabled={loading} style={{
              padding: "14px", background: loading ? "#86efac" : "#15803d", color: "#fff",
              border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", WebkitTapHighlightColor: "transparent",
            }}>
              {loading ? "Guardando..." : "Restablecer contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
