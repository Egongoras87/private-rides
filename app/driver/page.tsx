"use client";

import { useEffect, useState, useRef } from "react";

const pressIn = (e: any) => {
  e.currentTarget.style.transform = "scale(0.95)";
  e.currentTarget.style.opacity = "0.8";
};

const pressOut = (e: any) => {
  e.currentTarget.style.transform = "scale(1)";
  e.currentTarget.style.opacity = "1";
};

type Ride = string[];

export default function DriverPage() {

  const [rides, setRides] = useState<Ride[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState("");
  const [lastCount, setLastCount] = useState(0);
  const [lastHash, setLastHash] = useState("");
  const ridesRef = useRef<string>("");
  const watchRef = useRef<any>(null);

  const PASSWORD = "8887";

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzxbADQMOyzmYTPHZoLrHAZtMRYNrJjGDTQq8FbJkNlvcGEuZvAl7hUPFlrwAcHZFa-BA/exec";

  // 🔥 LOAD DATA
  const loadData = async () => {
    try {
      const res = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv", {
        cache: "no-store"
      });

      const text = await res.text();

      const rows = text
        .split("\n")
        .slice(1)
        .map(r =>
          r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c =>
            c.replace(/(^"|"$)/g, "").trim()
          )
        )
        .filter(r => r.length >= 7);

      const newHash = rows.length + (rows[0]?.join() || "");
      if (newHash === lastHash) return;
      setLastHash(newHash);

      if (rows.length > lastCount && lastCount > 0) {
        new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg").play();
      }

      setLastCount(rows.length);

      const sorted = rows.sort((a, b) =>
        new Date(a[6]).getTime() - new Date(b[6]).getTime()
      );

      const filtered = sorted.filter(r =>
        r[7] !== "Cancelado" && r[7] !== "Completado"
      );

      const unique = filtered.filter(
        (v, i, a) =>
          a.findIndex(t => t[1] === v[1] && t[6] === v[6]) === i
      );

      const newData = JSON.stringify(unique);

      if (newData !== ridesRef.current) {
        ridesRef.current = newData;
        setRides(unique);
      }

    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  // 📡 GPS
  const sendLocation = (phone: string, dateTime: string, lat: number, lng: number) => {
    fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updateLocation: true,
        phone,
        dateTime,
        lat,
        lng
      })
    });
  };

  // 🔄 STATUS (CORREGIDO)
  const updateStatus = async (name: string, phone: string, dateTime: string, status: string) => {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateStatus: true,
          name,
          phone,
          dateTime,
          status
        })
      });
    } catch (e) {
      console.error("Error status:", e);
    }
  };

  // 🔐 LOGIN
  if (!authorized) {
    return (
      <div style={{ padding: 20 }}>
        <h2>🔐 Driver</h2>
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
          onMouseDown={pressIn}
          onMouseUp={pressOut}
        >
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <h2>🚗 Driver PRO</h2>

      {rides.map((r, i) => {

        const name = r[0];
        const phone = r[1];
        const pickup = r[2];
        const dropoff = r[3];
        const price = r[4];
        const distance = r[5];
        const dateTime = r[6];
        const status = r[7] || "Pendiente";

        return (
          <div key={`${phone}-${dateTime}-${i}`} style={card}>

            <b>{name}</b>
            <p>📅 {new Date(dateTime).toLocaleString()}</p>
            <p>📞 {phone}</p>
            <p>📍 {pickup}</p>
            <p>➡️ {dropoff}</p>
            <p>💰 ${price} | 📏 {distance} mi</p>
            <p>📌 Estado: {status}</p>

            {/* 🚗 IR A RECOGER */}
            <button
              onClick={() => {

                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup)}`);

                updateStatus(name, phone, dateTime, "En camino");

                if (watchRef.current) {
                  navigator.geolocation.clearWatch(watchRef.current);
                }

                if ("geolocation" in navigator) {
                  watchRef.current = navigator.geolocation.watchPosition((pos) => {
                    sendLocation(
                      phone,
                      new Date(dateTime).toISOString(),
                      pos.coords.latitude,
                      pos.coords.longitude
                    );
                  });
                }

                const msg = `🚗 Tu conductor va en camino

📍 Origen: ${pickup}
⏱️ Hora: ${dateTime}`;

                window.open(`https://wa.me/1${phone}?text=${encodeURIComponent(msg)}`);
              }}
              style={btnNav}
              onMouseDown={pressIn}
              onMouseUp={pressOut}
              onTouchStart={pressIn}
              onTouchEnd={pressOut}
            >
              🚗 Ir a recoger
            </button>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>

              <button
                onClick={() => updateStatus(name, phone, dateTime, "Pendiente")}
                style={{ ...btn, background: "#ffc107" }}
                onMouseDown={pressIn}
                onMouseUp={pressOut}
              >
                🟡 Pendiente
              </button>

              <button
                onClick={() => updateStatus(name, phone, dateTime, "Completado")}
                style={{ ...btn, background: "#28a745" }}
                onMouseDown={pressIn}
                onMouseUp={pressOut}
              >
                ✅ Finalizar
              </button>

              <button
                onClick={() => {
                  if (!confirm("¿Cancelar viaje?")) return;

                  updateStatus(name, phone, dateTime, "Cancelado");

                  const msg = `❌ VIAJE CANCELADO`;
                  window.open(`https://wa.me/1${phone}?text=${encodeURIComponent(msg)}`);
                }}
                style={{ ...btn, background: "#dc3545" }}
                onMouseDown={pressIn}
                onMouseUp={pressOut}
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

// estilos
const btn = {
  flex: 1,
  padding: 10,
  color: "white",
  borderRadius: 12,
  border: "none",
  fontSize: 12,
  fontWeight: "bold",
  minWidth: 100,
  transition: "all 0.15s ease",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
};

const btnNav = {
  width: "100%",
  padding: 12,
  background: "#007bff",
  color: "white",
  borderRadius: 12,
  border: "none",
  fontWeight: "bold",
  transition: "all 0.15s ease",
  boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
};

const btnMain = { width: "100%", padding: 12, background: "black", color: "white", borderRadius: 10 };
const input = { width: "100%", padding: 10, marginBottom: 10, borderRadius: 10 };
const card = { background: "white", padding: 12, borderRadius: 12, marginBottom: 10 };