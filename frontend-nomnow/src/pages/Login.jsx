import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { SlLike } from "react-icons/sl";
import { CgMail } from "react-icons/cg";
import { useNavigate } from "react-router-dom";
import { FiPhone } from "react-icons/fi";
import { IoMdArrowBack } from "react-icons/io";

export default function Login() {
  const { api, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("none");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const inputsRef = useRef([]);
  const handleChange = (value, index) => {
    if (!/^\d?$/.test(value)) return; // أرقام فقط

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 6 - 1) {
      inputsRef.current[index + 1].focus();
    }
  };
  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  const handleLoginWithPhone = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(
        "/restaurant/loginwithphone",
        { phone, password },
        { withCredentials: true }
      );
      setType("verificationphone");
      console.log(res);

      setError("");
    } catch (err) {
      setError(err.response.data.message);
      console.error(err.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(
        "/restaurant/loginwithemail",
        { email, password },
        { withCredentials: true }
      );
      setType("verificationemail");
      setError("");
    } catch (err) {
      setError(err.response.data.message);
      console.error(err.response.data.message);
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
        { withCredentials: true }
      );
      login(res.data.accessToken, res.data.user);
      navigate("/", { replace: true });
      setError("");
    } catch (err) {
      setError(err.response.data.message);
      console.error(err.response.data.message);
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
        { withCredentials: true }
      );
      login(res.data.accessToken, res.data.user);
      navigate("/", { replace: true });
      setError("");
    } catch (err) {
      setError(err.response.data.message);
      console.error(err.response.data.message);
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
        { withCredentials: true }
      );
      login(res.data.accessToken, res.data.user);

      setError("");
      setType("sendemail");
    } catch (err) {
      setError(err.response.data.message);
      console.error(err.response.data.message);
    }
  };

  return (
    <>
      <div className="login-page">
        <div className="container">
          <div className="top">
            <span>N</span>
            <h2>NOMNOW</h2>
            <p>Restaurant Partner Dashboard</p>
          </div>

          {type === "none" && (
            <div className="box">
              <h3>Log In</h3>
              <button className="orange" onClick={() => setType("phone")}>
                <FiPhone /> Log in with phone number
              </button>
              <button onClick={() => setType("email")}>
                <CgMail size={20} /> Log in with email
              </button>
              <p>
                Don't have an account? <span>Contact NOMNOW Support</span>
              </p>
            </div>
          )}

          {type === "phone" && (
            <form className="box" onSubmit={handleLoginWithPhone}>
              <h3 className="icon" onClick={() => setType("none")}>
                <IoMdArrowBack size={20} />
              </h3>
              <h3>Log in with phone number</h3>
              <input
                type="text"
                placeholder="+9874333254"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="orange" disabled={loading}>
                Log in
              </button>
              {error && <div className="error">{error}</div>}
            </form>
          )}

          {type === "email" && (
            <form className="box" onSubmit={handleLoginWithEmail}>
              <h3 className="icon" onClick={() => setType("none")}>
                <IoMdArrowBack size={20} />
              </h3>
              <h3>Log in with email</h3>
              <input
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="orange" disabled={loading}>
                Log in
              </button>
              {error && <div className="error">{error}</div>}
              <p>
                <span onClick={() => setType("forgotEmailPassword")}>
                  ForgetPassword?
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
              <h3>"Enter verification code"</h3>
              <p>
                The verification code has been sent to <br />
                {phone}
              </p>
              <div className="otp-container">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputsRef.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(e.target.value, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="otp-input"
                  />
                ))}
              </div>
              <button className="orange" disabled={loading}>
                Verify
              </button>
              {error && <div className="error">{error}</div>}
              <p className="resend">Resend the code</p>
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
              <h3>"Enter verification code"</h3>
              <p>
                The verification code has been sent to <br />
                {email}
              </p>
              <div className="otp-container">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputsRef.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(e.target.value, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="otp-input"
                  />
                ))}
              </div>
              <button className="orange" disabled={loading}>
                Verify
              </button>
              {error && <div className="error">{error}</div>}
              <p className="resend">Resend the code</p>
            </form>
          )}

          {type === "forgotEmailPassword" && (
            <form className="box" onSubmit={handleForgotEmailPassword}>
              <h3 className="icon" onClick={() => setType("email")}>
                <IoMdArrowBack size={20} />
              </h3>
              <h3>Reset Password</h3>
              <p>
                Enter your email address and we'll send you a link to reset your
                password
              </p>
              <input
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="orange" disabled={loading}>
                Send Reset Link
              </button>
              {error && <div className="error">{error}</div>}
              <p onClick={() => setType("email")}>Back to Sign In</p>
            </form>
          )}

          {type === "sendemail" && (
            <div className="box ">
              <h3 className="icon sendemail">
                <SlLike size={20} />
              </h3>
              <h3>Link Sent!</h3>
              <p>We've sent a password reset link to:</p>
              <div className="error">{email}</div>
              <p>
                Please check your inbox. It may take a few minutes to arrive.
              </p>
              <button className="orange" onClick={() => setType("email")}>
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
