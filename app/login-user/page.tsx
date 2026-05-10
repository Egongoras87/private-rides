"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  ConfirmationResult
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginUser() {
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  const router = useRouter();

  // 1. PERSISTENCIA Y BLOQUEO INICIAL
  useEffect(() => {
    // Mantener la sesión activa permanentemente
    setPersistence(auth, browserLocalPersistence);

    const ultimoEnvio = localStorage.getItem('last_sms_time');
    if (ultimoEnvio) {
      const diff = Math.floor((Date.now() - Number(ultimoEnvio)) / 1000);
      if (diff < 60) {
        setSegundosRestantes(60 - diff);
      }
    }
  }, []);

  // 2. TEMPORIZADOR SMS
  useEffect(() => {
    if (segundosRestantes > 0) {
      const timer = setTimeout(() => setSegundosRestantes(segundosRestantes - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [segundosRestantes]);

  // 3. REDIRECCIÓN AUTOMÁTICA SI YA ESTÁ LOGUEADO
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Si ya está logueado, lo mandamos a la app de usuario
        router.replace("/");
      }
    });
    return () => unsub();
  }, [router]);

  // 📩 ENVIAR CÓDIGO
  const enviarCodigo = async () => {
    if (segundosRestantes > 0) return;

    const limpio = telefono.replace(/\D/g, "");
    if (limpio.length !== 10) {
      alert("Please enter a valid 10-digit US number");
      return;
    }

    setLoading(true);

    try {
      // Limpiar instancia previa si existe
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
      }

      (window as any).recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );

      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = "+1" + limpio;

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirm(confirmation);

      // Bloqueo de seguridad de 60s
      localStorage.setItem('last_sms_time', Date.now().toString());
      setSegundosRestantes(60);

    } catch (err: any) {
      console.error(err);
      alert("Error sending SMS. Please try again later.");
      if ((window as any).recaptchaVerifier) (window as any).recaptchaVerifier.clear();
    } finally {
      setLoading(false);
    }
  };

  // ✅ VERIFICAR CÓDIGO
  const verificarCodigo = async () => {
    if (!codigo || !confirm) {
      alert("Please enter the code");
      return;
    }

    setLoading(true);

    try {
      await confirm.confirm(codigo);
      // El onAuthStateChanged se encargará de la redirección
    } catch (err) {
      console.error(err);
      alert("Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  // --- UI HANDLERS ---
  const press = (e: any) => {
    e.currentTarget.style.transform = "scale(0.97)";
    e.currentTarget.style.boxShadow = "0 2px 0 #000";
  };

  const release = (e: any) => {
    e.currentTarget.style.transform = "scale(1)";
    const isGreen = e.currentTarget.id === "btn-verify";
    e.currentTarget.style.boxShadow = isGreen ? "0 4px 0 #1e7e34" : "0 4px 0 #0056b3";
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: 5 }}>🚗 Private Rides</h2>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Las Vegas Premium Service</p>

        <div style={labelStyle}>Phone Number</div>
        <input
          type="tel"
          placeholder="702 000 0000"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          style={inputStyle}
          disabled={!!confirm || segundosRestantes > 0}
        />

        <button
          onClick={enviarCodigo}
          style={{ 
            ...btnBlue, 
            opacity: (loading || segundosRestantes > 0) ? 0.6 : 1,
            background: segundosRestantes > 0 ? "#333" : "#007bff"
          }}
          onMouseDown={press}
          onMouseUp={release}
          onMouseLeave={release}
          disabled={loading || segundosRestantes > 0}
        >
          {loading ? "Sending..." : segundosRestantes > 0 ? `Wait ${segundosRestantes}s` : confirm ? "Resend Code" : "Send SMS"}
        </button>

        {confirm && (
          <div style={{ marginTop: 25 }}>
            <div style={{ ...labelStyle, color: '#28a745' }}>Verification Code</div>
            <input
              type="number"
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              style={inputStyle}
              maxLength={6}
            />

            <button
              id="btn-verify"
              onClick={verificarCodigo}
              style={btnGreen}
              onMouseDown={press}
              onMouseUp={release}
              onMouseLeave={release}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
          </div>
        )}

        <div id="recaptcha-container"></div>

        <div style={footerLinks}>
          <a href="/privacy" style={linkStyle}>Privacy</a>
          <span style={{color:'#444'}}>|</span>
          <a href="/terms" style={linkStyle}>Terms</a>
        </div>
      </div>
    </div>
  );
}

// --- ESTILOS ---
const labelStyle: any = { textAlign: 'left', marginBottom: 5, fontSize: 12, color: '#007bff', fontWeight: 'bold', marginLeft: 5 };
const containerStyle: any = { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#000", color: "#fff", fontFamily: "system-ui" };
const cardStyle: any = { width: 340, padding: "40px 30px", borderRadius: 28, background: "#111", border: "1px solid #222", boxShadow: "0 25px 50px rgba(0,0,0,0.9)", textAlign: "center" };
const inputStyle: any = { width: "100%", padding: "16px", borderRadius: 14, border: "1px solid #333", marginBottom: 15, background: "#000", color: "#fff", fontSize: 18, textAlign: "center", outline: "none" };
const btnBlue: any = { width: "100%", padding: 15, borderRadius: 14, border: "none", background: "#007bff", color: "#fff", fontWeight: "bold", boxShadow: "0 4px 0 #0056b3", cursor: "pointer", transition: "all 0.1s" };
const btnGreen: any = { width: "100%", padding: 15, borderRadius: 14, border: "none", background: "#28a745", color: "#fff", fontWeight: "bold", boxShadow: "0 4px 0 #1e7e34", cursor: "pointer", transition: "all 0.1s" };
const footerLinks: any = { marginTop: 30, display: "flex", justifyContent: "center", gap: 15, fontSize: 12 };
const linkStyle: any = { color: "#666", textDecoration: "none" };