"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from "firebase/auth";
import { ref, update, get } from "firebase/database";

export default function Login() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<any>(null);

  // ===================================================
  // 🔥 AUTO LOGIN (Persistencia - Una sola vez)
  // ===================================================
  useEffect(() => {
    // Aseguramos que la sesión persista en el navegador
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setLoadingAuth(false);
          return;
        }

        // Si hay usuario autenticado, verificamos si es un driver en la BD
        const driverSnap = await get(ref(db, "drivers/" + user.uid));
        const driverData = driverSnap.val();

        if (driverData && driverData.role === "driver") {
          router.replace("/driver");
        } else {
          // Si no es driver (ej. es un cliente normal), lo dejamos aquí o lo sacamos
          setLoadingAuth(false);
        }
      } catch (err) {
        console.error("ERROR EN AUTOLOGIN:", err);
        setLoadingAuth(false);
      }
    });

    return () => unsub();
  }, [router]);

  // ===================================================
  // 🔥 INICIALIZAR RECAPTCHA
  // ===================================================
  useEffect(() => {
    if (typeof window !== "undefined" && !recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current = new (RecaptchaVerifier as any)(
          "recaptcha-container",
          {
            size: "normal",
            callback: () => {
              console.log("✅ reCAPTCHA resuelto");
            }
          },
          auth
        );
        recaptchaVerifierRef.current.render();
      } catch (err) {
        console.error("ERROR INIT RECAPTCHA:", err);
      }
    }
  }, []);

  // ===================================================
  // 🔥 PASO 1: ENVIAR SMS (Lógica exacta del User)
  // ===================================================
  const sendSMS = async () => {
    const limpio = phone.replace(/\D/g, "");

    if (limpio.length !== 10) {
      alert("Please enter a valid 10-digit US phone number.");
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = "+1" + limpio;
      
      // 🔥 1. Destruir instancia previa de recaptcha de forma segura si existe
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {
          console.log("Error clearing recaptcha", e);
        }
      }

      // 🔥 2. Limpiar el DOM (Crucial en Next.js para evitar choques)
      const recaptchaContainer = document.getElementById("recaptcha-container");
      if (recaptchaContainer) {
        recaptchaContainer.innerHTML = "";
      }

      // 🔥 3. Crear nuevo verificador invisible
      const appVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });

      // 🔥 4. FORZAR RENDERIZADO ANTES DE ENVIAR (Esto evitaba el error en el User)
      await appVerifier.render();
      (window as any).recaptchaVerifier = appVerifier;

      // 🔥 5. Enviar SMS
      const confirmation = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        appVerifier
      );

      setConfirmationResult(confirmation);
      setStep(2);

    } catch (err: any) {
      console.error("SMS ERROR:", err);
      (window as any).recaptchaVerifier = null;
      alert(err?.message || "Error sending SMS. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // 🔥 PASO 2: VERIFICAR CÓDIGO Y BASE DE DATOS
  // ===================================================
  const verifyOTP = async () => {
    if (!otp || !confirmationResult) {
      alert("Ingresa el código de verificación");
      return;
    }

    setLoading(true);

    try {
      // 1. Verificamos el código con Firebase Auth
      const result = await confirmationResult.confirm(otp);
      const user = result.user;

      if (!user) throw new Error("Usuario no encontrado");

      // 2. Verificamos la Base de Datos para ver si ya existe
      const driverRef = ref(db, `drivers/${user.uid}`);
      const snapshot = await get(driverRef);

      const driverData = {
        uid: user.uid,
        telefono: user.phoneNumber,
        role: "driver",
        lastSeen: Date.now(),
        online: true,
        activo: true,
        
        // Si NO existe en la base de datos, le creamos el perfil inicial
        ...(!snapshot.exists() && {
          nombre: "Nuevo Driver",
          rating: 5,
          viajesCompletados: 0,
          carro: { marca: "", modelo: "", color: "", placa: "" }
        })
      };

      // 3. Guardamos/Actualizamos datos
      await update(driverRef, driverData);

      // 4. Redirigimos al panel
      router.replace("/driver");

    } catch (err: any) {
      console.error("ERROR VERIFICANDO OTP:", err);
      alert("Código inválido o expirado");
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // 🔥 EFECTOS DE BOTONES
  // ===================================================
  const press = (e: any) => {
    e.currentTarget.style.transform = "scale(0.96)";
    e.currentTarget.style.boxShadow = "0 2px 0 #000";
  };

  const release = (e: any) => {
    e.currentTarget.style.transform = "scale(1)";
    const isGreen = e.currentTarget.id === "btn-confirm";
    e.currentTarget.style.boxShadow = isGreen ? "0 5px 0 #1e7e34" : "0 5px 0 #003f8a";
  };

  // ===================================================
  // 🔥 UI - PANTALLA DE CARGA INICIAL
  // ===================================================
  if (loadingAuth) {
    return (
      <div style={{
        background: "#000", color: "#fff", height: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
      }}>
        Verificando sesión...
      </div>
    );
  }

  // ===================================================
  // 🔥 UI PRINCIPAL
  // ===================================================
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: 20 }}>
          {step === 1 ? "🚗 Driver Login" : "📩 Verify SMS"}
        </h2>

        {step === 1 ? (
          <>
            <p style={subLabel}>Enter your phone number</p>
            <input
              type="tel"
              placeholder="7020000000"
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
              {loading ? "Sending..." : "Continue"}
            </button>
          </>
        ) : (
          <>
            <p style={subLabel}>
              Code sent to:<br /><b>{phone}</b>
            </p>
            <input
              type="number"
              placeholder="123456"
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
              {loading ? "Verifying..." : "Confirm Code"}
            </button>
            <p onClick={() => setStep(1)} style={changePhoneStyle}>
              Change number
            </p>
          </>
        )}

        <p style={footerStyle}>Welcom to Private Rides</p>
      </div>

      {/* 🔥 Contenedor donde Firebase inyecta el reCAPTCHA */}
      <div id="recaptcha-container" style={{ marginTop: 20 }}></div>
    </div>
  );
}

