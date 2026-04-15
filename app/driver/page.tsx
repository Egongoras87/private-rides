"use client";

import { useEffect, useState } from "react";

export default function DriverPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");
  const [lastCount, setLastCount] = useState(0);

  const PASSWORD = "8887";

  // 🔥 CARGAR DATA
  const loadData = async () => {
    try {
      const res = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv");

      const text = await res.text();

      const lines = text.split("\n").filter(l => l.trim() !== "");

      const parsed = lines.slice(1).map(line => {
        return line
          .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map(c => c.replace(/(^"|"$)/g, "").trim());
      });

      // 🔥 FILTRO CORRECTO
      const clean = parsed.filter(r =>
        r.length >= 7 &&
        r[0] && r[1] && r[2] && r[3]
      );

      // 🔥 ORDEN POR FECHA
      const sorted = clean.sort((a, b) => {
        return new Date(a[6] || 0).getTime() - new Date(b[6] || 0).getTime();
      });

      if (sorted.length > lastCount && lastCount !== 0) {
        const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
        audio.play();
      }

      setLastCount(sorted.length);
      setRides(sorted);

    } catch (error) {
      console.error("Error:", error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 ACTUALIZAR STATUS
  const updateStatus = async (name: string, phone: string, status: string) => {
    await fetch("https://script.google.com/macros/s/AKfycbxKFVhlJzimK8NPFwK42OdGeqxkuYLrBMjqc51mlQAkHAR_DyYQc56f-zA21DgLKE5ocg/exec", {
      method: "POST",
      body: JSON.stringify({ updateStatus: true, name, phone, status }),
    });

    loadData();
  };

  // 🔥 TRACKING
  const startTracking = (phone: string) => {
    navigator.geolocation.watchPosition((pos) => {
      fetch("https://script.google.com/macros/s/AKfycbxKFVhlJzimK8NPFwK42OdGeqxkuYLrBMjqc51mlQAkHAR_DyYQc56f-zA21DgLKE5ocg/exec", {
        method: "POST",
        body: JSON.stringify({
          updateLocation: true,
          phone,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      });
    });
  };

  // 🔐 LOGIN
  if (!authorized) {
    return (
      <div style={{ padding: 20 }}>
        <h2>🔐 Acceso Driver</h2>

        <input
          type="password"
          placeholder="Contraseña"
          value={inputPass}
          onChange={(e) => setInputPass(e.target.value)}
          style={input}
        />

        <button
          onClick={() => {
            if (inputPass === PASSWORD) setAuthorized(true);
            else alert("Incorrecta");
          }}
          style={btnMain}
        >
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 15 }}>
      <h1>🚗 Driver PRO</h1>

      {rides.map((r, i) => (
        <div key={i} style={card}>
          <p><b>{r[0]}</b></p>
          <p>📞 {r[1]}</p>
          <p>📅 {r[6] ? new Date(r[6]).toLocaleString() : "Sin fecha"}</p>
          <p>📍 {r[2]}</p>

          <button
            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[2])}`)}
            style={btnNav}
          >
            🧭 Ir a recoger
          </button>

          <p>➡️ {r[3]}</p>

          <p>
            💰 ${r[4]} | 📏 {r[5]} mi | ⏱️ {Math.round((Number(r[5]) || 0) * 2.5)} min
          </p>

          <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
            <button onClick={() => updateStatus(r[0], r[1], "Pendiente")} style={{ ...btn, background: "#ffc107" }}>🟡 Pendiente</button>

            <button
              onClick={() => {
                updateStatus(r[0], r[1], "En camino");
                startTracking(r[1]);
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[2])}`);
              }}
              style={{ ...btn, background: "#17a2b8" }}
            >
              🚗 En camino
            </button>

            <button
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[3])}`)}
              style={{ ...btn, background: "#007bff" }}
            >
              🧭 Recoger
            </button>

            <button onClick={() => updateStatus(r[0], r[1], "Completado")} style={{ ...btn, background: "#28a745" }}>
              ✅ Finalizar
            </button>

            <button
              onClick={() => {
                updateStatus(r[0], r[1], "Cancelado");
                window.open(`https://wa.me/1${r[1]}?text=${encodeURIComponent("❌ Viaje cancelado")}`);
              }}
              style={{ ...btn, background: "#dc3545" }}
            >
              ❌ Cancelar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 🎨 ESTILOS
const btn = {
  flex: 1,
  padding: 8,
  color: "white",
  borderRadius: 8,
  border: "none",
  fontSize: 11,
  fontWeight: "bold"
};

const btnNav = {
  width: "100%",
  padding: 10,
  background: "#007bff",
  color: "white",
  borderRadius: 10,
  border: "none",
  marginTop: 5
};

const btnMain = {
  width: "100%",
  padding: 12,
  background: "black",
  color: "white",
  borderRadius: 10,
  border: "none"
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 10,
  border: "1px solid #ccc"
};

const card = {
  background: "white",
  padding: 15,
  borderRadius: 15,
  marginBottom: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  borderLeft: "5px solid #000"
};