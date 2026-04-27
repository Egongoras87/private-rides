"use client";

import { useEffect, useState } from "react";

export default function DriverPage() {
  const [viajes, setViajes] = useState<any[]>([]);

  const URL =
    "https://script.google.com/macros/s/AKfycbyaLJPd6q1iipDqwytovCyoG0wJWesWQ_93_0tPS_9L6-RaGCR0Q53HpUfWJvKYf3XnWw/exec";

  const DRIVER_KEY = process.env.NEXT_PUBLIC_DRIVER_KEY;

  // 🔐 PROTECCIÓN SIMPLE
  useEffect(() => {
    const key = prompt("Ingrese clave de conductor");

    if (key !== DRIVER_KEY) {
      alert("Acceso denegado");
      window.location.href = "/";
    }
  }, []);

  // 📥 Obtener viajes
  const obtenerViajes = async () => {
    try {
      const res = await fetch("/api/viajes");
      const data = await res.json();

      console.log("DATA DRIVER:", data);

      // 🔥 PROTECCIÓN CONTRA ERROR
      if (!Array.isArray(data)) {
        console.error("Respuesta inválida:", data);
        return;
      }

      const filas = data.slice(1); // quitar encabezado

// 🔥 FILTRAR SOLO VIAJES ACTIVOS
const viajesActivos = filas.filter((v) =>
  ["Pendiente", "En camino"].includes(v[11])
);

// ordenar más recientes primero
setViajes(viajesActivos.reverse());

    } catch (error) {
      console.error("Error obteniendo viajes:", error);
    }
  };

  useEffect(() => {
    obtenerViajes();

    const interval = setInterval(() => {
      obtenerViajes();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 🚗 EN CAMINO
  const enCamino = (v: any) => {
  const id = v[0];
  const nombre = v[1];
  const telefono = v[2];
  const origen = v[3];

  navigator.geolocation.watchPosition(
    (pos) => {
      fetch("/api/reservar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "updateDriver",
          id,
          driverLat: pos.coords.latitude,
          driverLng: pos.coords.longitude
        })
      });
    },
    (err) => console.error(err),
    { enableHighAccuracy: true }
  );

  // 📲 MENSAJE WHATSAPP
  const mensaje =
    "🚗 The driver is on the way.\n\n" +
    "👤 Cliente: " + nombre + "\n" +
    "📍 Recogida: " + origen;

  const url =
    "https://wa.me/1" + telefono +
    "?text=" + encodeURIComponent(mensaje);

  window.open(url, "_blank");

  alert("🚗 En camino activado");
};

  // ✅ FINALIZAR
  const finalizar = async (id: number) => {
    try {
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify({
          action: "finalizar",
          id
        })
      });

      alert("✅ Viaje finalizado");

    } catch (error) {
      console.error("Error finalizar:", error);
    }
  };

  // ❌ CANCELAR
  const cancelar = async (v: any) => {
  const id = v[0];
  const nombre = v[1];
  const telefono = v[2];

  try {
    await fetch(URL, {
      method: "POST",
      body: JSON.stringify({
        action: "cancelar",
        id
      })
    });

    // 📲 WHATSAPP
    const mensaje =
      "❌ VIAJE CANCELADO\n\n" +
      "👤 Cliente: " + nombre + "\n" +
      "El conductor canceló el viaje.";

    const url =
      "https://wa.me/1" + telefono +
      "?text=" + encodeURIComponent(mensaje);

    window.open(url, "_blank");

    alert("❌ Viaje cancelado");

  } catch (error) {
    console.error("Error cancelar:", error);
  }
};

  return (
    <div style={{ padding: 20 }}>
      <h1>Panel Driver</h1>

      {viajes.length === 0 && <p>No hay viajes</p>}

      {viajes.map((v, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #ccc",
            marginBottom: 10,
            padding: 10,
            borderRadius: 10
          }}
        >
          <p><b>ID:</b> {v[0]}</p>
          <p><b>Nombre:</b> {v[1]}</p>
          <p><b>Tel:</b> {v[2]}</p>
          <p><b>Origen:</b> {v[3]}</p>
          <p><b>Destino:</b> {v[4]}</p>

          {/* 🔥 NUEVO */}
          <p><b>Distancia:</b> {Number(v[9]).toFixed(2)} millas</p>
          <p><b>Precio:</b> ${Number(v[10]).toFixed(2)}</p>

          <p><b>Estado:</b> {v[11]}</p>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => enCamino(v)}>
              🚗 En camino
            </button>

            <button onClick={() => finalizar(v[0])}>
              ✅ Finalizar
            </button>

            <button onClick={() => cancelar(v)}>
              ❌ Cancelar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}