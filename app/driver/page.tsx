"use client";

import { useEffect, useState, useRef } from "react";

// --- EFECTOS VISUALES ---
const pressIn = (e: any) => {
  e.currentTarget.style.transform = "scale(0.96)";
  e.currentTarget.style.opacity = "0.85";
};
const pressOut = (e: any) => {
  e.currentTarget.style.transform = "scale(1)";
  e.currentTarget.style.opacity = "1";
};

export default function DriverPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");
  const [lastCount, setLastCount] = useState(0);
  const [lastHash, setLastHash] = useState(""); // 🔥 ARREGLO 2: Control de cambios reales
  const ridesRef = useRef<string>("");
  const watchRef = useRef<any>(null);

  const PASSWORD = "8887";
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxIL-9QQ9YZM3hVSGeB4kWxTOIBAU0gNQm2nDgq7FVahY-0WaGKsFZH9tlq66qNTbuKrQ/exec";
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

  // 🔥 CARGA DE DATOS FILTRADA Y OPTIMIZADA
  const loadData = async () => {
    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();

      const rows = text
        .split("\n")
        .slice(1)
        .map(r => r.split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/).map(c => c.replace(/(^\"|\"$)/g, "").trim()))
        .filter(r => r.length >= 11);

      // 🔥 ARREGLO 2: Validar si hay cambios reales antes de actualizar estado
      const currentHash = rows.map(r => r[10] + r[7]).join("|"); // Hash basado en ID y Estado
      if (currentHash === lastHash) return;
      setLastHash(currentHash);

      // Filtrar: Solo mostrar Pendientes o En Camino
      const filtered = rows
        .filter(r => r[7] !== "Cancelado" && r[7] !== "Completado")
        .sort((a, b) => new Date(b[6]).getTime() - new Date(a[6]).getTime());

      // Alerta sonora
      if (filtered.length > lastCount && lastCount !== 0) {
        new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg").play();
      }
      setLastCount(filtered.length);
      setRides(filtered);

    } catch (err) {
      console.error("Error al cargar viajes:", err);
    }
  };

  useEffect(() => {
    if (authorized) {
      loadData();
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [authorized]);

  // 📡 TRACKING GPS EN TIEMPO REAL
  const startTracking = (tripId: string) => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);

    if ("geolocation" in navigator) {
      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          // Cambiamos JSON por FormData para que Google Sheets lo lea sin errores
          const formData = new FormData();
          formData.append('updateLocation', 'true');
          formData.append('tripId', tripId);
          formData.append('lat', pos.coords.latitude.toString());
          formData.append('lng', pos.coords.longitude.toString());

          fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", // Mantener no-cors para evitar problemas de seguridad
            body: formData
          });
        },
        (err) => console.error("GPS Error:", err),
        { enableHighAccuracy: true }
      );
    }
  };

  // 🔄 BUSCA ESTA FUNCIÓN Y REEMPLÁZALA COMPLETAMENTE
  const updateStatus = async (tripId: string, status: string) => {
    try {
      const formData = new FormData();
      formData.append('updateStatus', 'true');
      formData.append('tripId', tripId);
      formData.append('status', status);

      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData
      });
      loadData();
    } catch (e) {
      console.error("Error:", e);
    }
  };

  // 🔐 LOGIN SCREEN
  if (!authorized) {
    return (
      <div style={loginBg}>
        <div style={loginCard}>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>🚗 Driver Mode</h1>
          <p style={{ color: "#888", marginBottom: 20 }}>Ingresa tu código de acceso</p>
          <input
            type="password"
            placeholder="••••"
            value={inputPass}
            onChange={(e) => setInputPass(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => inputPass === PASSWORD ? setAuthorized(true) : alert("Código erróneo")}
            onMouseDown={pressIn} onMouseUp={pressOut}
            style={btnPrimary}
          >
            Conectarse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 15, background: "#0a0a0a", minHeight: "100vh", color: "#fff" }}>
      <header style={header}>
        <h2 style={{ margin: 0 }}>Viajes Disponibles</h2>
        <span style={statusBadge}>● En línea</span>
      </header>

      {rides.length === 0 && (
        <div style={emptyState}>Esperando nuevas solicitudes...</div>
      )}

      {rides.map((r, i) => {
  const tripId = r[10]?.trim();

  if (!tripId) {
    console.error("TripID no encontrado", r);
    return null;
  }

  const name = r[0];
  const phone = r[1];
  const pickup = r[2];
  const dropoff = r[3];
  const price = r[4];
  const distance = r[5];
  const dateTime = r[6];
  const status = r[7];

  return (
    <div key={tripId} style={card}>
      
      <div style={cardHeader}>
        <div>
          <span style={clientName}>👤 {name}</span>
          <div style={{ fontSize: 13, color: "#888" }}>📞 {phone}</div>
        </div>

        <span style={{
          ...statusLabel,
          background: status === "En camino" ? "#17a2b8" : "#f1c40f",
          color: "#fff"
        }}>
          {status}
        </span>
      </div>

      <div style={routeContainer}>
        <div style={routeStep}>📍 {pickup}</div>
        <div style={routeStep}>🏁 {dropoff}</div>
      </div>

      <div style={statsRow}>
        <span>💰 ${price}</span>
        <span>📏 {distance} mi</span>
        <span>⏰ {new Date(dateTime).toLocaleTimeString()}</span>
      </div>

      <button
        style={btnNav}
        onMouseDown={pressIn}
        onMouseUp={pressOut}
        onClick={() => {

          window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup)}`);

          updateStatus(tripId, "En camino");

          startTracking(tripId);

          const link = `${window.location.origin}/tracking?tripId=${tripId}`;

          const msg = `🚗 Tu conductor va en camino\n📍 Sigue aquí:\n${link}`;

          window.open(`https://wa.me/1${phone}?text=${encodeURIComponent(msg)}`);
        }}
      >
        🚀 Iniciar Viaje
      </button>

      <div style={actionGrid}>

        <button
          style={{ ...btnSmall, background: "#2ecc71" }}
          onClick={() => updateStatus(tripId, "Completado")}
        >
          ✅ Finalizar
        </button>

        <button
          style={{ ...btnSmall, background: "#e74c3c" }}
          onClick={() => {
            updateStatus(tripId, "Cancelado");

            window.open(`https://wa.me/1${phone}?text=Tu viaje ha sido cancelado`);
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

// --- ESTILOS ---
const loginBg = { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#000" };
const loginCard = { background: "#111", padding: 40, borderRadius: 30, textAlign: "center" as const, width: "90%", maxWidth: 400, border: "1px solid #222" };
const inputStyle = { width: "100%", padding: 15, borderRadius: 15, border: "none", background: "#222", color: "#fff", marginBottom: 15, fontSize: 20, textAlign: "center" as const };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 };
const statusBadge = { color: "#2ecc71", fontSize: 12, fontWeight: "bold" };
const emptyState = { textAlign: "center" as const, color: "#444", marginTop: 50 };
const card = { background: "#111", borderRadius: 20, padding: 18, marginBottom: 15, border: "1px solid #222", boxShadow: "0 10px 20px rgba(0,0,0,0.5)" };
const cardHeader = { display: "flex", justifyContent: "space-between", marginBottom: 12 };
const clientName = { fontSize: 18, fontWeight: "bold" };
const statusLabel = { padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: "bold" as const };
const routeContainer = { background: "#1a1a1a", padding: 12, borderRadius: 12, marginBottom: 10 };
const routeStep = { fontSize: 13, color: "#ccc", marginBottom: 5 };
const statsRow = { display: "flex", justifyContent: "space-between", fontSize: 14, color: "#2ecc71", fontWeight: "bold" };
const btnPrimary = { width: "100%", padding: 15, background: "#fff", color: "#000", borderRadius: 15, border: "none", fontWeight: "bold", fontSize: 16 };
const btnNav = { width: "100%", padding: 16, background: "#007bff", color: "#fff", borderRadius: 15, border: "none", fontWeight: "bold", marginBottom: 10 };
const actionGrid = { display: "flex", gap: 10 };
const btnSmall = { flex: 1, padding: 12, borderRadius: 12, border: "none", color: "#fff", fontWeight: "bold", fontSize: 12 };