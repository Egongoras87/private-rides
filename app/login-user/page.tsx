"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { ref, get, update, remove } from "firebase/database";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  ConfirmationResult
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginUser() {
  const router = useRouter();
const [mounted, setMounted] = useState(false);
  // Estados de Autenticación
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados PWA / Compatibilidad Móvil
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [appInstalada, setAppInstalada] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);

  // Estado del Temporizador SMS
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  // ---------------------------------------------------
  // CONFIGURACIÓN INICIAL Y DETECCIÓN MÓVIL (PWA)
  // ---------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 📱 Detectar iPhone / iOS de manera segura
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIosDevice(isIos);

    // ✅ Detectar si ya está abierta como App instalada
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone;

    if (standalone) {
      setAppInstalada(true);
    }

    // 📲 Capturar el prompt de instalación (Android/Chrome)
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Si no está instalada, mostramos sugerencia de instalación después del login
    };

    window.addEventListener("beforeinstallprompt", handler);

    // ✅ Detectar instalación completada con éxito
    const handleAppInstalled = () => {
      setAppInstalada(true);
      setShowInstallModal(false);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    setMounted(true); // 👈 Cambia a true solo cuando ya cargó en el cliente (PC o móvil)
  }, []);

  // ---------------------------------------------------
  // CONTROL DEL TEMPORIZADOR SMS
  // ---------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const ultimoEnvio = localStorage.getItem("last_sms_time");
    if (!ultimoEnvio) return;

    const diff = Math.floor((Date.now() - Number(ultimoEnvio)) / 1000);
    if (diff < 60) {
      setSegundosRestantes(60 - diff);
    }
  }, []);

  useEffect(() => {
    if (segundosRestantes <= 0) return;

    const timer = setTimeout(() => {
      setSegundosRestantes((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [segundosRestantes]);

  // ---------------------------------------------------
  // AUTO LOGIN & REDIRECCIÓN DE ROLES
  // ---------------------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      // 🔥 VERIFICAR SI ES DRIVER
      const driverSnap = await get(ref(db, "drivers/" + user.uid));
      const driverData = driverSnap.val();

      // 🚗 SI ES DRIVER -> Se va a su panel de conductor
      if (driverData?.role === "driver") {
        router.replace("/driver");
        return;
      }

      // 👤 USER NORMAL -> Va a la raíz del cliente
      router.replace("/");
    });

    return () => unsub();
  }, [router]);

  // ---------------------------------------------------
  // MANEJO DE INSTALACIÓN MÓVIL
  // ---------------------------------------------------
  const instalarApp = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setAppInstalada(true);
      setShowInstallModal(false);
      continuarApp();
    }
  };

  const continuarApp = () => {
    if (iosDevice && !appInstalada) {
      // Mensaje estructurado de ayuda para usuarios de iPhone (Safari)
      const mensaje = `Welcome to Private Rides 🚗\n\nSave this link:\nhttps://private-rides.vercel.app\n\nOpen it in Safari, tap 'Share' and choose 'Add to Home Screen' to install.`;
      const smsUrl = `sms:?&body=${encodeURIComponent(mensaje)}`;
      window.open(smsUrl);
    }
    router.replace("/");
  };

  // ---------------------------------------------------
  // ENVIAR CÓDIGO SMS (FIREBASE AUTH)
  // ---------------------------------------------------
  const enviarCodigo = async () => {
    if (segundosRestantes > 0) return;

    const limpio = telefono.replace(/\D/g, "");

    if (limpio.length !== 10) {
      alert("Please enter a valid 10-digit US phone number.");
      return;
    }

    setLoading(true);

    try {
      // 🔥 Destruir instancia previa de recaptcha de forma segura si existe
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {
          console.log("Error clearing recaptcha", e);
        }
      }

      const recaptchaContainer = document.getElementById("recaptcha-container");
      if (recaptchaContainer) {
        recaptchaContainer.innerHTML = "";
      }

      // 🔥 Crear nuevo verificado invisible optimizado para web/móvil
      const appVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });

      await appVerifier.render();
      (window as any).recaptchaVerifier = appVerifier;

      const confirmation = await signInWithPhoneNumber(
        auth,
        "+1" + limpio,
        appVerifier
      );

      setConfirm(confirmation);
      localStorage.setItem("last_sms_time", Date.now().toString());
      setSegundosRestantes(60);
    } catch (err: any) {
      console.error("SMS ERROR:", err);
      (window as any).recaptchaVerifier = null;
      alert(err?.message || "Error sending SMS. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------
  // VERIFICACIÓN DEL CÓDIGO SMS RECIBIDO
  // ---------------------------------------------------
  const verificarCodigo = async () => {
    if (!codigo || !confirm) {
      alert("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const result = await confirm.confirm(codigo);
      const user = result.user;

      // 👤 GUARDAR ROL DE USUARIO EN LA DATABASE
      await update(ref(db, "usuarios/" + user.uid), {
        uid: user.uid,
        telefono: user.phoneNumber,
        role: "user",
        lastSeen: Date.now()
      });

      // 🔥 ELIMINAR DE DRIVERS POR SEGURIDAD SI ENTRA POR ESTE PANEL
      await remove(ref(db, "drivers/" + user.uid));

      // 📲 Evaluar si necesita ver el cartel para añadir como App de celular
      if (!appInstalada) {
        setShowInstallModal(true);
      } else {
        router.replace("/");
      }
    } catch (err) {
      console.error(err);
      alert("Invalid code. Please verify and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------
  // FEEDBACK DE BOTONES (EFECTOS TOUCH / CLICK)
  // ---------------------------------------------------
  const press = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "scale(0.97)";
    e.currentTarget.style.boxShadow = "0 2px 0 #000";
  };

  const release = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "scale(1)";
    const isGreen = e.currentTarget.id === "btn-verify";
    e.currentTarget.style.boxShadow = isGreen
      ? "0 4px 0 #1e7e34"
      : "0 4px 0 #0056b3";
  };
  if (!mounted) {
    return <div style={containerStyle}>Loading...</div>; // Evita el choque de SSR en PC
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
       <h2 style={{ marginBottom: 5 }}>
  Welcome to Private Rides.
</h2>

<p
  style={{
    color: "#888",
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 1.5
  }}
>
  Enter your phone number to create your account.
</p>

        <div style={labelStyle}>Phone Number</div>
        <input
          type="tel"
          placeholder="702 000 0000"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          style={inputStyle}
          disabled={loading}
        />

        <button
          onClick={enviarCodigo}
          onMouseDown={press}
          onMouseUp={release}
          onMouseLeave={release}
          disabled={loading || segundosRestantes > 0}
          style={{
            ...btnBlue,
            opacity: loading ? 0.6 : 1,
            background: segundosRestantes > 0 ? "#333" : "#007bff"
          }}
        >
          {loading
            ? "Sending..."
            : segundosRestantes > 0
            ? `Wait ${segundosRestantes}s`
            : confirm
            ? "Resend Code"
            : "Send SMS"}
        </button>

        {confirm && (
          <div style={{ marginTop: 25 }}>
            <div style={{ ...labelStyle, color: "#28a745" }}>
              Verification Code
            </div>
            <input
              type="text"
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              style={inputStyle}
              maxLength={6}
            />

            <button
              id="btn-verify"
              onClick={verificarCodigo}
              onMouseDown={press}
              onMouseUp={release}
              onMouseLeave={release}
              disabled={loading}
              style={btnGreen}
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
          </div>
        )}

        {/* CONTENEDOR OBLIGATORIO PARA CAPTCHA INVISIBLE */}
        <div id="recaptcha-container" style={{ marginTop: 10 }}></div>

        <div style={footerLinks}>
          <a href="/privacy" style={linkStyle}>Privacy</a>
          <span style={{ color: "#444" }}>|</span>
          <a href="/terms" style={linkStyle}>Terms</a>
        </div>
      </div>

      {/* MODAL DE INSTALACIÓN PWA (OPTIMIZADO PARA IOS Y ANDROID) */}
      {showInstallModal && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h3>📲 Install App</h3>
            <p style={{ fontSize: 14, color: "#bbb", margin: "10px 0 20px" }}>
              {iosDevice
                ? "Install Private Rides on your iPhone: tap share and add to home screen."
                : "Install our app for instant access and luxury experience directly from your screen."}
            </p>
            {installPrompt ? (
              <button onClick={instalarApp} style={btnGreen}>
                Install Now
              </button>
            ) : (
              <button onClick={continuarApp} style={btnBlue}>
                Continue in Browser
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------
// ESTILOS DE LA INTERFAZ (CSS-IN-JS)
// ---------------------------------------------------
const labelStyle: React.CSSProperties = {
  textAlign: "left",
  marginBottom: 5,
  fontSize: 12,
  color: "#007bff",
  fontWeight: "bold",
  marginLeft: 5
};

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#000",
  color: "#fff",
  fontFamily: "system-ui"
};

const cardStyle: React.CSSProperties = {
  width: 340,
  padding: "40px 30px",
  borderRadius: 28,
  background: "#111",
  border: "1px solid #222",
  boxShadow: "0 25px 50px rgba(0,0,0,0.9)",
  textAlign: "center"
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  border: "1px solid #333",
  marginBottom: 15,
  background: "#000",
  color: "#fff",
  fontSize: 18,
  textAlign: "center",
  outline: "none"
};

const btnBlue: React.CSSProperties = {
  width: "100%",
  padding: 15,
  borderRadius: 14,
  border: "none",
  background: "#007bff",
  color: "#fff",
  fontWeight: "bold",
  boxShadow: "0 4px 0 #0056b3",
  cursor: "pointer",
  transition: "all 0.1s"
};

const btnGreen: React.CSSProperties = {
  width: "100%",
  padding: 15,
  borderRadius: 14,
  border: "none",
  background: "#28a745",
  color: "#fff",
  fontWeight: "bold",
  boxShadow: "0 4px 0 #1e7e34",
  cursor: "pointer",
  transition: "all 0.1s"
};

const footerLinks: React.CSSProperties = {
  marginTop: 30,
  display: "flex",
  justifyContent: "center",
  gap: 15,
  fontSize: 12
};

const linkStyle: React.CSSProperties = {
  color: "#666",
  textDecoration: "none"
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.85)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
  padding: 20
};

const modalCardStyle: React.CSSProperties = {
  background: "#161616",
  padding: 30,
  borderRadius: 24,
  width: "100%",
  maxWidth: 320,
  textAlign: "center",
  border: "1px solid #333",
  boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
};