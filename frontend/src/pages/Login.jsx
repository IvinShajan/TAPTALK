import { useState } from "react";
import { mockGoogleLogin } from "../services/api";

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (raw) => {
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
      const u = await mockGoogleLogin(formatPhone(phone), displayName.trim()); // Uses local db
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
          <p className="tagline">Register / Login</p>
        </div>

        <div className="login-form">
          <label>Display Name</label>
          <div className="phone-input-wrap" style={{ marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
          </div>

          <label>Phone Number or Email</label>
          <div className="phone-input-wrap">
            <input
              type="text"
              placeholder="+1 234 567 8900"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button
            className="btn-primary"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
