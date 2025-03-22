import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/order"); // Redirect to Order Page if logged in
      }
      setLoading(false); // Stop loading
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [navigate]);

  if (loading) {
    return <p>Loading...</p>; // Show a loading spinner or message
  }

  return (
    <div>
      <h1>Welcome to the Grocery App</h1>
      <p>Please log in to place your orders.</p>
      <button onClick={() => navigate("/login")}>Login with Google</button>
    </div>
  );
};

export default Home;