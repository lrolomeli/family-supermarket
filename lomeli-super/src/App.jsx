import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./components/Login";
import './App.css'
import React from "react";
import { auth } from "./firebase";
import Order from "./pages/Order";
import MyOrders from "./pages/MyOrders";
import Admin from "./pages/Admin";

const PrivateRoute = ({ children }) => {
  const user = auth.currentUser;
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const user = auth.currentUser;
  const isAdmin = user && user.email === "lro.lomeli@gmail.com"; // Replace with your admin email
  return isAdmin ? children : <Navigate to="/" />;
};


const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/order"
          element={
            <PrivateRoute>
              <Order />
            </PrivateRoute>
          }
        />
        <Route
          path="/my-orders"
          element={
            <PrivateRoute>
              <MyOrders />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
