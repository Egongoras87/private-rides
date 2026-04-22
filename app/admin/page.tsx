"use client";

import { useEffect, useState } from "react";

const PASSWORD = "8887";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYmAl_thVEeB3vJ6kAw7MxLsLej5Vt2JuzEgoXO83pkMLc9EQohRJ6EzzmoVeF6gG9yg/exec";

export default function AdminPage() {

  const [data, setData] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");

  // 🔥 EFECTOS DE BOTONES
  const pressIn = (e: any) => {
    e.currentTarget.style.transform = "scale(0.95)";
    e.currentTarget.style.opacity = "0.8";
  };
  const pressOut = (e: any) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.opacity = "1";
  };

  // 🔥 CARGAR DATOS (FILTRANDO ACTIVOS)
  const loadData = async () => {
    try {
      const res = await fetch(
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv",
        { cache: "no-store" }
      );

      const text = await res.text();
      const rows = text
        .split("\n")
        .slice(1)
        .map(r => r.split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/).map(c => c.replace(/(^\"|\"$)/g, "").trim()))
        .filter(r => r.length >= 10); // Aseguramos que llegue hasta la columna K (tripId)

      // Filtrar para no mostrar los ya terminados o cancelados
      const activeRides = rows.filter(r => r[7] !== "Completado" && r[7] !== "Cancelado");
      setData(activeRides.reverse()); // Los más nuevos arriba

    } catch (error) {
      console.error("ERROR CARGANDO DATOS:", error);
    }
  };

  useEffect(() => {
    if (authorized) {
      loadData();
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [authorized]);

  // 🔥 ACTUALIZACIÓN POR TRIP ID (MÁS SEGURO)
  const updateStatus = async (tripId: string, status: string) => {
    if (!tripId) return alert("Error: Este viaje no tiene ID");
    
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          updateStatus: true,
          tripId: tripId,
          status: status
        })
      });
      loadData(); // Refrescar lista
    } catch (error) {
      alert("Error al actualizar estado");
    }
  };

  const getColor = (status: string) => {
    if (status === "En camino") return "#17a2b8";
    if (status === "Pendiente") return "#ffc107";
    return "#555";
  };

  // 🔐 LOGIN SCREEN
  if (!authorized) {
    return (
      <div style={loginContainer}>
        <div style={loginCard}>
          <h2 style={{ marginBottom: 20 }}>🔐 Admin Access</h2>
          <input
            type="password"
            placeholder="Introduce el código"
            value={inputPass}
            onChange={(e) => setInputPass(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => inputPass === PASSWORD ? setAuthorized(true) : alert("Código Incorrecto")}
            onMouseDown={pressIn} onMouseUp={pressOut}
            style={btnConfirm}
          >
            Entrar al Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 15px", background: "#0a0a0a", minHeight: "100vh" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: "#fff", margin: 0 }}>🚗 Viajes Activos</h2>
        <button onClick={loadData} style={btnRefresh}>🔄</button>
      </div>

      {data.length === 0 && <p style={{ color: "#666", textAlign: 'center' }}>No hay servicios pendientes.</p>}

      {data.map((row, i) => {
        const [name, phone, pickup, dropoff, price, distance, dateTime, status, , , tripId] = row;

        return (
          <div key={tripId || i} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontWeight: 'bold', fontSize: 16 }}>{name}</span>
              <span style={{ ...badge, background: getColor(status) }}>{status || "Pendiente"}</span>
            </div>

            <div style={infoGrid}>
              <span>📞 {phone}</span>
              <span>📅 {new Date(dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div style={routeBox}>
              <div style={routeItem}>📍 <span style={addressText}>{pickup}</span></div>
              <div style={{ borderLeft: "2px dashed #444", height: 15, marginLeft: 6 }}></div>
              <div style={routeItem}>🏁 <span style={addressText}>{dropoff}</span></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={priceLabel}>💰 ${price} | {distance} mi</span>
              <span style={{ fontSize: 10, color: '#444' }}>ID: {tripId?.slice(-6)}</span>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{ display: "flex", gap: 8, marginTop: 15 }}>
              <button 
                style={{ ...btnAction, background: "#ffc107" }} 
                onClick={() => updateStatus(tripId, "Pendiente")}
                onMouseDown={pressIn} onMouseUp={pressOut}
              >🟡</button>
              
              <button 
                style={{ ...btnAction, background: "#17a2b8" }} 
                onClick={() => updateStatus(tripId, "En camino")}
                onMouseDown={pressIn} onMouseUp={pressOut}
              >🚗</button>

              <button 
                style={{ ...btnAction, background: "#28a745", flex: 2 }} 
                onClick={() => confirm("¿Finalizar viaje?") && updateStatus(tripId, "Completado")}
                onMouseDown={pressIn} onMouseUp={pressOut}
              >✅ Finalizar</button>

              <button 
                style={{ ...btnAction, background: "#dc3545" }} 
                onClick={() => confirm("¿Cancelar viaje?") && updateStatus(tripId, "Cancelado")}
                onMouseDown={pressIn} onMouseUp={pressOut}
              >❌</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 🎨 DISEÑO PRO
const loginContainer = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000' };
const loginCard = { background: '#1e1e1e', padding: 30, borderRadius: 20, textAlign: 'center' as const, color: '#fff', width: '90%', maxWidth: 400 };
const inputStyle = { width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#333', color: '#fff', marginBottom: 15, textAlign: 'center' as const, fontSize: 18 };

const card = { background: "#181818", color: "#eee", padding: 16, borderRadius: 18, marginBottom: 15, border: "1px solid #222" };
const infoGrid = { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#aaa', marginBottom: 10 };
const routeBox = { background: "#222", padding: 12, borderRadius: 12 };
const routeItem = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 };
const addressText = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as any;

const badge = { padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 'bold', color: '#000' };
const priceLabel = { fontWeight: 'bold', color: '#00c853', fontSize: 15 };

const btnAction = { flex: 1, padding: 12, borderRadius: 12, border: "none", cursor: "pointer", fontWeight: "bold", transition: "all 0.1s" };
const btnConfirm = { width: '100%', padding: 14, background: '#00c853', color: '#fff', borderRadius: 12, border: 'none', fontWeight: 'bold', cursor: 'pointer' };
const btnRefresh = { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' };