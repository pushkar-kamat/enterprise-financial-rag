import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

import { confirmSignUp, signIn, signUp } from "./cognito";
import NorthstarLogo from "../components/NorthstarMark";

function InteractiveParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrame;
    let particles = [];

    let introProgress = 0;
    let introActive = true;

    const mouse = {
      x: -1000,
      y: -1000,
      vx: 0,
      vy: 0,
      speed: 0,
      active: false,
    };

    const camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      createParticles();
    };

    const createParticles = () => {
      particles = [];

      const area = window.innerWidth * window.innerHeight;

      const count = Math.min(420, Math.max(180, Math.floor(area / 3800)));

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 45;

        particles.push({
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,

          targetX: Math.random() * window.innerWidth,
          targetY: Math.random() * window.innerHeight,

          size:
            Math.random() < 0.82
              ? Math.random() * 1.75 + 0.7
              : Math.random() * 2.2 + 1.5,

          scale: 0.15,

          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,

          opacity: Math.random() * 0.35 + 0.08,

          phase: Math.random() * Math.PI * 2,
          orbitStrength: Math.random() * 0.8 + 0.35,
        });
      }
    };

    const isInsideProtectedZone = (x, y) => {
      const card = document.querySelector(".auth-card");

      if (!card) return false;

      const rect = card.getBoundingClientRect();
      const padding = 75;

      return (
        x > rect.left - padding &&
        x < rect.right + padding &&
        y > rect.top - padding &&
        y < rect.bottom + padding
      );
    };

    const handleMouseMove = (event) => {
      const newX = event.clientX;
      const newY = event.clientY;

      if (mouse.x > -500) {
        mouse.vx = newX - mouse.x;
        mouse.vy = newY - mouse.y;

        mouse.speed = Math.min(
          Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy),
          45,
        );
      }

      mouse.x = newX;
      mouse.y = newY;
      mouse.active = true;

      const normalizedX = newX / window.innerWidth - 0.5;

      const normalizedY = newY / window.innerHeight - 0.5;

      camera.targetX = -normalizedX * 55;
      camera.targetY = -normalizedY * 55;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.vx = 0;
      mouse.vy = 0;
      mouse.speed = 0;

      camera.targetX = 0;
      camera.targetY = 0;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    resize();

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      camera.x += (camera.targetX - camera.x) * 0.08;

      camera.y += (camera.targetY - camera.y) * 0.08;

      if (introActive) {
        introProgress += 0.0045;

        for (const particle of particles) {
          const dx = particle.targetX - particle.x;

          const dy = particle.targetY - particle.y;

          particle.x += dx * 0.018;
          particle.y += dy * 0.018;

          particle.scale += (1 - particle.scale) * 0.025;
        }

        if (introProgress >= 1) {
          introActive = false;
        }
      }

      const gridSize = 55;

      ctx.save();

      ctx.translate(camera.x, camera.y);

      ctx.beginPath();

      for (
        let x = -gridSize;
        x <= window.innerWidth + gridSize;
        x += gridSize
      ) {
        ctx.moveTo(x, -gridSize);
        ctx.lineTo(x, window.innerHeight + gridSize);
      }

      for (
        let y = -gridSize;
        y <= window.innerHeight + gridSize;
        y += gridSize
      ) {
        ctx.moveTo(-gridSize, y);
        ctx.lineTo(window.innerWidth + gridSize, y);
      }

      const centerX = window.innerWidth / 2 - camera.x;

      const centerY = window.innerHeight / 2 - camera.y;

      const maxDistance = Math.sqrt(
        window.innerWidth * window.innerWidth +
          window.innerHeight * window.innerHeight,
      );

      const gridGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        maxDistance,
      );

      gridGradient.addColorStop(0.25, "rgba(255, 255, 255, 0.038)");

      gridGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.015)");

      gridGradient.addColorStop(0.72, "rgba(255, 255, 255, 0.004)");

      gridGradient.addColorStop(0.9, "rgba(255, 255, 255, 0)");

      gridGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.strokeStyle = gridGradient;
      ctx.lineWidth = 1;
      ctx.stroke();

      for (const particle of particles) {
        particle.phase += 0.006;

        particle.vx += Math.cos(particle.phase) * 0.0015;

        particle.vy += Math.sin(particle.phase) * 0.0015;

        if (mouse.active) {
          const dx = mouse.x - particle.x;
          const dy = mouse.y - particle.y;

          const distance = Math.sqrt(dx * dx + dy * dy);

          const interactionRadius = 430;

          if (distance < interactionRadius && distance > 1) {
            const strength = (interactionRadius - distance) / interactionRadius;

            const nx = dx / distance;
            const ny = dy / distance;

            const tangentX = -ny;
            const tangentY = nx;

            const swirl =
              strength * (0.075 + mouse.speed * 0.009) * particle.orbitStrength;

            particle.vx += tangentX * swirl;
            particle.vy += tangentY * swirl;

            particle.vx += nx * strength * 0.008;

            particle.vy += ny * strength * 0.008;

            particle.vx += mouse.vx * strength * 0.002;

            particle.vy += mouse.vy * strength * 0.002;
          }
        }

        particle.vx *= 0.972;
        particle.vy *= 0.972;

        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -10) {
          particle.x = window.innerWidth + 10;
        }

        if (particle.x > window.innerWidth + 10) {
          particle.x = -10;
        }

        if (particle.y < -10) {
          particle.y = window.innerHeight + 10;
        }

        if (particle.y > window.innerHeight + 10) {
          particle.y = -10;
        }

        if (isInsideProtectedZone(particle.x, particle.y)) {
          const card = document.querySelector(".auth-card");

          if (card) {
            const rect = card.getBoundingClientRect();

            const cardCenterX = rect.left + rect.width / 2;

            const cardCenterY = rect.top + rect.height / 2;

            let pushX = particle.x - cardCenterX;

            let pushY = particle.y - cardCenterY;

            const distance = Math.sqrt(pushX * pushX + pushY * pushY);

            if (distance > 0) {
              pushX /= distance;
              pushY /= distance;

              particle.vx += pushX * 0.08;
              particle.vy += pushY * 0.08;
            }
          }
        }

        const shimmer = Math.sin(particle.phase * 2.5) * 0.07;

        const opacity = Math.max(0.04, particle.opacity + shimmer);

        const renderedX = particle.x + camera.x;

        const renderedY = particle.y + camera.y;

        ctx.fillStyle = `rgba(170, 185, 200, ${opacity})`;

        const renderedSize = particle.size * particle.scale;

        ctx.fillRect(
          Math.round(renderedX - renderedSize / 2),
          Math.round(renderedY - renderedSize / 2),
          renderedSize,
          renderedSize,
        );
      }

      ctx.restore();

      mouse.vx *= 0.86;
      mouse.vy *= 0.86;
      mouse.speed *= 0.9;

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);

      window.removeEventListener("resize", resize);

      window.removeEventListener("mousemove", handleMouseMove);

      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="auth-particle-canvas" />;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [verificationEmail, setVerificationEmail] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const passwordRequirements = {
    minLength: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  };
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setMessage("");
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  const handleSignUp = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();

    if (!name) {
      setError("Please enter your full name.");
      return;
    }

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!passwordRequirements.minLength) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (
      !passwordRequirements.uppercase ||
      !passwordRequirements.lowercase ||
      !passwordRequirements.number ||
      !passwordRequirements.special
    ) {
      setError("Please meet all password requirements.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signUp({
        name,
        email,
        password: form.password,
      });

      setVerificationEmail(email);
      setMode("verify");
      setMessage("A verification code has been sent to your email.");
    } catch (signupError) {
      setError(signupError?.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (event) => {
    event.preventDefault();

    const code = form.code.trim();

    if (!code) {
      setError("Please enter the verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await confirmSignUp({
        email: verificationEmail,
        code,
      });

      setForm((previous) => ({
        ...previous,
        password: "",
        confirmPassword: "",
        code: "",
      }));

      setMode("signin");
      setMessage("Your account has been verified. You can now sign in.");
    } catch (verificationError) {
      setError(
        verificationError?.message || "The verification code is invalid.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();

    const email = form.email.trim();

    if (!email || !form.password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signIn({
        email,
        password: form.password,
      });

      onAuthenticated();
    } catch (signinError) {
      setError(signinError?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <InteractiveParticles />

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark">
            <NorthstarLogo variant="mark" />
          </div>

          <div>
            <div className="auth-brand-name">Northstar</div>

            <div className="auth-brand-subtitle">Financial Intelligence</div>
          </div>
        </div>

        <div className={`auth-content auth-content-${mode}`} key={mode}>
          {mode === "verify" ? (
            <>
              <div className="auth-heading">
                <button
                  type="button"
                  className="auth-back"
                  onClick={() => switchMode("signup")}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>

                <h1>Verify your email</h1>

                <p>Enter the verification code sent to your email address.</p>
              </div>

              <form className="auth-form" onSubmit={handleVerification}>
                <label>
                  Verification code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={form.code}
                    onChange={(event) =>
                      updateField("code", event.target.value)
                    }
                    placeholder="Enter your code"
                  />
                </label>

                {error && <div className="auth-error">{error}</div>}

                {message && <div className="auth-success">{message}</div>}

                <button
                  className="auth-submit"
                  type="submit"
                  disabled={loading}
                >
                  <span className="auth-submit-content">
                    {loading ? (
                      <>
                        <Loader2 size={17} className="spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify email"
                    )}
                  </span>
                </button>
              </form>
            </>
          ) : mode === "signup" ? (
            <>
              <div className="auth-heading">
                <h1>Create your account</h1>

                <p>Create your Northstar Financial AI account.</p>
              </div>

              <form className="auth-form" onSubmit={handleSignUp}>
                <label>
                  Full name
                  <input
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    placeholder="Your full name"
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    placeholder="you@example.com"
                  />
                </label>

                <label>
                  Password
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) =>
                        updateField("password", event.target.value)
                      }
                      placeholder="Create a password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((previous) => !previous)}
                      className="password-toggle"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="password-requirements">
                      <div
                        className={`password-requirement ${
                          passwordRequirements.minLength ? "met" : ""
                        }`}
                      >
                        <span className="password-requirement-icon">
                          {passwordRequirements.minLength ? "✓" : "○"}
                        </span>
                        <span>At least 8 characters</span>
                      </div>

                      <div
                        className={`password-requirement ${
                          passwordRequirements.uppercase ? "met" : ""
                        }`}
                      >
                        <span className="password-requirement-icon">
                          {passwordRequirements.uppercase ? "✓" : "○"}
                        </span>
                        <span>One uppercase letter</span>
                      </div>

                      <div
                        className={`password-requirement ${
                          passwordRequirements.lowercase ? "met" : ""
                        }`}
                      >
                        <span className="password-requirement-icon">
                          {passwordRequirements.lowercase ? "✓" : "○"}
                        </span>
                        <span>One lowercase letter</span>
                      </div>

                      <div
                        className={`password-requirement ${
                          passwordRequirements.number ? "met" : ""
                        }`}
                      >
                        <span className="password-requirement-icon">
                          {passwordRequirements.number ? "✓" : "○"}
                        </span>
                        <span>One number</span>
                      </div>

                      <div
                        className={`password-requirement ${
                          passwordRequirements.special ? "met" : ""
                        }`}
                      >
                        <span className="password-requirement-icon">
                          {passwordRequirements.special ? "✓" : "○"}
                        </span>
                        <span>One special character</span>
                      </div>
                    </div>
                  )}
                </label>

                <label>
                  Confirm password
                  <div className="password-field">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={(event) =>
                        updateField("confirmPassword", event.target.value)
                      }
                      placeholder="Confirm your password"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((previous) => !previous)
                      }
                      className="password-toggle"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>
                </label>

                {error && <div className="auth-error">{error}</div>}

                <button
                  className="auth-submit"
                  type="submit"
                  disabled={loading}
                >
                  <span className="auth-submit-content">
                    {loading ? (
                      <>
                        <Loader2 size={17} className="spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create account"
                    )}
                  </span>
                </button>
              </form>

              <div className="auth-switch">
                Already have an account?
                <button type="button" onClick={() => switchMode("signin")}>
                  Sign in
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="auth-heading">
                <h1>Welcome back</h1>

                <p>Sign in to your Northstar account.</p>
              </div>

              <form className="auth-form" onSubmit={handleSignIn}>
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    placeholder="you@example.com"
                  />
                </label>

                <label>
                  Password
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={form.password}
                      onChange={(event) =>
                        updateField("password", event.target.value)
                      }
                      placeholder="Enter your password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((previous) => !previous)}
                      className="password-toggle"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                {error && <div className="auth-error">{error}</div>}

                {message && <div className="auth-success">{message}</div>}

                <button
                  className="auth-submit"
                  type="submit"
                  disabled={loading}
                >
                  <span className="auth-submit-content">
                    {loading ? (
                      <>
                        <Loader2 size={17} className="spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </span>
                </button>
              </form>

              <div className="auth-switch">
                Don't have an account?
                <button type="button" onClick={() => switchMode("signup")}>
                  Create an account
                </button>
              </div>
            </>
          )}
        </div>

        <div className="auth-footer">Northstar Financial AI</div>
      </div>
    </div>
  );
}

export default AuthScreen;
