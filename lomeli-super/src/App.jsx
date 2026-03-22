import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import './App.css'
import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import Order from "./pages/Order";
import MyOrders from "./pages/MyOrders";
import FavoritesAndHistory from "./pages/FavoritesAndHistory";
import Admin from "./pages/Admin";
import Register from "./pages/Register";
import API_BASE_URL from "./config";
import apiFetch from "./api";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

const App = () => {
  const [user, setUser] = useState(undefined);
  const [approved, setApproved] = useState(undefined);

  useEffect(() => {
    // Check for local user first
    const localUser = localStorage.getItem("local_user");
    if (localUser) {
      try {
        const parsed = JSON.parse(localUser);
        setUser({ email: parsed.email, uid: parsed.uid, displayName: parsed.display_name, isLocal: true });
        // Verify with backend
        apiFetch(`${API_BASE_URL}/me`)
          .then(r => {
            if (r.status === 403) {
              // Local user no longer registered — clear and go to login
              localStorage.removeItem("local_user");
              localStorage.removeItem("local_token");
              setUser(null);
              setApproved(null);
              return null;
            }
            return r.json();
          })
          .then(data => { if (data) setApproved(data.approved); })
          .catch(() => setApproved(false));
        return;
      } catch (e) {
        localStorage.removeItem("local_user");
        localStorage.removeItem("local_token");
      }
    }

    // Firebase auth listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const res = await apiFetch(`${API_BASE_URL}/me`);
          if (res.status === 403) {
            const data = await res.json();
            if (data.reason === "not_registered") {
              // Google user not registered — sign out and redirect to login
              await auth.signOut();
              setUser(null);
              setApproved(null);
              return;
            }
          }
          const data = await res.json();
          setUser(firebaseUser);
          setApproved(data.approved);
        } catch (e) {
          console.error("/me error:", e);
          setUser(firebaseUser);
          setApproved(false);
        }
      } else {
        setUser(null);
        setApproved(null);
      }
    });
    return () => unsubscribe();
  }, []);

  if (user === undefined || (user && approved === undefined)) return <p>Cargando...</p>;

  const isAdmin = user?.email === ADMIN_EMAIL;
  const isLoggedIn = !!user;

  const PrivateRoute = ({ children }) => {
    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (approved === false) return <Navigate to="/login" replace />;
    return (
      <>
        <Navbar user={user} isAdmin={isAdmin} />
        {children}
      </>
    );
  };

  const AdminRoute = ({ children }) =>
    isAdmin ? (
      <>
        <Navbar user={user} isAdmin={isAdmin} />
        {children}
      </>
    ) : <Navigate to="/" />;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={isLoggedIn ? <Navigate to="/order" replace /> : <Login />} />
        <Route path="/register/:code" element={isLoggedIn ? <Navigate to="/order" replace /> : <Register />} />
        <Route path="/pending" element={<Navigate to="/login" replace />} />
        <Route path="/order" element={<PrivateRoute><Order /></PrivateRoute>} />
        <Route path="/my-orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
        <Route path="/favorites" element={<PrivateRoute><FavoritesAndHistory /></PrivateRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
      </Routes>
    </Router>
  );
};

export default App;
