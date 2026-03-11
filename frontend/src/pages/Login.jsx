import { useState, useRef } from "react";
import { sendOTP, verifyOTP, saveUserProfile, signInWithGoogle } from "../services/firebase";
import { auth } from "../services/firebase";

export default function Login({ onLogin }) {
  const [step, setStep] = useState("phone"); // phone | otp
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef([]);

  const formatPhone = (raw) => {
    // Ensure E.164 format: +91XXXXXXXXXX etc.
    if (raw.startsWith("+")) return raw.trim();
    return "+" + raw.trim();
  };

  const handleSendOTP = async () => {
    setError("");
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone number with country code.");
      return;
    }
    setLoading(true);
    try {
      await sendOTP(formatPhone(phone));
      setStep("otp");
    } catch (e) {
      setError(e.message || "Failed to send OTP.");
      // Reset recaptcha
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");
    if (otp.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const user = await verifyOTP(otp);
      await saveUserProfile(user.uid, formatPhone(phone), user.displayName, user.email);
      onLogin(user);

    } catch (e) {
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      // Google users might not have phone number, but saveUserProfile now handles it.
      await saveUserProfile(user.uid, user.phoneNumber, user.displayName, user.email);
      onLogin(user);
    } catch (e) {
      setError(e.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-page">
      <div id="recaptcha-container" />

      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">📻</span>
          <h1>WalkieTalk</h1>
          <p className="tagline">Instant voice. No friction.</p>
        </div>

        {step === "phone" ? (
          <div className="login-form">
            <label>Phone Number</label>
            <div className="phone-input-wrap">
              <input
                type="tel"
                placeholder="+1 234 567 8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                autoFocus
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button
              className="btn-primary"
              onClick={handleSendOTP}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : "Send Code →"}
            </button>

            <div className="login-divider">
              <span>OR</span>
            </div>

            <button
              className="btn-google"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
              Sign in with Google
            </button>
          </div>

        ) : (
          <div className="login-form">
            <label>Verification Code</label>
            <p className="sub-label">Sent to {phone}</p>
            <input
              type="number"
              placeholder="123456"
              value={otp}
              maxLength={6}
              onChange={(e) => setOtp(e.target.value.slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
              autoFocus
              className="otp-input"
            />
            {error && <p className="error">{error}</p>}
            <button
              className="btn-primary"
              onClick={handleVerifyOTP}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : "Verify & Continue →"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => { setStep("phone"); setError(""); setOtp(""); }}
            >
              ← Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
