"use client";

import { useEffect, useState, useRef } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  DirectionsRenderer
} from "@react-google-maps/api";

export default function TrackingPage() {
  const [posicionSuave, setPosicionSuave] =
    useState<{ lat: number; lng: number } | null>(null);
const [mostrarZelle, setMostrarZelle] = useState(false);
const [viajeId, setViajeId] = useState<string | null>(null);
  const [ruta, setRuta] =
    useState<google.maps.DirectionsResult | null>(null);
const [viajeData, setViajeData] = useState<any>(null);
const [cancelando, setCancelando] = useState(false);
  const [tiempo, setTiempo] = useState("");
  const [fase, setFase] = useState<"pickup" | "viaje">("pickup");
const ultimaPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<any>(null);
  const estiloBoton = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "none",
  fontSize: 16,
  cursor: "pointer",
  transition: "all 0.15s ease",
  boxShadow: "0 4px 0 rgba(0,0,0,0.2)"
};

const presionarBoton = (e: any) => {
  e.currentTarget.style.transform = "scale(0.96)";
  e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.2)";
};

const soltarBoton = (e: any) => {
  e.currentTarget.style.transform = "scale(1)";
  e.currentTarget.style.boxShadow = "0 4px 0 rgba(0,0,0,0.2)";
};

  // 📏 DISTANCIA ENTRE DOS PUNTOS
  const calcularDistancia = (a: any, b: any) => {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;

    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;

    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) *
      Math.cos(lat1) * Math.cos(lat2);

    const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

    return R * y;
  };

  // 📡 OBTENER DATOS DEL DRIVER
  const obtenerDriver = async () => {
  try {
    if (!viajeId) return;

    const res = await fetch(`/api/viajes?id=${viajeId}`);
    const viaje = await res.json();

    if (!viaje || viaje.length < 15) return;

    setViajeData(viaje);

    const estado = viaje[11];
      if (estado === "Finalizado" || estado === "Cancelado") {

  alert(
    estado === "Finalizado"
      ? "✅ Viaje finalizado"
      : "❌ Viaje cancelado"
  );

  // limpiar visual
  setPosicionSuave(null);
  setRuta(null);

  // 🔥 borrar SOLO tracking
  localStorage.removeItem("viajeId");
  localStorage.removeItem("viajeData");

  // ⏳ redirección limpia
  setTimeout(() => {
    window.location.href = "/";
  }, 300);

  return;
}

      const lat = parseFloat(viaje[13]);
      const lng = parseFloat(viaje[14]);
      if (isNaN(lat) || isNaN(lng)) {
  console.warn("Driver sin ubicación aún");
  return;
}

      const origenLat = parseFloat(viaje[5]);
      const origenLng = parseFloat(viaje[6]);

      const destinoLat = parseFloat(viaje[7]);
      const destinoLng = parseFloat(viaje[8]);

      // 🚗 mover carro
      if (!isNaN(lat) && !isNaN(lng)) {
        moverSuave({ lat, lng });
      }
const posicionAnterior = ultimaPosRef.current;

const seMovio =
  !posicionAnterior ||
  Math.abs(lat - posicionAnterior.lat) > 0.0001 ||
  Math.abs(lng - posicionAnterior.lng) > 0.0001;

// 🔥 SOLO SI SE MOVIÓ
if (seMovio) {
  ultimaPosRef.current = { lat, lng };

  if (
    !isNaN(lat) &&
    !isNaN(lng) &&
    !isNaN(origenLat) &&
    !isNaN(origenLng)
  ) {
    const distanciaAlOrigen = calcularDistancia(
      { lat, lng },
      { lat: origenLat, lng: origenLng }
    );

    if (distanciaAlOrigen > 0.1) {
      setFase("pickup");

      calcularRuta(
        { lat, lng },
        { lat: origenLat, lng: origenLng }
      );

    } else {
      setFase("viaje");

      if (!isNaN(destinoLat) && !isNaN(destinoLng)) {
        calcularRuta(
          { lat, lng },
          { lat: destinoLat, lng: destinoLng }
        );
      }
    }
  }
}
      

    } catch (error) {
      console.error("Error tracking:", error);
    }
  };

  // 🚗 MOVIMIENTO SUAVE
