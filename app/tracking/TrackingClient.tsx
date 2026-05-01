"use client";
export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";

export default function TrackingPage() {
  
  // 🔹 TODOS LOS STATES PRIMERO
  const [pos, setPos] = useState<any>(null);
  const [ruta, setRuta] = useState<any>(null);
  const [tiempo, setTiempo] = useState("");
  const [fase, setFase] = useState("pickup");
  const [mostrarZelle, setMostrarZelle] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [heading, setHeading] = useState(0);
  const [eta, setEta] = useState<number>(0);
  const [pickup, setPickup] = useState<any>(null);
const [destino, setDestino] = useState<any>(null);
const [viajeFinalizado, setViajeFinalizado] = useState(false);
const destinoRef = useRef<any>(null);
const pickupRef = useRef<any>(null);
  const lastGpsRef = useRef<any>(null);   // 📡 GPS
const lastMapRef = useRef<any>(null);   // 🗺️ cámara
  const animRef = useRef<any>(null);
const lastPanRef = useRef(0);
const [viajeCancelado, setViajeCancelado] = useState(false);

  // 🔹 REFS
  const mapRef = useRef<any>(null);
  const lastPos = useRef<any>(null);
  const lastRoute = useRef<number>(0);

  // 🔹 GOOGLE MAPS LOADER
  const { isLoaded } = useJsApiLoader(googleMapsConfig);

  // 🔹 MOUNTED FIX (HYDRATION)
  useEffect(() => {
    setMounted(true);
  }, []);

useEffect(() => {
  if (!eta) return;

  const interval = setInterval(() => {
    setEta((prev) => {
      if (prev <= 1) return 0;
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [eta]);

  // 📡 FIREBASE TRACKING
useEffect(() => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  const unsubscribe = onValue(viajeRef, (snap) => {
    const d = snap.val();
    console.log("🔥 SNAP:", d);
    // 🔥 CONTROL DE ESTADO REAL
if (d.estado === "En camino") {
  setFase("pickup");
} else if (d.estado === "En viaje") {
  setFase("viaje");
} else {
  setFase("espera"); // 👈 NUEVO
}

    if (!d) return;

    // 🔴 CANCELACIÓN (CORRECTO)
    if (d.estado === "Cancelado") {
      console.log("🚫 VIAJE CANCELADO");

      // 🔴 en usuario NO hay GPS que detener
console.log("Tracking detenido (usuario)");
      setRuta(null);
      setPos(null);
      setViajeCancelado(true);

      return;
    }
    // 🟢 FINALIZADO
if (d.estado === "Finalizado") {
  console.log("✅ VIAJE FINALIZADO");

  setRuta(null);
  setPos(null);
  setViajeFinalizado(true);

  return;
}

    // 🔥 DRIVER POSITION
   if (!d.driverLat || !d.driverLng || d.estado !== "En camino" && d.estado !== "En viaje") {
  console.log("⛔ Esperando driver...");
  return;
}

    const nueva = {
      lat: Number(d.driverLat),
      lng: Number(d.driverLng)
    };

    // 🚀 ANIMACIÓN SUAVE
    setPos((prev: any) => {
      if (!prev) return nueva;

      return {
        lat: prev.lat + (nueva.lat - prev.lat) * 0.15,
        lng: prev.lng + (nueva.lng - prev.lng) * 0.15
      };
    });

    // 🧠 MOVER MAPA
    if (mapRef.current) {
      if (!lastPos.current) {
        mapRef.current.panTo(nueva);
      } else {
        const dist = Math.hypot(
          nueva.lat - lastPos.current.lat,
          nueva.lng - lastPos.current.lng
        );

        if (dist > 0.0001) {
          mapRef.current.panTo(nueva);
        }
      }
    }

    // 🔥 GUARDAR POSICIÓN
    lastPos.current = nueva;

    // 🔥 CONTROL DE RUTA
    const now = Date.now();

    if (!lastRoute.current || now - lastRoute.current > 3000) {

      if (!isLoaded || !window.google?.maps?.DirectionsService) return;

      if (!d.origenLat || !d.origenLng) {
        console.log("⛔ Esperando origen...");
        return;
      }

      const origen = {
        lat: Number(d.origenLat),
        lng: Number(d.origenLng)
      };

      const destino =
        d.destinoLat && d.destinoLng
          ? {
              lat: Number(d.destinoLat),
              lng: Number(d.destinoLng)
            }
          : null;

      const service = new window.google.maps.DirectionsService();

      const distPickup = Math.hypot(
        nueva.lat - origen.lat,
        nueva.lng - origen.lng
      );

      // 🚗 PICKUP
      if (distPickup > 0.0015) {

        console.log("🔥 ROUTE PICKUP");

        service.route(
          {
            origin: nueva,
            destination: origen,
            travelMode: window.google.maps.TravelMode.DRIVING
          },
          (res: any, status: any) => {
            if (status === "OK") {
              setRuta(res);
              setEta(res.routes[0].legs[0].duration.value);
            }
          }
        );

      } else if (destino) {

        console.log("🔥 ROUTE VIAJE");

        service.route(
          {
            origin: origen,
            destination: destino,
            travelMode: window.google.maps.TravelMode.DRIVING
          },
          (res: any, status: any) => {
            if (status === "OK") {
              setRuta(res);
              setEta(res.routes[0].legs[0].duration.value);
            }
          }
        );
      }

      lastRoute.current = now;
    }
  });

  return () => unsubscribe();

}, [isLoaded]);

  // ❌ CANCELAR
  const cancelar = async () => {
  const id = localStorage.getItem("viajeId");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  const snap = await new Promise<any>((resolve) => {
    onValue(viajeRef, (s) => resolve(s.val()), { onlyOnce: true });
  });

  if (!snap) return;

  // 🔥 ACTUALIZAR ESTADO
  await update(viajeRef, { estado: "Cancelado" });

  // 🔥 MENSAJE WHATSAPP COMPLETO
  const mensaje = `
❌ VIAJE CANCELADO

ID: ${id}
Nombre: ${snap.nombre || ""}
Tel: ${snap.telefono || ""}
Origen: ${snap.origen || ""}
Destino: ${snap.destino || ""}
Importe: $${snap.precio || ""}
Distancia: ${snap.distancia || ""} mi
`;

  window.open(
    "https://wa.me/17252876197?text=" +
    encodeURIComponent(mensaje)
  );

  localStorage.clear();
  window.location.href = "/";
};

  // 🎯 BOTONES 3D
  const btn = (bg: string) => ({
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: bg,
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 4px 0 rgba(0,0,0,0.2)",
    transition: "0.15s"
  });

  const press = (e: any) => {
    e.target.style.transform = "scale(0.95)";
    e.target.style.boxShadow = "0 2px 0 rgba(0,0,0,0.2)";
  };

  const release = (e: any) => {
    e.target.style.transform = "scale(1)";
    e.target.style.boxShadow = "0 4px 0 rgba(0,0,0,0.2)";
  };
if (viajeFinalizado) {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      background: "#111",
      color: "#fff"
    }}>
      <h1>✅ Viaje finalizado</h1>

      <button
        onClick={() => {
          localStorage.clear();
          window.location.href = "/";
        }}
      >
        Volver
      </button>
    </div>
  );
}


  // 🔴 RETURNS (AL FINAL SIEMPRE)
  if (!mounted) return null;

  if (!isLoaded) return <div>Loading map...</div>;
if (viajeCancelado) {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#111",
      color: "#fff",
      flexDirection: "column"
    }}>
      <h2>❌ Ride declined</h2>
      <p>Please try again later</p>

      <button
        style={{
          marginTop: 20,
          padding: "10px 20px",
          borderRadius: 8,
          border: "none",
          background: "#28a745",
          color: "#fff",
          cursor: "pointer"
        }}
        onClick={() => {
          window.location.href = "/";
        }}
      >
        Volver al inicio
      </button>
    </div>
  );
}
  
  return (
  <div style={{ height: "100vh", position: "relative" }}>
    <GoogleMap
      onLoad={(map) => {
        mapRef.current = map;
      }}
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={pos || { lat: 36.1699, lng: -115.1398 }}
      zoom={16}
    >

      {ruta && (
  <DirectionsRenderer
  directions={ruta}
 options={{
  preserveViewport: true,
  suppressMarkers: false
}}
/>
)}

      {destino && (
        <Marker
          position={destino}
          icon={{
  url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  scaledSize:
    isLoaded && window.google
      ? new window.google.maps.Size(35, 35)
      : undefined
}}
        />
      )}

      {pos && (
       <Marker
  position={pos}
  icon={{
  url: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
  scaledSize:
    isLoaded && window.google
      ? new window.google.maps.Size(35, 35)
      : undefined
}}
/>
      )}

    </GoogleMap>

    {/* PANEL */}
    <div style={{
      position: "absolute",
      bottom: 0,
      width: "100%",
      background: "#fff",
      padding: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20
    }}>

      <h3>
 {fase === "espera"
  ? "⏳ Waiting for driver"
  : fase === "pickup"
  ? "🚗 Driver on the way"
  : "🚗 Trip in progress"}
</h3>

      <p>
        {eta > 0
          ? Math.ceil(eta / 60) + " min"
          : "Arriving..."}
      </p>

      <p>{pos?.lat} - {pos?.lng}</p>

      {/* 💳 PAY */}
      <div style={{ marginTop: 10 }}>
        <h4 style={{ marginBottom: 5 }}>💳 Pay Here</h4>

        <div style={{ display: "flex", gap: 10 }}>

          <button
            onClick={() => setMostrarZelle(prev => !prev)}
            onMouseDown={press}
            onMouseUp={release}
            onMouseLeave={release}
            style={{ ...btn("#6f42c1"), flex: 1 }}
          >
            Zelle
          </button>

          <button
            onClick={() =>
              window.open("https://www.paypal.com/paypalme/ernestogongorasaco")
            }
            onMouseDown={press}
            onMouseUp={release}
            onMouseLeave={release}
            style={{ ...btn("#0070ba"), flex: 1 }}
          >
            PayPal
          </button>

          <button
  onClick={() =>
    window.open(
      "https://venmo.com/code?user_id=4536118275999433880&created=1777529554",
      "_blank"
    )
  }
            onMouseDown={press}
            onMouseUp={release}
            onMouseLeave={release}
            style={{ ...btn("#3d95ce"), flex: 1 }}
          >
            Venmo
          </button>

        </div>

        {mostrarZelle && (
          <div style={{
            marginTop: 15,
            padding: 15,
            background: "#fff",
            borderRadius: 12,
            textAlign: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <p><b>💳 Zelle</b></p>
            <p>Ernesto Gongora Saco</p>

            <div style={{ fontSize: 20, fontWeight: "bold" }}>
              7252876197
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText("7252876197");
                alert("Número copiado");
              }}
              style={{ ...btn("#000"), width: "100%", marginTop: 10 }}
            >
              Copy Number
            </button>
          </div>
        )}
      </div>

      {/* ❌ CANCEL */}
      <button
  style={{ ...btn("red"), marginTop: 15, width: "100%" }}
  onMouseDown={press}
  onMouseUp={release}
  onMouseLeave={release}
  onClick={cancelar}
>
  Cancel Ride
</button>

    </div>
  </div>
);
}