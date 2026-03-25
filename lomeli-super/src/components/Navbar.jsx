import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { clearLocalAuth } from "../api";

const Navbar = ({ user, isAdmin }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    if (user?.isLocal) {
      clearLocalAuth();
      navigate("/login");
      window.location.reload();
    } else {
      await signOut(auth);
      navigate("/login");
    }
  };

  const navItems = [
    { to: "/order", label: "Nuevo", icon: "🛒" },
    { to: "/my-orders", label: "Pedidos", icon: "📋" },
    { to: "/favorites", label: "Favoritos", icon: "⭐" },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: "⚙️" }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", background: "#fff", borderBottom: "1px solid #f3f4f6",
      }}>
        <span style={{ fontSize: "15px", fontWeight: 600, color: "#15803d" }}>
          🛒 Ahí te encargo
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "#6b7280", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.displayName || user?.email}
          </span>
          <button onClick={handleLogout} style={{
            padding: "6px 12px", fontSize: "12px", fontWeight: 600,
            background: "#f3f4f6", border: "none", borderRadius: "8px",
            color: "#6b7280", cursor: "pointer",
          }}>
            Salir
          </button>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        display: "flex", justifyContent: "space-around",
        background: "#fff", borderTop: "1px solid #e5e7eb",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {navItems.map(item => (
          <Link key={item.to} to={item.to} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "8px 0 6px", flex: 1, textDecoration: "none",
            color: isActive(item.to) ? "#15803d" : "#9ca3af",
            fontSize: "10px", fontWeight: isActive(item.to) ? 700 : 500,
            WebkitTapHighlightColor: "transparent",
          }}>
            <span style={{ fontSize: "20px", lineHeight: 1 }}>{item.icon}</span>
            <span style={{ marginTop: "2px" }}>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
};

export default Navbar;