const moverSuave = (nuevaPos: { lat: number; lng: number }) => {

  // 👉 PRIMERA VEZ (evita error null)
  if (!posicionSuave) {
    setPosicionSuave(nuevaPos);
    return;
  }

  // 👉 si no hay cambio real, no hacer nada
  if (
    Math.abs(nuevaPos.lat - posicionSuave.lat) < 0.00001 &&
    Math.abs(nuevaPos.lng - posicionSuave.lng) < 0.00001
  ) {
    return;
  }

  // 👉 solo mover mapa si hay cambio real
  const distanciaMovimiento =
    Math.abs(nuevaPos.lat - posicionSuave.lat) +
    Math.abs(nuevaPos.lng - posicionSuave.lng);

  if (distanciaMovimiento > 0.0001) {
    mapRef.current?.panTo(nuevaPos);
  }

  const pasos = 20;

  const latStep = (nuevaPos.lat - posicionSuave.lat) / pasos;
  const lngStep = (nuevaPos.lng - posicionSuave.lng) / pasos;

  let i = 0;

  const intervalo = setInterval(() => {
    i++;

    setPosicionSuave((prev) =>
      prev
        ? {
            lat: prev.lat + latStep,
            lng: prev.lng + lngStep
          }
        : nuevaPos
    );

    if (i >= pasos) clearInterval(intervalo);
  }, 50);
};

  // 🗺️ CALCULAR RUTA + ETA
  const calcularRuta = (origen: any, destino: any) => {
    if (!window.google) return;

    const service = new window.google.maps.DirectionsService();

    service.route(
      {
        origin: origen,
        destination: destino,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === "OK" && result) {
          setRuta(result);

          const leg = result.routes[0].legs[0];
          if (leg?.duration?.text) {
            setTiempo(leg.duration.text);
          }
        }
      }
    );
  };

  // ❌ CANCELAR VIAJE
  const cancelarViaje = async () => {
  if (cancelando) return; // evita doble click

  setCancelando(true);

  try {
    const id = localStorage.getItem("viajeId");
    const viajeData = localStorage.getItem("viajeData");

    if (!id || !viajeData) {
      alert("No se encontró información del viaje");
      setCancelando(false);
      return;
    }

    const { nombre, telefono, origen, destino, precio, distancia } =
      JSON.parse(viajeData);

    // 🔥 1. CANCELAR EN SHEET
    const res = await fetch("/api/reservar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "cancelar",
        id
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert("Error cancelando");
      setCancelando(false);
      return;
    }

    // 🔥 2. WHATSAPP DRIVER
    const telefonoDriver = "17252876197";

    const mensaje =
      "❌ VIAJE CANCELADO\n\n" +
      "👤 Cliente: " + nombre + "\n" +
      "📞 Tel: " + telefono + "\n" +
      "📍 Origen: " + origen + "\n" +
      "🏁 Destino: " + destino + "\n" +
      "💰 Precio: $" + Number(precio).toFixed(2) + "\n" +
      "📏 Distancia: " + Number(distancia).toFixed(2) + " millas";

    window.open(
      `https://wa.me/${telefonoDriver}?text=${encodeURIComponent(mensaje)}`,
      "_blank"
    );

    // 🔥 3. LIMPIAR TRACKING
    localStorage.removeItem("viajeId");
    localStorage.removeItem("viajeData");

    // 🔥 4. REDIRECCIÓN
    setTimeout(() => {
      window.location.href = "/";
    }, 400);

  } catch (error) {
    console.error("Error cancelando:", error);
  } finally {
    setCancelando(false);
  }
};

  // 🔥 LEER ID (URL o localStorage)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const idFromUrl = params.get("id");

  const idFromStorage = localStorage.getItem("viajeId");

  const finalId = idFromUrl || idFromStorage;

  if (!finalId) {
  console.warn("No hay viajeId");
  return;
}

// 🔥 guardar SI viene por URL
if (idFromUrl) {
  localStorage.setItem("viajeId", idFromUrl);
}

setViajeId(finalId);
}, []);

// 🚀 CARGA INICIAL (cuando ya hay ID)
useEffect(() => {
  if (!viajeId) return;

  obtenerDriver();
}, [viajeId]);

// 🔁 ACTUALIZACIÓN CONTINUA
useEffect(() => {
  if (!viajeId) return;

  const interval = setInterval(() => {
    obtenerDriver();
  }, 3000);

  return () => clearInterval(interval);
}, [viajeId]);

