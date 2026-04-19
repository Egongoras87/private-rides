"use client";

import { useEffect, useState } from "react";

const PASSWORD = "8887";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx30fngWN_zhJfcxp-wb8ZI1ASfISH2rUeRj-lbGK9R0_QsmDutFmp39tHHlWCr7rwI7Q/exec";

export default function AdminPage() {

  const [data, setData] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");

  // 🔥 CARGAR DATOS
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
        .map(r =>
          r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c =>
            c.replace(/(^"|"$)/g, "").trim()
          )
        )
        .filter(r => r.length >= 8);

      // 🔥 FILTRAR SOLO ACTIVOS
      const filtered = rows.filter(r => {
        const status = r[7];
        return status !== "Cancelado" && status !== "Completado";
      });

      setData(filtered);

    } catch (error) {
      console.error("ERROR CARGANDO CSV:", error);
    }
  };

  // 🔄 AUTO ACTUALIZACIÓN
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 UPDATE STATUS CORRECTO
  const updateStatus = async (
    name: string,
    phone: string,
    dateTime: string,
    status: string
  ) => {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          updateStatus: true,
          name,
          phone,
          dateTime,
          status
        })
      });

      loadData();

    } catch (error) {
      console.error("Error actualizando:", error);
    }
  };

  // 🎨 COLOR STATUS
  const getColor = (status: string) => {
    if (status === "Pendiente") return "#ffc107";
    if (status === "En camino") return "#17a2b8";
    if (status === "Completado") return "#28a745";
    if (status === "Cancelado") return "#dc3545";
    return "#999";
  };

  // 🔐 LOGIN
  if (!authorized) {
    return (
      <div style={{ padding: 20 }}>
        <h2>🔐 Panel Admin</h2>

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
    <div style={{ padding: 15, background: "#111", minHeight: "100vh" }}>
      <h2 style={{ color: "#fff" }}>🚗 Admin PRO</h2>

      {data.length === 0 && (
        <p style={{ color: "#aaa" }}>No hay viajes activos</p>
      )}

      {data.map((row, i) => {

        const name = row[0];
        const phone = row[1];
        const pickup = row[2];
        const dropoff = row[3];
        const price = row[4];
        const distance = row[5];
        const dateTime = row[6];
        const status = row[7] || "Pendiente";

        return (
          <div key={`${phone}-${dateTime}-${i}`} style={card}>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{name}</b>
              <span style={{ ...badge, background: getColor(status) }}>
                {status}
              </span>
            </div>

            <p>📞 {phone}</p>
            <p>📅 {new Date(dateTime).toLocaleString()}</p>

            <div style={route}>
              <p>📍 {pickup}</p>
              <p>➡️ {dropoff}</p>
            </div>

            <p>💰 ${price} | 📏 {distance} mi</p>

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>

              <button
                onClick={() => updateStatus(name, phone, dateTime, "Pendiente")}
                style={{ ...btn, background: "#ffc107" }}
              >
                🟡
              </button>

              <button
                onClick={() => updateStatus(name, phone, dateTime, "En camino")}
                style={{ ...btn, background: "#17a2b8" }}
              >
                🚗
              </button>

              <button
                onClick={() => updateStatus(name, phone, dateTime, "Completado")}
                style={{ ...btn, background: "#28a745" }}
              >
                ✅
              </button>

              <button
                onClick={() => updateStatus(name, phone, dateTime, "Cancelado")}
                style={{ ...btn, background: "#dc3545" }}
              >
                ❌
              </button>

            </div>

          </div>
        );
      })}
    </div>
  );
}

// 🎨 ESTILOS
const card = {
  background: "#1e1e1e",
  color: "#fff",
  padding: 14,
  borderRadius: 14,
  marginBottom: 12,
  boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
};

const route = {
  background: "#2a2a2a",
  padding: 10,
  borderRadius: 10,
  marginTop: 6
};

const badge = {
  padding: "4px 10px",
  borderRadius: 10,
  fontSize: 12,
  color: "#000"
};

const btn = {
  flex: 1,
  padding: 8,
  borderRadius: 8,
  border: "none",
  color: "#000",
  fontWeight: "bold"
};

const btnMain = {
  width: "100%",
  padding: 12,
  background: "#000",
  color: "#fff",
  borderRadius: 10,
  marginTop: 10
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 10
};