// ===================================================
// 🔥 STYLES (Mantenidos exactos a tu versión original)
// ===================================================
const changePhoneStyle: React.CSSProperties = {
  marginTop: 15, cursor: "pointer", fontSize: 13,
  color: "#007bff", textDecoration: "underline"
};

const footerStyle: React.CSSProperties = {
  marginTop: 25, fontSize: 11, color: "#555",
  letterSpacing: 2, fontWeight: "bold"
};

const containerStyle: React.CSSProperties = {
  minHeight: "100vh", display: "flex", flexDirection: "column",
  justifyContent: "center", alignItems: "center",
  background: "radial-gradient(circle,#1a1a1a 0%,#050505 100%)",
  color: "#fff", padding: 20
};

const cardStyle: React.CSSProperties = {
  width: "100%", maxWidth: 340, padding: "40px 30px",
  borderRadius: 24, background: "#141414",
  boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
  border: "1px solid #222", textAlign: "center"
};

const subLabel: React.CSSProperties = {
  fontSize: 14, color: "#888", marginBottom: 15
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: 16, borderRadius: 12, border: "1px solid #333",
  marginBottom: 20, background: "#000", color: "#fff",
  fontSize: 18, textAlign: "center", outline: "none"
};

const btnBlue: React.CSSProperties = {
  width: "100%", padding: 15, borderRadius: 12, border: "none",
  background: "#007bff", color: "#fff", fontWeight: "bold",
  fontSize: 16, cursor: "pointer", transition: "all 0.1s",
  boxShadow: "0 5px 0 #003f8a"
};

const btnGreen: React.CSSProperties = {
  width: "100%", padding: 15, borderRadius: 12, border: "none",
  background: "#28a745", color: "#fff", fontWeight: "bold",
  fontSize: 16, cursor: "pointer", transition: "all 0.1s",
  boxShadow: "0 5px 0 #1e7e34"
};