"use client";

import { useEffect, useState, useRef } from "react";

// 🎯 EFECTO BOTÓN
const btn3D = {
  transform: "translateY(0)",
  boxShadow: "0 6px 0 #000",
  transition: "all 0.1s ease"
};

const pressIn = (e:any) => {
  e.currentTarget.style.transform = "translateY(4px)";
  e.currentTarget.style.boxShadow = "0 2px 0 #000";
};

const pressOut = (e:any) => {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 6px 0 #000";
};

export default function DriverPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");
  const [lastHash, setLastHash] = useState("");

  const watchRef = useRef<any>(null);

  const PASSWORD = "8887";

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJzEHEq_XzTb-IOe9JjlHXW4eyx7QY2IrayDumHOuIj_60atC3FUrqdNTHZQ4rko1bYg/exec";

  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

  // 🚀 CARGA RÁPIDA
  const loadData = async () => {
    try {
      const res = await fetch(CSV_URL + "&t=" + Date.now());
      const text = await res.text();

      const rows = text
        .split("\n")
        .slice(1)
        .map(r =>
          r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map(c => c.replace(/(^"|"$)/g, "").trim())
        )
        .filter(r => r.length >= 11);

      const currentHash = rows.map(r => `${r[10]}-${r[7]}`).join("|");

      if (currentHash === lastHash) return;
      setLastHash(currentHash);

      // 🔥 SOLO ACTIVOS
      const active = rows.filter(
        r => r[7] !== "Cancelado" && r[7] !== "Completado"
      );

      setRides(active);

    } catch (err) {
      console.error("Error carga:", err);
    }
  };

  useEffect(() => {
    if (!authorized) return;

    loadData();
    const interval = setInterval(loadData, 3000);

    return () => clearInterval(interval);
  }, [authorized]);

  /// ✅ TRACKING CORRECTO
const startTracking = (tripId: string) => {
  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
  }

  watchRef.current = navigator.geolocation.watchPosition(
    (pos) => {

      const payload = {
  updateLocation: true,
  tripId,
  lat: pos.coords.latitude,
  lng: pos.coords.longitude
};

fetch("/api/route", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

      console.log("GPS ENVIANDO:", payload);
      console.log("GPS QUE ENVÍAS:", {
  tripId,
  lat: pos.coords.latitude,
  lng: pos.coords.longitude
});

      fetch("/api/route", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    updateLocation: true,
    tripId: tripId,
    lat: pos.coords.latitude,
    lng: pos.coords.longitude
  })
});

    },
    (err) => console.error("GPS ERROR:", err),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  );
};

  // ✅ STATUS LIMPIO
const updateStatus = async (tripId: string, status: string) => {
  await fetch("/api/route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      updateStatus: true,
      tripId,
      status
    })
  });

  loadData();
};

  // 🔐 LOGIN
  if (!authorized) {
    return (
      <div style={loginBg}>
        <div style={loginCard}>
          <h2>🚗 Driver Pro</h2>

          <input
            type="password"
            value={inputPass}
            onChange={(e) => setInputPass(e.target.value)}
            style={input}
          />

          <button
            style={btnMain}
            onMouseDown={pressIn}
            onMouseUp={pressOut}
            onClick={() =>
              inputPass === PASSWORD
                ? setAuthorized(true)
                : alert("Incorrecto")
            }
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <h2>🚗 Viajes Pendientes</h2>

      {rides.length === 0 && <p>Esperando solicitudes...</p>}

      {rides.map((r) => {
        const tripId = r[10]; // columna K real

        const name = r[0];
        const phone = r[1];
        const pickup = r[2];
        const dropoff = r[3];
        const date = r[6];

        return (
          <div key={tripId} style={card}>

            <p><b>{name}</b></p>
            <p>📞 {phone}</p>
            <p>📅 {new Date(date).toLocaleString()}</p>

            <p>📍 {pickup}</p>
            <p>➡️ {dropoff}</p>

            {/* 🚀 RECOGER */}
            <button
              style={btnBlue}
              onMouseDown={pressIn}
              onMouseUp={pressOut}
              onClick={() => {

                updateStatus(tripId, "En camino");

                startTracking(tripId);

                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup)}`
                );

                const link = `${window.location.origin}/tracking?tripId=${tripId}`;

                window.open(
                  `https://wa.me/1${phone}?text=${encodeURIComponent(
                    `🚗 Voy en camino\n📍 Sigue aquí:\n${link}`
                  )}`
                );
              }}
            >
              🚀 Recoger
            </button>

            <div style={row}>

              {/* ✅ FINALIZAR */}
              <button
                style={btnGreen}
                onMouseDown={pressIn}
                onMouseUp={pressOut}
                onClick={() => updateStatus(tripId, "Completado")}
              >
                ✅ Finalizar
              </button>

              {/* ❌ CANCELAR */}
              <button
                style={btnRed}
                onMouseDown={pressIn}
                onMouseUp={pressOut}
                onClick={() => {
                  updateStatus(tripId, "Cancelado");

                  window.open(
                    `https://wa.me/1${phone}?text=🚫 Tu viaje fue cancelado`
                  );
                }}
              >
                ❌ Cancelar
              </button>

            </div>

          </div>
        );
      })}
    </div>
  );
}

// 🎨 ESTILO UBER
const container = {
  padding: 20,
  background: "#0a0a0a",
  color: "#fff",
  minHeight: "100vh",
};

const card = {
  background: "#111",
  padding: 15,
  borderRadius: 15,
  marginBottom: 15,
  border: "1px solid #222",
};

const row = {
  display: "flex",
  gap: 10,
  marginTop: 10,
};

const btnMain = {
  width: "100%",
  padding: 12,
  background: "#fff",
  color: "#000",
  borderRadius: 10,
  border: "none",
};

const btnBlue = {
  width: "100%",
  padding: 12,
  background: "#007bff",
  color: "#fff",
  borderRadius: 10,
  border: "none",
  marginTop: 10,
};

const btnGreen = {
  flex: 1,
  padding: 10,
  background: "#28a745",
  color: "#fff",
  borderRadius: 10,
  border: "none",
};

const btnRed = {
  flex: 1,
  padding: 10,
  background: "#dc3545",
  color: "#fff",
  borderRadius: 10,
  border: "none",
};

const loginBg = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100vh",
  background: "#000",
};

const loginCard = {
  padding: 30,
  background: "#111",
  borderRadius: 20,
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
};
const panel = {
  position: "absolute",
  bottom: 10,
  left: "5%",
  width: "90%",
  maxWidth: 500,
  background: "#fff",
  borderRadius: 20,
  padding: 15,
};