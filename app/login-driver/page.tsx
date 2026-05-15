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

import {
  ref,
  update,
  get
} from "firebase/database";

export default function Login() {

  const router = useRouter();

  const [phone, setPhone] =
    useState("");

  const [otp, setOtp] =
    useState("");

  const [step, setStep] =
    useState(1);

  const [loading, setLoading] =
    useState(false);

  const [loadingAuth, setLoadingAuth] =
    useState(true);

  const [
    confirmationResult,
    setConfirmationResult
  ] = useState<ConfirmationResult | null>(null);

  // 🔥 DEV MODE TEMPORAL
  const DEV_MODE = true;

  // 🔥 RECAPTCHA STABLE
  const recaptchaVerifierRef =
    useRef<any>(null);

  // ===================================================
  // 🔥 AUTO LOGIN
  // ===================================================

  useEffect(() => {

    const unsub =
      onAuthStateChanged(

        auth,

        async (user) => {

          try {

            if (!user) {

              setLoadingAuth(false);

              return;
            }

            const driverSnap =
              await get(
                ref(
                  db,
                  "drivers/" +
                    user.uid
                )
              );

            const driverData =
              driverSnap.val();

            // 🚗 driver
            if (
              driverData?.role ===
              "driver"
            ) {

              router.replace(
                "/driver"
              );

              return;
            }

            // 👤 user
            router.replace("/");

          } catch (err) {

            console.error(
              "AUTOLOGIN ERROR:",
              err
            );

          } finally {

            setLoadingAuth(false);
          }
        }
      );

    return () => unsub();

  }, [router]);

  // ===================================================
  // 🔥 INIT
  // ===================================================

  useEffect(() => {

    const init =
      async () => {

        try {

          // 🔥 persistence
          await setPersistence(
            auth,
            browserLocalPersistence
          );

          // 🔥 recaptcha
          if (
            typeof window !==
            "undefined" &&
            !recaptchaVerifierRef.current
          ) {

            recaptchaVerifierRef.current =

              new (RecaptchaVerifier as any)(

                "recaptcha-container",

                {
                  size: "normal"
                },

                auth
              );

            await recaptchaVerifierRef.current
              .render();

            console.log(
              "✅ RECAPTCHA READY"
            );
          }

        } catch (err) {

          console.error(
            "INIT ERROR:",
            err
          );
        }
      };

    init();

  }, []);

  // ===================================================
  // 🔥 SEND SMS
  // ===================================================

  const sendSMS =
    async () => {

      const cleaned =
        phone.replace(
          /\D/g,
          ""
        );

      if (
        cleaned.length !== 10
      ) {

        alert(
          "Enter valid US number"
        );

        return;
      }

      setLoading(true);

      try {

        // ===================================================
        // 🔥 DEV MODE
        // ===================================================

        if (DEV_MODE) {

          setTimeout(() => {

            setConfirmationResult({

              confirm: async () => ({

                user: {

                  uid:
                    "dev-driver",

                  phoneNumber:
                    "+17020000000"
                }

              })

            } as any);

            setStep(2);

            setLoading(false);

          }, 700);

          return;
        }

        // ===================================================
        // 🔥 REAL SMS
        // ===================================================

        const formattedPhone =
          cleaned.startsWith("+1")
            ? cleaned
            : `+1${cleaned}`;

        const confirmation =
          await signInWithPhoneNumber(

            auth,

            formattedPhone,

            recaptchaVerifierRef.current
          );

        setConfirmationResult(
          confirmation
        );

        setStep(2);

      } catch (err: any) {

        console.error(
          "SMS ERROR:",
          err
        );

        alert(
          err?.message ||
          "SMS Error"
        );

      } finally {

        setLoading(false);
      }
    };

  // ===================================================
  // 🔥 VERIFY OTP
  // ===================================================

  const verifyOTP =
    async () => {

      if (
        !otp ||
        !confirmationResult
      ) {

        alert(
          "Enter verification code"
        );

        return;
      }

      setLoading(true);

      try {

        const result =
          await confirmationResult.confirm(
            otp
          );

        const user =
          result.user;

        if (!user) {

          throw new Error(
            "User not found"
          );
        }

        // ===================================================
        // 🔥 DRIVER PROFILE
        // ===================================================

        const driverRef =
          ref(
            db,
            `drivers/${user.uid}`
          );

        const snapshot =
          await get(driverRef);

        const driverData = {

          uid: user.uid,

          telefono:
            user.phoneNumber,

          role: "driver",

          lastSeen:
            Date.now(),

          online: true,

          activo: true,

          // 🔥 first login only
          ...(!snapshot.exists() && {

            nombre:
              "Nuevo Driver",

            rating: 5,

            viajesCompletados: 0,

            carro: {

              marca: "",

              modelo: "",

              color: "",

              placa: ""
            }
          })
        };

        await update(
          driverRef,
          driverData
        );

        // ===================================================
        // 🔥 REDIRECT
        // ===================================================

        setTimeout(() => {

          router.replace(
            "/driver"
          );

        }, 1000);

      } catch (err) {

        console.error(
          "VERIFY ERROR:",
          err
        );

        alert(
          "Invalid or expired code"
        );

      } finally {

        setLoading(false);
      }
    };

  // ===================================================
  // 🔥 BUTTON FX
  // ===================================================

  const press = (e: any) => {

    e.currentTarget.style.transform =
      "scale(0.96)";

    e.currentTarget.style.boxShadow =
      "0 2px 0 #000";
  };

  const release = (e: any) => {

    e.currentTarget.style.transform =
      "scale(1)";

    const isGreen =
      e.currentTarget.id ===
      "btn-confirm";

    e.currentTarget.style.boxShadow =
      isGreen
        ? "0 5px 0 #1e7e34"
        : "0 5px 0 #003f8a";
  };

  // ===================================================
  // 🔥 AUTH LOADING
  // ===================================================

  if (loadingAuth) {

    return (

      <div
        style={{
          background: "#000",
          color: "#fff",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18
        }}
      >
        Loading...
      </div>
    );
  }

  // ===================================================
  // 🔥 UI
  // ===================================================

  return (

    <div style={containerStyle}>

      <div style={cardStyle}>

        <h2 style={{ marginBottom: 20 }}>

          {step === 1
            ? "🚗 Driver Login"
            : "📩 Verify SMS"}

        </h2>

        {step === 1 ? (

          <>

            <p style={subLabel}>
              Enter your phone number
            </p>

            <input
              type="tel"
              placeholder="7020000000"
              value={phone}
              maxLength={10}
              onChange={(e) =>
                setPhone(
                  e.target.value
                )
              }
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

              {loading
                ? "Sending..."
                : "Continue"}

            </button>

          </>

        ) : (

          <>

            <p style={subLabel}>

              Code sent to:

              <br />

              <b>{phone}</b>

            </p>

            <input
              type="number"
              placeholder="123456"
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value
                )
              }
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

              {loading
                ? "Verifying..."
                : "Confirm Code"}

            </button>

            <p
              onClick={() =>
                setStep(1)
              }
              style={changePhoneStyle}
            >
              Change number
            </p>

          </>
        )}

        <p style={footerStyle}>
          PRIVATE RIDES LAS VEGAS
        </p>

      </div>

      {/* 🔥 RECAPTCHA */}

      <div
        id="recaptcha-container"
      ></div>

    </div>
  );
}

