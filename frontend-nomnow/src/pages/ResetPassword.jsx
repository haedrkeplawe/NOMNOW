import { useState } from "react";
import axios from "axios";
import { FaArrowLeft } from "react-icons/fa";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/restaurant/reset-password/${token}`,
        { password },
      );
      setSuccess(t("auth.passwordUpdated"));
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err) {
      setError(err.response?.data?.message || t("common.error"));
    }
  };

  return (
    <div className="login-page">
      <div style={{ position: "absolute", top: 16, insetInlineEnd: 16 }}>
        <LanguageSwitcher />
      </div>

      <div className="container">
        <div className="top">
          <span>N</span>
          <h2>NOMNOW</h2>
          <p>{t("auth.partnerDashboard")}</p>
        </div>
        <form className="box" onSubmit={handleResetPassword}>
          <h3 className="icon" onClick={() => navigate("/login")}>
            <FaArrowLeft size={20} />
          </h3>
          <h3>{t("auth.resetPassword")}</h3>
          <p>{t("auth.enterNewPassword")}</p>
          <input
            type="password"
            placeholder={t("auth.newPasswordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="orange">{t("auth.resetPassword")}</button>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          <Link to="/login">{t("auth.backToSignIn")}</Link>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
