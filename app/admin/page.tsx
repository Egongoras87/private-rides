"use client";

import { useEffect, useState } from "react";

const PASSWORD = "8887";

export default function AdminPage() {
  const [data, setData] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");

  // 🔥 CARGAR DATOS
  const loadData = () => {
    fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv")
      .then(res => res.text())
      .then(text => {
       const rows = text.split("\n").slice(1).map((row) => {
  const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  return cols.map(c => c.replace(/(^"|"$)/g, "").trim());
});

setData(rows.filter(r => r.length > 5));
      });
  };

  useEffect(() => {
    loadData();
  }, []);

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
        />
        <button
          onClick={() => {
            if (inputPass === PASSWORD) setAuthorized(true);
            else alert("Contraseña incorrecta");
          }}
        >
          Entrar
        </button>
      </div>
    );
  }

  // 🔥 ACTUALIZAR STATUS EN GOOGLE SHEETS
  const updateStatus = async (name: string, phone: string, status: string) => {
    try {
      await fetch(
        "https://script.google.com/macros/s/AKfycbw9W1SOCuelG7M1I5cLfBzkUMXZdGj78csPYM8Bjr9-WT0dwlUEbdTUA0rislOEVFkX6A/exec",
        {
          method: "POST",
          body: JSON.stringify({
            updateStatus: true,
            name,
            phone,
            status,
          }),
        }
      );

      alert("Estado actualizado ✅");

      // 🔄 recargar datos automáticamente
      loadData();

    } catch (error) {
      alert("Error actualizando estado");
      console.error(error);
    }
  };

  // 🎨 COLOR DEL STATUS
  const getColor = (status: string) => {
    if (status === "Pendiente") return "#ffc107";
    if (status === "En camino") return "#17a2b8";
    if (status === "Completado") return "#28a745";
    return "#ccc";
  };

  return (
    <div style={{ padding: 20, background: "#f5f5f5" }}>
      <h1>🚗 Panel PRO</h1>

      {data.map((row, i) => {
        const status = row[7] || "Pendiente"; // 🔥 ESTADO REAL DESDE SHEETS

        return (
          <div key={i} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h3>{row[1]}</h3>
              <span style={{ ...badge, background: getColor(status) }}>
                {status}
              </span>
            </div>

            <p>📞 {row[2]}</p>

            <div style={route}>
              <p>📍 {row[3]}</p>
              <p>➡️ {row[4]}</p>
            </div>

            <p>💰 ${row[5]} | 📏 {row[6]} mi</p>

            {/* 🔥 BOTONES REALES (GUARDAN EN GOOGLE SHEETS) */}
            <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
              <button onClick={() => updateStatus(row[1], row[2], "Pendiente")}>
                🟡
              </button>
              <button onClick={() => updateStatus(row[1], row[2], "En camino")}>
                🟢
              </button>
              <button onClick={() => updateStatus(row[1], row[2], "Completado")}>
                🔵
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 🎨 estilos
const card = {
  background: "white",
  padding: 15,
  borderRadius: 15,
  marginBottom: 15,
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
};

const route = {
  background: "#eee",
  padding: 10,
  borderRadius: 10,
};

const badge = {
  color: "white",
  padding: "4px 10px",
  borderRadius: 10,
  fontSize: 12,
};