import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import Pending from "./pages/Pending";
import './App.css'
import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import Order from "./pages/Order";
import MyOrders from "./pages/MyOrders";
import FavoritesAndHistory from "./pages/FavoritesAndHistory";
import Admin from "./pages/Admin";
import API_BASE_URL from "./config";
import apiFetch from "./api";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
console.log("ADMIN_EMAIL:", ADMIN_EMAIL);

const App = () => {
  const [user, setUser] = useState(undefined);
  const [approved, setApproved] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser ?? null);
      if (firebaseUser) {
        try {
          const res = await apiFetch(`${API_BASE_URL}/me`);
          const data = await res.json();
          console.log("/me response:", data);
          setApproved(data.approved);
        } catch (e) {
          console.error("/me error:", e);
          setApproved(false);
        }
      } else {
        setApproved(null);
      }
    });
    return () => unsubscribe();
  }, []);

  if (user === undefined || (user && approved === undefined)) return <p>Loading...</p>;

  const isAdmin = user?.email === ADMIN_EMAIL;

  const PrivateRoute = ({ children }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (approved === false) return <Navigate to="/pending" replace />;
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
        <Route path="/login" element={user ? <Navigate to="/order" replace /> : <Login />} />
        <Route path="/pending" element={
          !user ? <Navigate to="/login" replace /> :
          approved ? <Navigate to="/order" replace /> :
          <Pending />
        } />
        <Route path="/order" element={<PrivateRoute><Order /></PrivateRoute>} />
        <Route path="/my-orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
        <Route path="/favorites" element={<PrivateRoute><FavoritesAndHistory /></PrivateRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
      </Routes>
    </Router>
  );
};

export default App;
