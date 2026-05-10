"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginUser() {
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [confirm, setConfirm] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0); // 🔥 Nuevo: Para el bloqueo

  const router = useRouter();

  // 1. 🕒 REVISAR BLOQUEO AL CARGAR
  useEffect(() => {
    const ultimoEnvio = localStorage.getItem('last_sms_time');
    if (ultimoEnvio) {
      const diff = Math.floor((Date.now() - Number(ultimoEnvio)) / 1000);
      if (diff < 60) {
        setSegundosRestantes(60 - diff);
      }
    }
  }, []);

  // 2. ⏳ TEMPORIZADOR ACTIVO
  useEffect(() => {
    if (segundosRestantes > 0) {
      const timer = setTimeout(() => setSegundosRestantes(segundosRestantes - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [segundosRestantes]);

  // 🔐 REDIRECCIÓN AUTOMÁTICA
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect") || "/";
        router.push(redirect);
      }
    });
    return () => unsub();
  }, [router]);

  // 📩 ENVIAR CÓDIGO (CON BLOQUEO)
  const enviarCodigo = async () => {
  if (segundosRestantes > 0) return;

  const limpio = telefono.replace(/\D/g, "");

  // 🔥 VALIDACIÓN CORRECTA AQUÍ
  if (limpio.length !== 10) {
    alert("Invalid US phone number");
    return;
  }

  setLoading(true);

  try {
    // 👇 recaptcha (tu código sigue aquí)
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
      }

      if (!(window as any).recaptchaVerifier) {
  (window as any).recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    {
      size: "invisible",
      callback: () => {
        console.log("reCAPTCHA resolved");
      }
    }
  );
}

const appVerifier = (window as any).recaptchaVerifier;

     
      const formattedPhone = "+1" + limpio;


      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirm(confirmation);

      // 🔥 REGISTRAR BLOQUEO EXITOSO
      localStorage.setItem('last_sms_time', Date.now().toString());
      setSegundosRestantes(60);

      alert("Verification code sent!");
    } catch (err: any) {
      console.error(err);
      alert("Error sending code. Please try again.");
      if ((window as any).recaptchaVerifier) (window as any).recaptchaVerifier.clear();
    } finally {
      setLoading(false);
    }
  };

  // ✅ VERIFICAR
  const verificarCodigo = async () => {
    if (!codigo || !confirm) {
      alert("Enter the code first");
      return;
    }

    setLoading(true);

    try {
      await confirm.confirm(codigo);
    } catch (err) {
      console.error(err);
      alert("Invalid code. Check and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: 10 }}>🚗 Private Rides</h2>
        <div
  style={{
    marginTop: 20,
    display: "flex",
    justifyContent: "center",
    gap: 12,
    fontSize: 14,
  }}
>
  <a
    href="/privacy"
    style={{ color: "#999" }}
  >
    Privacy Policy
  </a>

  <a
    href="/terms"
    style={{ color: "#999" }}
  >
    Terms of Service
  </a>
</div>
        <p style={{ color: "#aaa", fontSize: 14, marginBottom: 25 }}>Las Vegas Premium Service</p>

        <div style={{ textAlign: 'left', marginBottom: 5, fontSize: 12, color: '#007bff' }}>Phone Number</div>
        <input
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
            opacity: (loading || segundosRestantes > 0) ? 0.7 : 1, 
            cursor: (loading || segundosRestantes > 0) ? "not-allowed" : "pointer",
            background: segundosRestantes > 0 ? "#444" : "#007bff" // Color más oscuro si está bloqueado
          }}
          onMouseDown={press}
          onMouseUp={release}
          onMouseLeave={release}
          disabled={loading || segundosRestantes > 0}
        >
          {loading 
            ? "Sending..." 
            : segundosRestantes > 0 
            ? `Wait ${segundosRestantes}s` 
            : confirm 
            ? "📩 Resend Code" 
            : "📩 Send Code"}
        </button>

        {confirm && (
          <>
            <div style={{ height: 20 }} />
            <div style={{ textAlign: 'left', marginBottom: 5, fontSize: 12, color: '#28a745' }}>Verification Code</div>
            <input
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              style={inputStyle}
              maxLength={6}
            />

            <button
              onClick={verificarCodigo}
              style={{ ...btnGreen, opacity: loading ? 0.7 : 1 }}
              onMouseDown={press}
              onMouseUp={release}
              onMouseLeave={release}
              disabled={loading}
            >
              {loading ? "Verifying..." : "✅ Verify & Login"}
            </button>
          </>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}

// ... (Estilos se mantienen igual) ...
const containerStyle: any = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "radial-gradient(circle, #1a1a1a 0%, #000 100%)",
  color: "#fff",
  fontFamily: "system-ui"
};

const cardStyle: any = {
  width: 340,
  padding: 30,
  borderRadius: 24,
  background: "#121212",
  border: "1px solid #333",
  boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
  textAlign: "center"
};

const inputStyle: any = {
  width: "100%",
  padding: "14px",
  borderRadius: 12,
  border: "1px solid #333",
  marginBottom: 15,
  background: "#1e1e1e",
  color: "#fff",
  fontSize: 16,
  textAlign: "center"
};

const btnBlue: any = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "none",
  background: "#007bff",
  color: "#fff",
  fontWeight: "bold",
  boxShadow: "0 4px 0 #0056b3",
  transition: "all 0.1s ease"
};

const btnGreen: any = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "none",
  background: "#28a745",
  color: "#fff",
  fontWeight: "bold",
  boxShadow: "0 4px 0 #1e7e34",
  transition: "all 0.1s ease"
};

const press = (e: any) => {
  e.currentTarget.style.transform = "translateY(2px)";
  e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.4)";
};

const release = (e: any) => {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 4px 0 rgba(0,0,0,0.4)";
};