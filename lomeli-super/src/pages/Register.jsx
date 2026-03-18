import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API_BASE_URL from "../config";

const Register = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", display_name: "" });

  useEffect(() => {
    fetch(`${API_BASE_URL}/invitations/${code}/validate`)
      .then(r => r.json())
      .then(data => {
        setValid(data.valid);
        if (!data.valid) {
          const reasons = { not_found: "Invitación no encontrada", already_used: "Esta invitación ya fue utilizada", expired: "Esta invitación ha expirado" };
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