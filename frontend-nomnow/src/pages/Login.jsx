import { useRef, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { SlLike } from "react-icons/sl";
import { CgMail } from "react-icons/cg";
import { useNavigate } from "react-router-dom";
import { FiPhone } from "react-icons/fi";
import { IoMdArrowBack } from "react-icons/io";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

const RESEND_COOLDOWN = 60; // ثانية

export default function Login() {
  const { api, login } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("none");
  const [phone, setPhone] = useState("");
  const [testtt, setTesttt] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();

  const inputsRef = useRef([]);
  const cooldownRef = useRef(null);

  // تنظيف الـ interval عند unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // بدء العداد التنازلي بعد إرسال OTP
  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputsRef.current[index + 1].focus();
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const newOtp = Array(6).fill("");
    pasted.split("").forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    const lastFilledIndex = Math.min(pasted.length - 1, 5);
    inputsRef.current[lastFilledIndex]?.focus();
  };

  const handleLoginWithPhone = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(
        "/restaurant/loginwithphone",
        { phone, password },
        { withCredentials: true },
      );
      setTesttt(res.data.message);
      console.log(res.data.message);
      setType("verificationphone");
      setError("");
      startCooldown();
    } catch (err) {
      setError(err.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(
        "/restaurant/loginwithemail",
        { email, password },
        { withCredentials: true },
      );
      setType("verificationemail");
      setError("");
      startCooldown();
    } catch (err) {
      setError(err.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationPhone = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(
        "/restaurant/verifyphone",
        { phone, otp: otp.join("") },
        { withCredentials: true },
      );
      login(res.data.accessToken, res.data.user, res.data.refreshToken);
      navigate("/", { replace: true });
      setError("");
    } catch (err) {
      setError(err.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(
        "/restaurant/verifyemail",
        { email, otp: otp.join("") },
        { withCredentials: true },
      );
      login(res.data.accessToken, res.data.user, res.data.refreshToken);
      navigate("/", { replace: true });
      setError("");
    } catch (err) {
      setError(err.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    try {
      const isPhone = type === "verificationphone";
      await api.post("/restaurant/resend-otp", {
        type: isPhone ? "phone" : "email",
        ...(isPhone ? { phone } : { email }),
      });
      // صفّر الخانات وضع focus على الأولى
      setOtp(Array(6).fill(""));
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
      setError("");
      startCooldown();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotEmailPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(
        "/restaurant/forgot-password",
        { email },
        { withCredentials: true },
      );
      login(res.data.accessToken, res.data.user);
      setError("");
      setType("sendemail");
    } catch (err) {
      setError(err.response.data.message);
    }
  };

  // JSX مباشر بدلاً من inline component لتجنب إعادة mount عند كل render
  const otpInputsJSX = (
    <div className="otp-container">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          autoFocus={index === 0}
          onChange={(e) => handleChange(e.target.value, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="otp-input"
        />
      ))}
    </div>
  );

  const resendButtonJSX = (
    <p
      className="resend"
      onClick={handleResend}
      style={{
        cursor: resendCooldown > 0 ? "default" : "pointer",
        opacity: resendCooldown > 0 ? 0.5 : 1,
      }}
    >
      {resendCooldown > 0
        ? `${t("auth.resendCode")} (${resendCooldown}s)`
        : t("auth.resendCode")}
    </p>
  );

  return (
    <>
      <div className="login-page">
        {/* Language switcher في أعلى الصفحة */}
        <div style={{ position: "absolute", top: 16, insetInlineEnd: 16 }}>
          <LanguageSwitcher />
        </div>

        <div className="container">
          <div className="top">
            <img src="/NOMNOWBG.png" alt="NOMNOW" />
            <p>{t("auth.partnerDashboard")}</p>
          </div>

          {type === "none" && (
            <div className="box">
              <h3>{t("auth.login")}</h3>
              <button className="orange" onClick={() => setType("phone")}>
                <FiPhone /> {t("auth.loginWithPhone")}
              </button>
              <button onClick={() => setType("email")}>
                <CgMail size={20} /> {t("auth.loginWithEmail")}
              </button>
              <p>
                {t("auth.noAccount")} <span>{t("auth.contactSupport")}</span>
              </p>
            </div>
          )}

          {type === "phone" && (
            <form className="box" onSubmit={handleLoginWithPhone}>
              <h3 className="icon" onClick={() => setType("none")}>
                <IoMdArrowBack size={20} />
              </h3>
              <h3>{t("auth.loginWithPhone")}</h3>
              <input
                type="text"
                placeholder="+9874333254"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                type="password"
                placeholder={t("auth.newPasswordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="orange" disabled={loading}>
                {t("auth.login")}
              </button>
              {error && <div className="error">{error}</div>}
            </form>
          )}

          {type === "email" && (
            <form className="box" onSubmit={handleLoginWithEmail}>
              <h3 className="icon" onClick={() => setType("none")}>
                <IoMdArrowBack size={20} />
              </h3>
              <h3>{t("auth.loginWithEmail")}</h3>
              <input
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder={t("auth.newPasswordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="orange" disabled={loading}>
                {t("auth.login")}
              </button>
              {error && <div className="error">{error}</div>}
              <p>
                <span onClick={() => setType("forgotEmailPassword")}>
                  {t("auth.forgotPassword")}
                </span>
              </p>
            </form>
          )}

          {type === "verificationphone" && (
            <form className="box phone" onSubmit={handleVerificationPhone}>
              <h3 className="icon" onClick={() => setType("phone")}>
                <IoMdArrowBack size={20} />
              </h3>
              <span>
                <FiPhone size={30} />
              </span>
              <h3>{t("auth.enterVerificationCode")}</h3>
              <p>
                {t("auth.verificationSentTo")} <br /> {phone}
              </p>
              {otpInputsJSX}
              <button className="orange" disabled={loading}>
                {t("auth.verify")}
              </button>
              <h2>{testtt}</h2>
              {error && <div className="error">{error}</div>}
              {resendButtonJSX}
            </form>
          )}

          {type === "verificationemail" && (
            <form className="box phone" onSubmit={handleVerificationEmail}>
              <h3 className="icon" onClick={() => setType("email")}>
                <IoMdArrowBack size={20} />
              </h3>
              <span>
                <CgMail size={30} />
              </span>
              <h3>{t("auth.enterVerificationCode")}</h3>
              <p>
                {t("auth.verificationSentTo")} <br /> {email}
              </p>
              {otpInputsJSX}
              <button className="orange" disabled={loading}>
                {t("auth.verify")}
              </button>
              {error && <div className="error">{error}</div>}
              {resendButtonJSX}
            </form>
          )}

          {type === "forgotEmailPassword" && (
            <form className="box" onSubmit={handleForgotEmailPassword}>
              <h3 className="icon" onClick={() => setType("email")}>
                <IoMdArrowBack size={20} />
              </h3>
              <h3>{t("auth.resetPassword")}</h3>
              <p>{t("auth.resetPasswordDesc")}</p>
              <input
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="orange" disabled={loading}>
                {t("auth.sendResetLink")}
              </button>
              {error && <div className="error">{error}</div>}
              <p onClick={() => setType("email")}>{t("auth.backToSignIn")}</p>
            </form>
          )}

          {type === "sendemail" && (
            <div className="box">
              <h3 className="icon sendemail">
                <SlLike size={20} />
              </h3>
              <h3>{t("auth.linkSent")}</h3>
              <p>{t("auth.linkSentDesc")}</p>
              <div className="error">{email}</div>
              <p>{t("auth.checkInbox")}</p>

              <button className="orange" onClick={() => setType("email")}>
                {t("auth.backToSignIn")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
