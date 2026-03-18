import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

const Navbar = ({ user, isAdmin }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <nav style={{ display: "flex", gap: "16px", padding: "10px 20px", borderBottom: "1px solid #ccc" }}>
      <Link to="/order">Orden Nueva</Link>
      <Link to="/my-orders">Mis Ordenes</Link>
      <Link to="/favorites">⭐ Favoritos</Link>
      {isAdmin && <Link to="/admin">Admin</Link>}
      <span style={{ marginLeft: "auto" }}>{user?.email}</span>
      <button onClick={handleLogout}>Cerrar sesión</button>
    </nav>
  );
};

export default Navbar;
