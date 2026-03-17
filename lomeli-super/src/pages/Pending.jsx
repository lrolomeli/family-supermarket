import React from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const Pending = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
    }}>
      <div style={{
        background: "#fff", borderRadius: "20px", padding: "48px 40px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.10)", maxWidth: "380px", width: "100%",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center"
      }}>
        <div style={{ fontSize: "48px" }}>⏳</div>
        <h2 style={{ margin: 0, color: "#15803d", fontWeight: 800 }}>Solicitud enviada</h2>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", lineHeight: 1.6 }}>
          Tu cuenta <strong>{user?.email}</strong> está pendiente de aprobación.<br />
          El administrador te dará acceso pronto.
        </p>
        <button onClick={handleLogout} style={{
          marginTop: "8px", padding: "10px 24px", background: "#f3f4f6",
          border: "none", borderRadius: "8px", cursor: "pointer",
          color: "#374151", fontWeight: 600, fontSize: "14px"
        }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default Pending;
