"use client";

import { useEffect, useState } from "react";

export default function DriverPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");
  const [lastCount, setLastCount] = useState(0);

  const PASSWORD = "8887";

  // 🔥 CARGAR DATA
  const loadData = () => {
    fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv")
      .then(res => res.text())
      .then(text => {
        const rows = text.split("\n").slice(1).map(row => {
          return row
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map(c => c.replace(/(^"|"$)/g, "").trim());
        });

        // 🔔 sonido si llega nuevo viaje
        if (rows.length > lastCount && lastCount !== 0) {
          const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
          audio.play();
        }

        setLastCount(rows.length);

        // 📅 ordenar por fecha
        const sorted = rows.sort((a, b) => {
          return new Date(a[7]).getTime() - new Date(b[7]).getTime();
        });

        setRides(sorted);
      });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 ACTUALIZAR STATUS
  const updateStatus = async (name: string, phone: string, status: string) => {
    await fetch("TU_SCRIPT_URL_AQUI", {
      method: "POST",
      body: JSON.stringify({
        updateStatus: true,
        name,
        phone,
        status,
      }),
    });

    loadData();
  };

  // 🔥 TRACKING REAL
  const startTracking = (phone: string) => {
    navigator.geolocation.watchPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      fetch("TU_SCRIPT_URL_AQUI", {
        method: "POST",
        body: JSON.stringify({
          updateLocation: true,
          phone,
          lat,
          lng,
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
            else alert("Contraseña incorrecta");
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

      {rides
        .filter(r => r[7]) // evitar filas vacías
        .map((r, i) => (
          <div key={i} style={card}>
            <p><b>{r[1]}</b></p>

            <p>
              📅 {r[7] ? new Date(r[7]).toLocaleString() : "Sin fecha"}
            </p>

            <p>📞 {r[2]}</p>

            <p>📍 {r[3]}</p>

            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[3])}`;
                window.open(url, "_blank");
              }}
              style={btnNav}
            >
              🧭 Ir a recoger
            </button>

            <p>➡️ {r[4]}</p>

            <p>
              💰 ${r[5]} | 📏 {r[6]} mi | ⏱️ {Math.round((Number(r[6]) || 0) * 2.5)} min
            </p>

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button
                onClick={() => updateStatus(r[1], r[2], "Pendiente")}
                style={{ ...btn, background: "#ffc107" }}
              >
                🟡
              </button>

              <button
                onClick={() => {
                  updateStatus(r[1], r[2], "En camino");
                  startTracking(r[2]);

                  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[3])}`;
                  window.open(url, "_blank");
                }}
                style={{ ...btn, background: "#17a2b8" }}
              >
                🚗
              </button>

              <button
                onClick={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r[4])}`;
                  window.open(url, "_blank");
                }}
                style={{ ...btn, background: "#007bff" }}
              >
                🧭
              </button>

              <button
                onClick={() => updateStatus(r[1], r[2], "Completado")}
                style={{ ...btn, background: "#28a745" }}
              >
                ✅
              </button>

              <button
                onClick={() => {
                  updateStatus(r[1], r[2], "Cancelado");

                  const msg = `
❌ Viaje cancelado

👤 ${r[1]}
📞 ${r[2]}
`;

                  window.open(
                    `https://wa.me/1${r[2]}?text=${encodeURIComponent(msg)}`,
                    "_blank"
                  );
                }}
                style={{ ...btn, background: "#dc3545" }}
              >
                ❌
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
  padding: 10,
  color: "white",
  borderRadius: 10,
  border: "none",
  fontSize: 12,
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