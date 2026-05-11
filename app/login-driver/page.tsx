"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { ref, update, get } from "firebase/database";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

export default function Login() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 1. CONFIGURAR PERSISTENCIA Y RECAPTCHA
  useEffect(() => {
    // Asegura que la sesión dure para siempre en este dispositivo
    setPersistence(auth, browserLocalPersistence);

    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }

    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  

  const sendSMS = async () => {
    if (!phone || phone.length < 10) {
      alert("Ingresa un número válido de 10 dígitos");
      return;
    }

    setLoading(true);
    try {
      const appVerifier = window.recaptchaVerifier;
      const cleaned = phone.replace(/\s/g, "");
      const formattedPhone = cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep(2);
    } catch (err: any) {
      console.error(err);
      alert("Error al enviar SMS. Verifica tu conexión.");
      // Reiniciar recaptcha si falla
      if (window.recaptchaVerifier) window.recaptchaVerifier.render();
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || !confirmationResult) {
      alert("Ingresa el código de 6 dígitos");
      return;
    }

    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;

      if (!user) throw new Error("Usuario no encontrado");

      // 2. ACTUALIZAR O CREAR PERFIL DE CONDUCTOR
      const driverRef = ref(db, `drivers/${user.uid}`);
      const snapshot = await get(driverRef);

     const driverData = {
  uid: user.uid,
  telefono: user.phoneNumber,
  role: "driver", // 🔥 NUEVO
  lastSeen: Date.now(),
  online: true,
  activo: true,
        // Solo guardamos estos datos si es la primera vez (nuevo registro)
        ...(!snapshot.exists() && {
          nombre: "Nuevo Driver",
          rating: 5,
          viajesCompletados: 0,
          carro: { marca: "", modelo: "", color: "", placa: "" }
        })
      };

      await update(driverRef, driverData);

      // 3. REDIRECCIÓN SEGURA
      // Usamos replace para que no pueda volver al login con el botón 'atrás'
      router.replace("/driver"); 

    } catch (err: any) {
      console.error(err);
      alert("Código incorrecto o expirado");
    } finally {
      setLoading(false);
    }
  };

  // --- UI RENDER (Se mantiene igual a tu diseño original) ---
  const press = (e: any) => {
    e.currentTarget.style.transform = "scale(0.96)";
    e.currentTarget.style.boxShadow = "0 2px 0 #000";
  };

  const release = (e: any) => {
    e.currentTarget.style.transform = "scale(1)";
    const isGreen = e.currentTarget.id === "btn-confirm";
    e.currentTarget.style.boxShadow = isGreen ? "0 5px 0 #1e7e34" : "0 5px 0 #003f8a";
  };

  return (
    <div style={containerStyle}>
      <div id="recaptcha-container"></div>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: 20 }}>
          {step === 1 ? "🚗 Driver Login" : "📩 Verificar SMS"}
        </h2>

        {step === 1 ? (
          <>
            <p style={subLabel}>Ingresa tu número de teléfono</p>
            <input
              type="tel"
              placeholder="702 000 0000"
              value={phone}
              maxLength={10}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
            <button
              onClick={sendSMS}
              disabled={loading}
              style={btnBlue}
              onMouseDown={press}
              onMouseUp={release}
              onMouseLeave={release}
            >
              {loading ? "Enviando..." : "Siguiente"}
            </button>
          </>
        ) : (
          <>
            <p style={subLabel}>Código enviado a: <br /> <b>{phone}</b></p>
            <input
              type="number"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={inputStyle}
            />
            <button
              id="btn-confirm"
              onClick={verifyOTP}
              disabled={loading}
              style={btnGreen}
              onMouseDown={press}
              onMouseUp={release}
              onMouseLeave={release}
            >
              {loading ? "Verificando..." : "Confirmar Código"}
            </button>
            <p onClick={() => setStep(1)} style={changePhoneStyle}>
              Cambiar número
            </p>
          </>
        )}
        <p style={footerStyle}>PRIVATE RIDES LAS VEGAS</p>
      </div>
    </div>
  );
}

// --- ESTILOS ADICIONALES/CORREGIDOS ---
const changePhoneStyle: React.CSSProperties = {
  marginTop: 15,
  cursor: "pointer",
  fontSize: 13,
  color: "#007bff",
  textDecoration: "underline"
};

const footerStyle: React.CSSProperties = {
  marginTop: 25,
  fontSize: 11,
  color: "#555",
  letterSpacing: 2,
  fontWeight: "bold"
};

// Los estilos containerStyle, cardStyle, inputStyle, btnBlue y btnGreen se mantienen igual a tu código original.
const containerStyle: React.CSSProperties = { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "radial-gradient(circle, #1a1a1a 0%, #050505 100%)", color: "#fff", padding: 20 };
const cardStyle: React.CSSProperties = { width: "100%", maxWidth: 340, padding: "40px 30px", borderRadius: 24, background: "#141414", boxShadow: "0 20px 50px rgba(0,0,0,0.8)", border: "1px solid #222", textAlign: "center" };
const subLabel: React.CSSProperties = { fontSize: 14, color: "#888", marginBottom: 15 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 16, borderRadius: 12, border: "1px solid #333", marginBottom: 20, background: "#000", color: "#fff", fontSize: 18, textAlign: "center", outline: "none" };
const btnBlue: React.CSSProperties = { width: "100%", padding: 15, borderRadius: 12, border: "none", background: "#007bff", color: "#fff", fontWeight: "bold", fontSize: 16, cursor: "pointer", transition: "all 0.1s", boxShadow: "0 5px 0 #003f8a" };
const btnGreen: React.CSSProperties = { width: "100%", padding: 15, borderRadius: 12, border: "none", background: "#28a745", color: "#fff", fontWeight: "bold", fontSize: 16, cursor: "pointer", transition: "all 0.1s", boxShadow: "0 5px 0 #1e7e34" };