"use client";

import { useState, useEffect } from "react";
import {
  auth,
  db
} from "@/lib/firebase";
import {
  ref,
  get,
  update
} from "firebase/database";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  ConfirmationResult
} from "firebase/auth";

import { useRouter } from "next/navigation";
import { remove } from "firebase/database";


export default function LoginUser() {

  const router = useRouter();

  const [telefono, setTelefono] =
    useState("");

  const [codigo, setCodigo] =
    useState("");

  const [confirm, setConfirm] =
    useState<ConfirmationResult | null>(null);

  const [loading, setLoading] =
    useState(false);
const [showInstallModal, setShowInstallModal] =
  useState(false);

const [installPrompt, setInstallPrompt] =
  useState<any>(null);

const [appInstalada, setAppInstalada] =
  useState(false);

const [iosDevice, setIosDevice] =
  useState(false);


  const [segundosRestantes, setSegundosRestantes] =
    useState(0);

  // ---------------------------------------------------
  // SMS TIMER
  // ---------------------------------------------------

  useEffect(() => {

    const ultimoEnvio =
      localStorage.getItem(
        "last_sms_time"
      );

    if (!ultimoEnvio) return;

    const diff =
      Math.floor(
        (
          Date.now() -
          Number(ultimoEnvio)
        ) / 1000
      );

    if (diff < 60) {

      setSegundosRestantes(
        60 - diff
      );
    }

  }, []);

  // ---------------------------------------------------
  // TIMER LOOP
  // ---------------------------------------------------

  useEffect(() => {

    if (
      segundosRestantes <= 0
    ) return;

    const timer =
      setTimeout(() => {

        setSegundosRestantes(
          prev => prev - 1
        );

      }, 1000);

    return () =>
      clearTimeout(timer);

  }, [segundosRestantes]);

  // ---------------------------------------------------
  // AUTO LOGIN
  // ---------------------------------------------------
useEffect(() => {

  const unsub =
    onAuthStateChanged(
      auth,
      async (user) => {

        if (!user) return;

        // 🔥 VERIFICAR SI ES DRIVER
        const driverSnap =
          await get(
            ref(
              db,
              "drivers/" + user.uid
            )
          );

        const driverData =
          driverSnap.val();

        // 🚗 SI ES DRIVER
        if (
          driverData?.role ===
          "driver"
        ) {

          router.replace(
            "/driver"
          );

          return;
        }

        // 👤 USER NORMAL
        router.replace("/");

      }
    );

  return () => unsub();
// DETECTAR PWA INSTALADA//
}, [router]);
useEffect(() => {

  // 📱 Detectar iPhone
  const isIos =
    /iphone|ipad|ipod/i.test(
      window.navigator.userAgent
    );

  setIosDevice(isIos);

  // ✅ Detectar app instalada
  const standalone =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    (window.navigator as any)
      .standalone;

  if (standalone) {

    setAppInstalada(true);
  }

  // 📲 Capturar install prompt
  const handler = (e: any) => {

    e.preventDefault();

    setInstallPrompt(e);
  };

  window.addEventListener(
    "beforeinstallprompt",
    handler
  );

  // ✅ Detectar instalación completada
  window.addEventListener(
    "appinstalled",
    () => {

      setAppInstalada(true);

      setShowInstallModal(false);
    }
  );

  return () => {

    window.removeEventListener(
      "beforeinstallprompt",
      handler
    );
  };

}, []);

const continuarApp = () => {

  // 📩 Abrir SMS con link app
  const mensaje =
`Welcome to Private Rides 🚗

Save this link:
https://private-rides.vercel.app

Install the app for faster future access.`;

  const smsUrl =
    `sms:?&body=${encodeURIComponent(mensaje)}`;

  window.open(smsUrl);

  // 🚀 Entrar app
  router.replace("/");
};

  // ---------------------------------------------------
  // ENVIAR SMS
  // ---------------------------------------------------

  const enviarCodigo =
    async () => {

      if (
        segundosRestantes > 0
      ) return;

      const limpio =
        telefono.replace(
          /\D/g,
          ""
        );

      if (
        limpio.length !== 10
      ) {

        alert(
          "Enter a valid US number"
        );

        return;
      }

      setLoading(true);

      try {

     let appVerifier =
  (window as any)
    .recaptchaVerifier;

// 🔥 CREAR SOLO UNA VEZ
if (!appVerifier) {

  appVerifier =
    new RecaptchaVerifier(

      auth,

      "recaptcha-container",

      {
        size: "invisible"
      }
    );

  await appVerifier.render();

  (
    window as any
  ).recaptchaVerifier =
    appVerifier;
}

        // ---------------------------------------------------
        // SEND SMS
        // ---------------------------------------------------

        const confirmation =
          await signInWithPhoneNumber(

            auth,

            "+1" + limpio,

            appVerifier
          );

        setConfirm(
          confirmation
        );

        localStorage.setItem(
          "last_sms_time",
          Date.now().toString()
        );

        setSegundosRestantes(
          60
        );

      } catch (err: any) {

        console.error(
          "SMS ERROR:",
          err
        );

        // 🔥 RESET RECAPTCHA
        (
          window as any
        ).recaptchaVerifier =
          null;

        alert(
          err?.message ||
          "SMS Error"
        );

      } finally {

        setLoading(false);
      }
    };

    //INSTALAR APP//
const instalarApp = async () => {

  if (!installPrompt) return;

  installPrompt.prompt();

  const choice =
    await installPrompt.userChoice;

  if (
    choice.outcome === "accepted"
  ) {

    setAppInstalada(true);

    setShowInstallModal(false);

    continuarApp();
  }
};
  // ---------------------------------------------------
  // VERIFY CODE
  // ---------------------------------------------------

  const verificarCodigo =
  async () => {

    if (
      !codigo ||
      !confirm
    ) {

      alert(
        "Enter code"
      );

      return;
    }

    setLoading(true);

    try {

      const result =
        await confirm.confirm(
          codigo
        );

      const user =
        result.user;

      // 👤 SAVE USER ROLE
      await update(
  ref(
    db,
    "usuarios/" + user.uid
  ),
  {
    uid: user.uid,
    telefono: user.phoneNumber,
    role: "user",
    lastSeen: Date.now()
  }
);

// 🔥 ELIMINAR DRIVER
await remove(
  ref(db, "drivers/" + user.uid)
);

setShowInstallModal(true);

    } catch (err) {

      console.error(err);

      alert(
        "Invalid code"
      );

    } finally {

      setLoading(false);
    }
  };
  // ---------------------------------------------------
  // BUTTON FX
  // ---------------------------------------------------

  const press =
    (e: any) => {

      e.currentTarget.style.transform =
        "scale(0.97)";

      e.currentTarget.style.boxShadow =
        "0 2px 0 #000";
    };

  const release =
    (e: any) => {

      e.currentTarget.style.transform =
        "scale(1)";

      const green =
        e.currentTarget.id ===
        "btn-verify";

      e.currentTarget.style.boxShadow =
        green
          ? "0 4px 0 #1e7e34"
          : "0 4px 0 #0056b3";
    };

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------

  return (

    <div style={containerStyle}>

      <div style={cardStyle}>

        <h2 style={{
          marginBottom: 5
        }}>
          🚗 Private Rides
        </h2>

        <p style={{
          color: "#888",
          fontSize: 13,
          marginBottom: 20
        }}>
          Las Vegas Premium Service
        </p>

        <div style={labelStyle}>
          Phone Number
        </div>

        <input
          type="tel"
          placeholder="702 000 0000"
          value={telefono}
          onChange={(e) =>
            setTelefono(
              e.target.value
            )
          }
          style={inputStyle}
          disabled={
            loading
          }
        />

        <button
          onClick={enviarCodigo}
          onMouseDown={press}
          onMouseUp={release}
          onMouseLeave={release}
          disabled={
            loading ||
            segundosRestantes > 0
          }
          style={{
            ...btnBlue,

            opacity:
              loading
              ? 0.6
              : 1,

            background:
              segundosRestantes > 0
              ? "#333"
              : "#007bff"
          }}
        >

          {
            loading
            ? "Sending..."
            : segundosRestantes > 0
            ? `Wait ${segundosRestantes}s`
            : confirm
            ? "Resend Code"
            : "Send SMS"
          }

        </button>

        {confirm && (

          <div style={{
            marginTop: 25
          }}>

            <div style={{
              ...labelStyle,
              color: "#28a745"
            }}>
              Verification Code
            </div>

            <input
              type="text"
              placeholder="000000"
              value={codigo}
              onChange={(e) =>
                setCodigo(
                  e.target.value
                )
              }
              style={inputStyle}
              maxLength={6}
            />

            <button
              id="btn-verify"
              onClick={
                verificarCodigo
              }
              onMouseDown={press}
              onMouseUp={release}
              onMouseLeave={release}
              disabled={loading}
              style={btnGreen}
            >

              {
                loading
                ? "Verifying..."
                : "Verify & Login"
              }

            </button>

          </div>
        )}

        {/* 🔥 REQUIRED */}
        <div
          id="recaptcha-container"
          style={{
            marginTop: 10
          }}
        ></div>

        <div style={footerLinks}>

          <a
            href="/privacy"
            style={linkStyle}
          >
            Privacy
          </a>

          <span style={{
            color: "#444"
          }}>
            |
          </span>

          <a
            href="/terms"
            style={linkStyle}
          >
            Terms
          </a>

        </div>

      </div>

    </div>
  );
}

// ---------------------------------------------------
// STYLES
// ---------------------------------------------------

const labelStyle: any = {
  textAlign: "left",
  marginBottom: 5,
  fontSize: 12,
  color: "#007bff",
  fontWeight: "bold",
  marginLeft: 5
};

const containerStyle: any = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#000",
  color: "#fff",
  fontFamily: "system-ui"
};

const cardStyle: any = {
  width: 340,
  padding: "40px 30px",
  borderRadius: 28,
  background: "#111",
  border: "1px solid #222",
  boxShadow: "0 25px 50px rgba(0,0,0,0.9)",
  textAlign: "center"
};

const inputStyle: any = {
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

const btnBlue: any = {
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

const btnGreen: any = {
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

const footerLinks: any = {
  marginTop: 30,
  display: "flex",
  justifyContent: "center",
  gap: 15,
  fontSize: 12
};

const linkStyle: any = {
  color: "#666",
  textDecoration: "none"
};