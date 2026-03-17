import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import './App.css'
import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import Order from "./pages/Order";
import MyOrders from "./pages/MyOrders";
import Admin from "./pages/Admin";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
console.log("ADMIN_EMAIL:", ADMIN_EMAIL);

const App = () => {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
    });
    return () => unsubscribe();
  }, []);

  if (user === undefined) return <p>Loading...</p>;

  const isAdmin = user?.email === ADMIN_EMAIL;

  const PrivateRoute = ({ children }) =>
    user ? (
      <>
        <Navbar user={user} isAdmin={isAdmin} />
        {children}
      </>
    ) : <Navigate to="/login" replace />;

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
        <Route path="/order" element={<PrivateRoute><Order /></PrivateRoute>} />
        <Route path="/my-orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
      </Routes>
    </Router>
  );
};

export default App;
