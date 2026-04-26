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
  
const stopTracking = () => {
  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }
};
  const PASSWORD = "8887";
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw3UbXxmk1XaAIzTqdcMDiiktU5wfGrflG-PmM9Lg0XUE5YDSCQoO-duu5shePFDn6L1g/exec";
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

  // 🔥 CARGA DE DATOS FILTRADA Y OPTIMIZADA
  const loadData = async () => {
    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();

      const rows = text
  .split("\n")
  .slice(1)
  .map(r => {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let char of r) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
})
        .filter(r => r.length >= 11);

      // 🔥 ARREGLO 2: Validar si hay cambios reales antes de actualizar estado
      const currentHash = rows.map(r => r.join("|")).join("#"); // Hash basado en ID y Estado
      if (currentHash === lastHash) return;
      setLastHash(currentHash);

      // Filtrar: Solo mostrar Pendientes o En Camino
      const filtered = rows
        .filter(r => r[7] !== "Cancelado" && r[7] !== "Completado")
        .sort((a, b) => new Date(a[6]).getTime() - new Date(b[6]).getTime());

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

// 🔥 LIMPIEZA DE GPS AL SALIR DEL COMPONENTE
useEffect(() => {
  return () => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
  };
}, []);

  // 📡 TRACKING GPS EN TIEMPO REAL
 const startTracking = (tripId: string) => {

  // 🛑 detener tracking anterior si existe
  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }

  if (!navigator.geolocation) return;

  let lastSend = 0;

  watchRef.current = navigator.geolocation.watchPosition(
    (pos) => {

      const now = Date.now();
      if (now - lastSend < 3000) return; // ⏱ evita spam
      lastSend = now;

      const formData = new FormData();
      formData.append("tripId", tripId);
      formData.append("updateLocation", "true");
      formData.append("lat", pos.coords.latitude.toString());
      formData.append("lng", pos.coords.longitude.toString());

      fetch(SCRIPT_URL, {
        method: "POST",
        body: formData
      });

    },
    (err) => console.error("GPS Error:", err),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  );
};

  // 🔄 BUSCA ESTA FUNCIÓN Y REEMPLÁZALA COMPLETAMENTE
  const updateStatus = async (tripId: string, status: string) => {
  try {
    const formData = new FormData();
    formData.append("updateStatus", "true");
    formData.append("tripId", tripId);
    formData.append("status", status);

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.success) {
      alert("Error updating status");
      return;
    }

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
        const [name, phone, pickup, dropoff, price, distance, dateTime, status, , , tripId] = r;
        const safePrice = Number((price || "").toString().trim()) || 0;
const safeDistance = Number((distance || "").toString().trim()) || 0;

        if (!tripId) return null;

        return (
  <div key={tripId || i} style={card}>
    <div style={cardHeader}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={clientName}>👤 {name}</span>
        {/* AQUÍ AGREGAMOS EL TELÉFONO DEBAJO DEL NOMBRE */}
        <span style={{ fontSize: 14, color: "#888", marginTop: 2 }}>📞 {phone}</span>
      </div>
      <span style={{ ...statusLabel, height: "fit-content", background: status === "En camino" ? "#17a2b8" : "#f1c40f", color: "#fff" }}>
        {status || "Pendiente"}
      </span>
    </div>

            <div style={routeContainer}>
              <div style={routeStep}>📍 <b>Recogida:</b> {pickup}</div>
              <div style={routeStep}>🏁 <b>Destino:</b> {dropoff}</div>
            </div>

            <div style={statsRow}>
              <span>💰 <b>${safePrice}</b></span>
              <span>📏 {safeDistance} mi</span>
              <span>⏰ {new Date(dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div style={{ marginTop: 15 }}>
              <button
                onClick={() => {
  if (status === "En camino") return; // 🔥 AQUÍ VA

  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup)}`);
  updateStatus(tripId, "En camino");
  startTracking(tripId);

  const trackingUrl = `${window.location.origin}/tracking?tripId=${tripId}`;
  const cleanPhone = (phone || "").replace(/\D/g, "");
  if (cleanPhone) {
    const msg = `🚗 ¡Hola ${name}! Tu conductor ya va en camino. Sigue el viaje aquí: ${trackingUrl}`;
    window.open(`https://wa.me/1${cleanPhone}?text=${encodeURIComponent(msg)}`);
  }
}}
                style={btnNav}
                onMouseDown={pressIn} onMouseUp={pressOut}
              >
                🚀 Iniciar Viaje / Abrir GPS
              </button>

              <div style={actionGrid}>
                <button 
  style={{ ...btnSmall, background: "#2ecc71" }} 
  onClick={() => {
    if (confirm("¿Completaste el viaje?")) {
      stopTracking();
      updateStatus(tripId, "Completado");
    }
  }}
  onMouseDown={pressIn}
  onMouseUp={pressOut}
>
  ✅ Finalizar
</button>

                <button 
                  style={{ ...btnSmall, background: "#e74c3c" }} 
                  onClick={() => {
                    if (confirm("¿Deseas cancelar este servicio?")) {
                      updateStatus(tripId, "Cancelado");
                      window.open(`https://wa.me/1${phone.replace(/\D/g, "")}?text=Lo sentimos, tu viaje ha sido cancelado.`);
                    }
                  }}
                  onMouseDown={pressIn} onMouseUp={pressOut}
                >❌ Cancelar</button>
              </div>
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