// 💾 DATOS DEL VIAJE (UI)
useEffect(() => {
  const data = localStorage.getItem("viajeData");

  if (data) {
    setViajeData(JSON.parse(data));
  }
}, []);
  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <LoadScript
        googleMapsApiKey={
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
        }
      >
        <GoogleMap
  onLoad={(mapInstance) => {
    mapRef.current = mapInstance;
  }}
  mapContainerStyle={{ width: "100%", height: "100%" }}
  center={
    posicionSuave || { lat: 36.1699, lng: -115.1398 }
  }
  zoom={16}
>
  {/* 🚗 CARRO */}
  {posicionSuave && (
    <Marker
      position={posicionSuave}
      icon={{
        url: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
        scaledSize:
          typeof window !== "undefined" && window.google
            ? new window.google.maps.Size(40, 40)
            : undefined
      }}
    />
  )}

  {/* 🗺️ RUTA (AQUÍ VA) */}
  {ruta && (
    <DirectionsRenderer
      directions={ruta}
      options={{
        polylineOptions: {
          strokeColor: "#43cddf",
          strokeWeight: 5
        }
      }}
    />
  )}
</GoogleMap>

        {/* PANEL */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            width: "100%",
            background: "#fff",
            padding: 20,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20
          }}
        >
          <h3>
            {fase === "pickup"
              ? "🚗 The driver is on the way."
              : "🚗 En camino al destino"}
          </h3>

          <p>
            {fase === "pickup"
              ? "Arrives in " + (tiempo || "...")
              : "Arrival in " + (tiempo || "...")}
          </p>
          {viajeData && (
  <div style={{ marginTop: 10 }}>
    <h4 style={{ marginBottom: 5 }}>
  💳 Pay Here
</h4>

    <div style={{ display: "flex", gap: 10 }}>

      <button
  onClick={() => setMostrarZelle((prev) => !prev)}
  onMouseDown={presionarBoton}
  onMouseUp={soltarBoton}
  onMouseLeave={soltarBoton}
  style={{
    flex: 1,
    ...estiloBoton,
    background: "#6f42c1",
    color: "#fff"
  }}
>
  Zelle
</button>

      <button
  onClick={() =>
    window.open("https://www.paypal.com/paypalme/ernestogongorasaco")
  }
  onMouseDown={presionarBoton}
  onMouseUp={soltarBoton}
  onMouseLeave={soltarBoton}
  style={{
    flex: 1,
    ...estiloBoton,
    background: "#0070ba",
    color: "#fff"
  }}
>
  PayPal
</button>

      <button
  onClick={() =>
    window.open("https://venmo.com/code?user_id=...")
  }
  onMouseDown={presionarBoton}
  onMouseUp={soltarBoton}
  onMouseLeave={soltarBoton}
  style={{
    flex: 1,
    ...estiloBoton,
    background: "#3d95ce",
    color: "#fff"
  }}
>
  Venmo
</button>
{mostrarZelle && (
  <div
    style={{
      marginTop: 15,
      padding: 15,
      background: "#ffffff",
      borderRadius: 12,
      textAlign: "center",
      boxShadow: "0 4px 10px rgba(0,0,0,0.08)"
    }}
  >
    <p style={{ marginBottom: 5, fontWeight: "bold" }}>
      💳 Pago por Zelle
    </p>

    <p style={{ fontSize: 14, color: "#666" }}>
      Pay to Ernesto gongora saco:
    </p>

    <div
      style={{
        fontSize: 20,
        fontWeight: "bold",
        margin: "10px 0"
      }}
    >
      7252876197
    </div>

    <button
      onClick={() => {
        navigator.clipboard.writeText("7252876197");
        alert("Number copied");
      }}
      style={{
        padding: 10,
        borderRadius: 8,
        border: "none",
        background: "#000",
        color: "#fff",
        width: "100%"
      }}
    >
      Copy the number.
    </button>
  </div>
)}
    </div>
  </div>
)}

          <button
  onClick={cancelarViaje}
  onMouseDown={presionarBoton}
  onMouseUp={soltarBoton}
  onMouseLeave={soltarBoton}
  style={{
    ...estiloBoton,
    background: cancelando ? "#999" : "linear-gradient(145deg, #ff3b3b, #b30000)",
    color: "#fff",
    marginTop: 20,
    transform: cancelando ? "scale(0.95)" : "scale(1)",
    boxShadow: cancelando
      ? "0 2px 0 rgba(0,0,0,0.2)"
      : "0 6px 0 rgba(0,0,0,0.3)",
    transition: "all 0.15s ease"
  }}
>
  {cancelando ? "Canceling..." : "Cancel Ride"}
</button>
        </div>
      </LoadScript>
    </div>
  );
}