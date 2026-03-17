import React from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useNavigate } from "react-router-dom";
import { primeToken } from "../api";

const Login = () => {
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Logged in user:", result.user);
      await primeToken(); // pre-carga el token para que el primer request sea rápido
      navigate("/order");
    } catch (error) {
      console.error("Google Sign-In error:", error);
    }
  };

  return (
    <div>
      <h2>Login with Google</h2>
      <button onClick={handleGoogleSignIn}>Sign in with Google</button>
    </div>
  );
};

export default Login;