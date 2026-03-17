import { Navigate } from "react-router-dom";

// Home solo redirige, la autenticacion la maneja App.jsx
const Home = () => <Navigate to="/order" />;

export default Home;
