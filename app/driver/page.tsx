"use client";
import { LoadScript } from "@react-google-maps/api";
import { useEffect, useState, useRef } from "react";

export default function DriverPage() {
  const [viajes, setViajes] = useState<any[]>([]);
  const watchRef = useRef<number | null>(null);
  const [etas, setEtas] = useState<any>({});
  const DRIVER_KEY = process.env.NEXT_PUBLIC_DRIVER_KEY;

  // 🔐 PROTECCIÓN
  useEffect(() => {
    const key = sessionStorage.getItem("driver_key");

    if (!key) {
      const input = prompt("Driver access key:");
      sessionStorage.setItem("driver_key", input || "");
    }

    if (sessionStorage.getItem("driver_key") !== DRIVER_KEY) {
      alert("Access denied");
      window.location.href = "/";
    }
  }, []);

  // 🧠 FORMATEAR FECHA
  const formatearFechaHora = (fecha: string) => {
    if (!fecha) return { fecha: "", hora: "" };

    const d = new Date(fecha);

    return {
      fecha: d.toLocaleDateString("en-US"),
      hora: d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };
  };

  // 📥 OBTENER VIAJES
  const obtenerViajes = async () => {
  try {
    if (!navigator.onLine) {
      console.warn("Sin conexión...");
      return;
    }

    const res = await fetch("/api/viajes", {
      cache: "no-store"
    });

    if (!res.ok) throw new Error("HTTP error");

    const text = await res.text();

    if (text.startsWith("<!DOCTYPE")) {
      console.warn("HTML recibido, ignorando...");
      return;
    }

    const data = JSON.parse(text);

    if (!Array.isArray(data)) return;

    const filas = data.slice(1);

    const viajesActivos = filas.filter((v: any) =>
      Array.isArray(v) &&
      v.length > 11 &&
      ["Pendiente", "En camino"].includes(v[11])
    );

    const viajesOrdenados = [...viajesActivos].sort(
      (a, b) =>
        new Date(b[12]).getTime() -
        new Date(a[12]).getTime()
    );

    setViajes(viajesOrdenados);

  } catch (error) {
    console.error("⚠️ Error obteniendo viajes:", error);

    // 🔁 reintento automático
    setTimeout(() => {
      obtenerViajes();
    }, 5000);
  }
};
useEffect(() => {
  const calcularTodos = async () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const driverPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      const nuevosEtas: any = {};

      for (const v of viajes) {
        const id = v[0];

        const origen = {
          lat: parseFloat(v[5]),
          lng: parseFloat(v[6])
        };

        const destino = {
          lat: parseFloat(v[7]),
          lng: parseFloat(v[8])
        };

        // 🚗 ETA al pickup
        const etaPickup = await calcularETA(driverPos, origen);

        // 🚗 ETA al destino (desde pickup)
        const etaDestino = await calcularETA(origen, destino);

        // ⏱️ TIEMPO PROGRAMADO
        const fechaViaje = new Date(v[12]).getTime();
        const ahora = Date.now();

        const diferenciaMin = (fechaViaje - ahora) / 60000;

        // 🔥 retraso (negativo si vas tarde)
        const retraso = diferenciaMin - etaPickup;

        nuevosEtas[id] = {
          pickup: etaPickup,
          destino: etaDestino,
          retraso
        };
      }

      setEtas(nuevosEtas);
    });
  };

  if (viajes.length > 0) {
    calcularTodos();
  }
}, [viajes]);
  useEffect(() => {
  obtenerViajes();

  const interval = setInterval(() => {
    if (document.visibilityState === "visible") {
      obtenerViajes();
    }
  }, 7000);

  return () => clearInterval(interval);
}, []);

  // 🚗 EN CAMINO
