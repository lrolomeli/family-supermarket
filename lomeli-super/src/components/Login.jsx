import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useNavigate } from "react-router-dom";
import { primeToken } from "../api";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      await primeToken();
      navigate("/order");
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "20px",
        padding: "48px 40px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        maxWidth: "360px",
        width: "100%",
      }}>
        {/* Logo / ícono */}
        <div style={{ display: "flex", gap: "8px", fontSize: "40px" }}>
          🥦🥕🍓
        </div>

        {/* Nombre */}
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#15803d", letterSpacing: "-0.5px" }}>
          Lomeli Super
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", textAlign: "center" }}>
          Haz tu pedido de despensa fácil y rápido
        </p>

        <hr style={{ width: "100%", border: "none", borderTop: "1px solid #f3f4f6", margin: "8px 0" }} />

        {/* Botón Google */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 24px",
            background: loading ? "#f3f4f6" : "#fff",
            border: "1.5px solid #e5e7eb",
            borderRadius: "10px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "15px",
            fontWeight: 600,
            color: "#374151",
            width: "100%",
            justifyContent: "center",
            transition: "box-shadow 0.15s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)"}
          onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}
        >
          {/* Google icon */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          {loading ? "Entrando..." : "Continuar con Google"}
        </button>

        <p style={{ margin: 0, color: "#9ca3af", fontSize: "12px", textAlign: "center" }}>
          Solo usuarios autorizados pueden acceder
        </p>
      </div>
    </div>
  );
};

export default Login;
