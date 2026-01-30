import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FaArrowLeft } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";

const ResetPassword = () => {
  const { token } = useParams(); // ⬅️ التوكن من الرابط
  const { api } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(
        `/restaurant/reset-password/${token}`,
        { password },
        { withCredentials: true }
      );
      setError("password updated now you can login");
    } catch (err) {
      setError(err.response.data.message);
      console.error(err.response.data.message);
    }
  };
  return (
    <div className="login-page">
      <div className="container">
        <div className="top">
          <span>N</span>
          <h2>NOMNOW</h2>
          <p>Restaurant Partner Dashboard</p>
        </div>
        <form className="box" onSubmit={handleResetPassword}>
          <h3 className="icon">
            <FaArrowLeft size={20} />
          </h3>
          <h3>Reset Password</h3>
          <p>Enter your new password</p>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="orange"> Reset Password</button>
          <div className="error">{error}</div>
          <Link to={"/login"}>Login</Link>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
