"use client";

import { useEffect, useState } from "react";

export default function DriverPage() {

  const [rides, setRides] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");

  const PASSWORD = "8887";

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwITBSQxYqzLaM1Oa3uHQgpBq1cNV0k_szAZYv-yaOcgY6x_rk7AdY_SiNrHI4C_EdKpg/exec";

  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

  // 🔥 CARGAR DATOS CORREGIDO
  const loadData = async () => {
    try {
      const res = await fetch(CSV_URL);
      const text = await res.text();

      const rows = text
        .split("\n")
        .slice(1)
        .map(r =>
          r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map(c => c.replace(/(^"|"$)/g, "").trim())
        )
        .filter(r => r.length >= 10);

      setRides(rows);

    } catch (err) {
      console.error("ERROR CARGANDO:", err);
    }
  };

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // 🔥 ACTUALIZAR STATUS (SIN HEADERS)
  const updateStatus = async (phone: string, status: string) => {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          updateStatus: true,
          phone,
          status,
        }),
      });

      loadData();

    } catch (err) {
      console.error("ERROR STATUS:", err);
    }
  };

  // 🔥 GPS TRACKING
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watch = navigator.geolocation.watchPosition((pos) => {

      fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          updateLocation: true,
          phone: "driver",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        })
      });

    });

    return () => navigator.geolocation.clearWatch(watch);

  }, []);

  // 🔐 LOGIN
  if (!authorized) {
    return (
      <div style={{ padding: 20 }}>
        <h2>🔐 Acceso Driver</h2>

        <input
          type="password"
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
    <div style={{ padding: 20 }}>
      <h1>🚗 Driver PRO</h1>

      {rides.map((r, i) => (
        <div key={i} style={card}>

          <p><b>{r[0]}</b></p>
          <p>📞 {r[1]}</p>
          <p>📍 {r[2]}</p>
          <p>➡️ {r[3]}</p>
          <p>💰 ${r[4]}</p>

          <p>📅 {r[6]}</p>
          <p>🟡 {r[7]}</p>

          {/* 🚗 NAVEGACIÓN */}
          <button
            onClick={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[2])}`;
              window.open(url, "_blank");
            }}
            style={btn}
          >
            🧭 Ir a recoger
          </button>

          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>

            <button
              onClick={() => updateStatus(r[1], "Pendiente")}
              style={{ ...btn, background: "#ffc107" }}
            >
              🟡 Pendiente
            </button>

            <button
              onClick={() => {
                updateStatus(r[1], "En camino");

                const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[2])}`;
                window.open(url, "_blank");
              }}
              style={{ ...btn, background: "#17a2b8" }}
            >
              🚗 En camino
            </button>

            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[3])}`;
                window.open(url, "_blank");
              }}
              style={{ ...btn, background: "#007bff" }}
            >
              🧭 Destino
            </button>

            <button
              onClick={() => updateStatus(r[1], "Completado")}
              style={{ ...btn, background: "#28a745" }}
            >
              ✅ Finalizar
            </button>

          </div>
        </div>
      ))}

    </div>
  );
}

// 🎨 estilos
const card = {
  background: "white",
  padding: 15,
  borderRadius: 15,
  marginBottom: 12,
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
};

const btn = {
  flex: 1,
  padding: 10,
  color: "white",
  borderRadius: 10,
  border: "none",
  fontSize: 12,
  fontWeight: "bold"
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 10,
  border: "1px solid #ccc"
};

const btnMain = {
  width: "100%",
  padding: 12,
  background: "black",
  color: "white",
  borderRadius: 10,
  border: "none"
};