import { useState } from "react";
import { mockGoogleLogin } from "../services/api"; // this acts as general login now for testing

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("+91 9048853201");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (raw) => {
    // Basic test formatter
    return raw.trim();
  };

  const handleLogin = async () => {
    setError("");
    if (!phone) {
      setError("Enter a phone number or email.");
      return;
    }
    setLoading(true);
    try {
      const u = await mockGoogleLogin(formatPhone(phone)); // Uses local db
      onLogin(u);
    } catch (e) {
      setError(e.message || "Failed to login locally.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">📻</span>
          <h1>WalkieTalk</h1>
          <p className="tagline">Local Test Mode</p>
        </div>

        <div className="login-form">
          <label>Phone Number or Email</label>
          <div className="phone-input-wrap">
            <input
              type="text"
              placeholder="+1 234 567 8900"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button
            className="btn-primary"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Login →"}
          </button>
        </div>
      </div>
    </div>
  );
}