// ===================================================
// 🔥 STYLES
// ===================================================

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

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background:
    "radial-gradient(circle,#1a1a1a 0%,#050505 100%)",
  color: "#fff",
  padding: 20
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 340,
  padding: "40px 30px",
  borderRadius: 24,
  background: "#141414",
  boxShadow:
    "0 20px 50px rgba(0,0,0,0.8)",
  border: "1px solid #222",
  textAlign: "center"
};

const subLabel: React.CSSProperties = {
  fontSize: 14,
  color: "#888",
  marginBottom: 15
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #333",
  marginBottom: 20,
  background: "#000",
  color: "#fff",
  fontSize: 18,
  textAlign: "center",
  outline: "none"
};

const btnBlue: React.CSSProperties = {
  width: "100%",
  padding: 15,
  borderRadius: 12,
  border: "none",
  background: "#007bff",
  color: "#fff",
  fontWeight: "bold",
  fontSize: 16,
  cursor: "pointer",
  transition: "all 0.1s",
  boxShadow: "0 5px 0 #003f8a"
};

const btnGreen: React.CSSProperties = {
  width: "100%",
  padding: 15,
  borderRadius: 12,
  border: "none",
  background: "#28a745",
  color: "#fff",
  fontWeight: "bold",
  fontSize: 16,
  cursor: "pointer",
  transition: "all 0.1s",
  boxShadow: "0 5px 0 #1e7e34"
};