const enCamino = async (v: any) => {
  const id = v[0];
  const telefono = "1" + String(v[2]).replace(/\D/g, "");
  const origen = v[3];

  const lat = parseFloat(v[5]);
  const lng = parseFloat(v[6]);

  const trackingUrl = `${window.location.origin}/tracking?id=${id}`;

  // 🚀 GPS INMEDIATO (CLAVE)
  navigator.geolocation.getCurrentPosition(async (pos) => {
    await fetch("/api/reservar", {
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
  });

  // 🔁 GPS CONTINUO
  if (watchRef.current !== null) {
    navigator.geolocation.clearWatch(watchRef.current);
  }

  watchRef.current = navigator.geolocation.watchPosition(
  async (pos) => {
    await fetch("/api/reservar", {
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
  (err) => {
    console.error("GPS error:", err);
  },
  {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000,
   
  }
);
setInterval(() => {
  navigator.geolocation.getCurrentPosition(async (pos) => {
    await fetch("/api/reservar", {
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
  });
}, 2000);

  // 🔄 ESTADO
  const resEstado = await fetch("/api/reservar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "enCamino",
      id
    })
  });

  const dataEstado = await resEstado.json();
  if (!dataEstado.success) {
    console.error("Error estado");
  }

  // 🗺️ MAPA
  if (!isNaN(lat) && !isNaN(lng)) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      "_blank"
    );
  }

  // 📲 WHATSAPP
  setTimeout(() => {
  window.open(
    "https://wa.me/" + telefono +
      "?text=" + encodeURIComponent(
        "🚗 Driver on the way\n\n📡 Track:\n" + trackingUrl
      ),
    "_blank"
  );
}, 1200);

  alert("🚗 En camino activado");
};

  // ✅ FINALIZAR
  const finalizar = async (id: number) => {
    try {
      await fetch("/api/reservar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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
    const telefono = String(v[2]).replace(/\D/g, "");

    try {
      await fetch("/api/reservar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "cancelar",
          id
        })
      });

      const mensaje =
        "❌ VIAJE CANCELADO\n\n" +
        "👤 Cliente: " + nombre + "\n" +
        "El conductor canceló el viaje.";

      window.open(
        "https://wa.me/1" + telefono +
          "?text=" + encodeURIComponent(mensaje),
        "_blank"
      );

      alert("❌ Viaje cancelado");

    } catch (error) {
      console.error("Error cancelar:", error);
    }
  };

  const calcularETA = (origen: any, destino: any): Promise<number> => {
  return new Promise((resolve) => {
    if (!window.google || !window.google.maps) return resolve(0);

    const service = new window.google.maps.DirectionsService();

    service.route(
      {
        origin: origen,
        destination: destino,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === "OK" && result) {
          const leg = result.routes[0].legs[0];
          const minutos = leg.duration?.value
            ? leg.duration.value / 60
            : 0;

          resolve(minutos);
        } else {
          resolve(0);
        }
      }
    );
  });
};
return (
  <LoadScript
    googleMapsApiKey={
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
    }
  >
    <div style={{ padding: 20 }}>
      <h1>Panel Driver</h1>

      {viajes.length === 0 && <p>No hay viajes</p>}

      {viajes.map((v, i) => {
        const fh = formatearFechaHora(v[12]);

        return (
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

            <p><b>Date:</b> {fh.fecha}</p>
            <p><b>Time:</b> {fh.hora}</p>

            <p><b>Distancia:</b> {Number(v[9]).toFixed(2)} millas</p>
            <p><b>Precio:</b> ${Number(v[10]).toFixed(2)}</p>

            {etas[v[0]] && (
              <>
                <p>⏱️ Pickup ETA: {etas[v[0]].pickup.toFixed(1)} min</p>
                <p>🏁 Trip ETA: {etas[v[0]].destino.toFixed(1)} min</p>

                <p
                  style={{
                    color: etas[v[0]].retraso < 0 ? "red" : "green"
                  }}
                >
                  {etas[v[0]].retraso < 0
                    ? `⚠️ Late by ${Math.abs(etas[v[0]].retraso).toFixed(1)} min`
                    : `✔ On time (${etas[v[0]].retraso.toFixed(1)} min)`}
                </p>
              </>
            )}

            <p><b>Estado:</b> {v[11]}</p>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => enCamino(v)}>🚗 En camino</button>
              <button onClick={() => finalizar(v[0])}>✅ Finalizar</button>
              <button onClick={() => cancelar(v)}>❌ Cancelar</button>
            </div>
          </div>
        );
      })}
    </div>
  </LoadScript>
);
}