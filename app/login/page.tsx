"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

import { ref, update, onValue } from "firebase/database";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [perfil, setPerfil] = useState<any>(null);

  const router = useRouter();

  // 🔐 LOGIN
  const login = async () => {
    if (!email || !pass) {
      alert("Completa todos los campos");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);

      const user = auth.currentUser;

      if (user) {
        await update(ref(db, "drivers/" + user.uid), {
          uid: user.uid,
          nombre: user.email || "Driver",
          telefono: user.phoneNumber || "",

          carro: {
            marca: "Toyota",
            modelo: "Camry",
            color: "Blanco",
            placa: "PENDIENTE"
          },

          rating: 5,
          viajesCompletados: 0,

          activo: true,
          online: true,
          lastSeen: Date.now()
        });
      }

      const redirect = new URLSearchParams(window.location.search).get("redirect");
      router.push(redirect || "/driver");

    } catch (err: any) {
      alert(err.message);
    }
  };

  // 🟢 REGISTER
  const register = async () => {
    if (!email || !pass) {
      alert("Completa todos los campos");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, pass);

      const user = auth.currentUser;

      if (user) {
        await update(ref(db, "drivers/" + user.uid), {
          uid: user.uid,
          nombre: user.email || "Driver",
          telefono: "",

          carro: {
            marca: "",
            modelo: "",
            color: "",
            placa: ""
          },

          rating: 5,
          viajesCompletados: 0,

          activo: true,
          online: true,
          lastSeen: Date.now()
        });
      }

      const redirect = new URLSearchParams(window.location.search).get("redirect");
      router.push(redirect || "/driver");

    } catch (err: any) {
      alert(err.message);
    }
  };

  // 👤 PERFIL EN TIEMPO REAL
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const perfilRef = ref(db, "drivers/" + user.uid);

    return onValue(perfilRef, (snap) => {
      setPerfil(snap.val());
    });
  }, []);

  // 🎯 EFECTOS BOTÓN
  const press = (e: any) => {
    e.currentTarget.style.transform = "scale(0.95)";
    e.currentTarget.style.boxShadow = "0 2px 0 #000";
  };

  const release = (e: any) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow = "0 5px 0 #000";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0f0f0f",
        color: "#fff"
      }}
    >
      <div
        style={{
          width: 320,
          padding: 25,
          borderRadius: 16,
          background: "#1c1c1c",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
          textAlign: "center"
        }}
      >
        <h2>🚗 Login Driver</h2>

        {/* PERFIL */}
        {perfil && (
          <div style={{ marginBottom: 10 }}>
            <p><b>{perfil.nombre}</b></p>
            <p>⭐ {perfil.rating}</p>
          </div>
        )}

        {/* EMAIL */}
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          style={inputStyle}
        />

        {/* LOGIN */}
        <button
          onClick={login}
          style={btnBlue}
          onMouseDown={press}
          onMouseUp={release}
          onMouseLeave={release}
        >
          🔑 Login
        </button>

        <div style={{ height: 10 }} />

        {/* REGISTER */}
        <button
          onClick={register}
          style={btnGreen}
          onMouseDown={press}
          onMouseUp={release}
          onMouseLeave={release}
        >
          📝 Register
        </button>

        <p style={{ marginTop: 15, fontSize: 12, color: "#aaa" }}>
          Private Rides Driver App
        </p>
      </div>
    </div>
  );
}

// 🎨 estilos
const inputStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  marginBottom: 10,
  background: "#2a2a2a",
  color: "#fff"
};

const btnBlue = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "#007bff",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 5px 0 #003f8a"
};

const btnGreen = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "#28a745",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 5px 0 #1e7e34"
};