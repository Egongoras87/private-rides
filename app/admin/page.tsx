"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv")
      .then(res => res.text())
      .then(text => {
        const rows = text.split("\n").map(row => row.split(","));
        setData(rows.slice(1)); // quitamos encabezado
      });
  }, []);

  return (
    <div style={{ padding: 20, background: "#f5f5f5", minHeight: "100vh" }}>
      
      <h1 style={{ fontSize: 28, fontWeight: "bold", marginBottom: 20 }}>
        🚗 Panel PRO de Reservas
      </h1>

      {/* CONTADOR */}
      <div style={{
        marginBottom: 20,
        padding: 15,
        background: "black",
        color: "white",
        borderRadius: 12
      }}>
        Total de reservas: {data.length}
      </div>

      {/* TARJETAS */}
      <div style={{
        display: "grid",
        gap: 15
      }}>
        {data.map((row, i) => (
          <div key={i} style={card}>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>{row[1]}</h3>
              <span style={status}>Activo</span>
            </div>

            <p>📞 {row[2]}</p>

            <div style={routeBox}>
              <p>📍 {row[3]}</p>
              <p>➡️ {row[4]}</p>
            </div>

            <div style={bottomRow}>
              <span>💰 ${row[5]}</span>
              <span>📏 {row[6]} mi</span>
            </div>

            <small style={{ color: "#666" }}>
              {row[0]}
            </small>

          </div>
        ))}
      </div>
    </div>
  );
}

// 🎨 ESTILOS PRO
const card = {
  background: "white",
  padding: 15,
  borderRadius: 15,
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
};

const routeBox = {
  background: "#f1f1f1",
  padding: 10,
  borderRadius: 10,
  margin: "10px 0"
};

const bottomRow = {
  display: "flex",
  justifyContent: "space-between",
  fontWeight: "bold"
};

const status = {
  background: "#28a745",
  color: "white",
  padding: "4px 10px",
  borderRadius: 10,
  fontSize: 12
};