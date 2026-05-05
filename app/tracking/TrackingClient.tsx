"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update, get } from "firebase/database";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";


export default function UserTrackingPage() {
  const { isLoaded } = useJsApiLoader(googleMapsConfig);

  // 🔥 MAPA
  const [pos, setPos] = useState<any>(null);
  const [path, setPath] = useState<any[]>([]);
  const [destinoMarker, setDestinoMarker] = useState<any>(null);
const [viajeData, setViajeData] = useState<any>(null);
  const lastMapRef = useRef<any>(null);
  const lastHeadingRef = useRef(0);
  const mapRef = useRef<any>(null);
  const lastRouteRef = useRef(0);

  // 🔥 UI
  const [eta, setEta] = useState(0);
  const [fase, setFase] = useState("espera");
 
  const [viajeCancelado, setViajeCancelado] = useState(false);
  const [viajeFinalizado, setViajeFinalizado] = useState(false);
  const lastEtaUpdateRef = useRef(0);
const handleLoad = (map: any) => {
  if (!map) return;

  mapRef.current = map;
};
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "/login-user";
    }
  });

  return () => unsub();
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
  // 🔥 TRACKING
  useEffect(() => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  const unsubscribe = onValue(viajeRef, (snap) => {
    const d = snap.val();

    // 🔒 NO DATA → limpiar todo
    if (!d) {
      setViajeData(null);
      setPos(null);
      setPath([]);
      setDestinoMarker(null);
      return;
    }

    setViajeData(d);

    // 🔴 1. FINALIZADO (PRIORIDAD MÁXIMA)
    if (d.estado === "Finalizado") {
      console.log("✅ VIAJE FINALIZADO (USER)");

      localStorage.removeItem("viajeId");
      localStorage.removeItem("viajeData");

      setViajeFinalizado(true);
      setViajeCancelado(false);

      setPos(null);
      setPath([]);
      setDestinoMarker(null);

      return; // 🚨 CRÍTICO
    }

    // 🔴 2. CANCELADO
    if (d.estado === "Cancelado") {
      console.log("❌ VIAJE CANCELADO (USER)");

      setViajeCancelado(true);
      setViajeFinalizado(false);

      setPos(null);
      setPath([]);
      setDestinoMarker(null);

      return; // 🚨 CRÍTICO
    }

    // 🟢 RESET estados UI
    setViajeFinalizado(false);
    setViajeCancelado(false);

    // 🟢 FASE
    if (d.estado === "En camino") setFase("pickup");
    else if (d.estado === "En viaje") setFase("viaje");

    // 🔒 VALIDACIÓN FUERTE DE COORDENADAS
    const lat = Number(d.driverLat);
    const lng = Number(d.driverLng);

    if (!isFinite(lat) || !isFinite(lng)) return;

    const nueva = { lat, lng };

    // 🔥 SUAVIZADO
    setPos((prev: any) => {
      if (!prev) return nueva;
      return {
        lat: prev.lat + (nueva.lat - prev.lat) * 0.35,
        lng: prev.lng + (nueva.lng - prev.lng) * 0.35
      };
    });

    // 🔥 ROTACIÓN SEGURA
    const prevPos = lastMapRef.current || nueva;

    const dx = nueva.lng - prevPos.lng;
    const dy = nueva.lat - prevPos.lat;

    let headingDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    if (headingDeg < 0) headingDeg += 360;

    if (!isFinite(headingDeg)) headingDeg = 0;

    const diff = headingDeg - lastHeadingRef.current;
    const adjustedDiff = ((diff + 540) % 360) - 180;

    lastHeadingRef.current += adjustedDiff * 0.35;

    // 🔥 CÁMARA
    if (mapRef.current) {
      const speed = Math.hypot(dx, dy);
      const zoom = speed > 0.0005 ? 15 : 17;

      mapRef.current.moveCamera({
        center: nueva,
        heading: lastHeadingRef.current || 0,
        tilt: 60,
        zoom
      });
    }

    lastMapRef.current = nueva;

    // 🔥 RUTA (OPTIMIZADA)
    const now = Date.now();

    if (
      d.destinoLat &&
      d.destinoLng &&
      (!lastRouteRef.current || now - lastRouteRef.current > 8000)
    ) {
      lastRouteRef.current = now;

      const service = new window.google.maps.DirectionsService();

      const destino =
        d.estado === "En camino"
          ? {
              lat: Number(d.origenLat),
              lng: Number(d.origenLng)
            }
          : {
              lat: Number(d.destinoLat),
              lng: Number(d.destinoLng)
            };

      // 🔒 VALIDACIÓN DESTINO
      if (!isFinite(destino.lat) || !isFinite(destino.lng)) return;

      service.route(
        {
          origin: nueva,
          destination: destino,
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (res: any, status: any) => {
          if (status !== "OK") return;

          const leg = res.routes[0].legs[0];

          const points = res.routes[0].overview_path.map((p: any) => ({
            lat: p.lat(),
            lng: p.lng()
          }));

          setPath(points);

          setDestinoMarker(destino);

          // 🔥 ETA CONTROLADO
          const now = Date.now();

          if (!lastEtaUpdateRef.current || now - lastEtaUpdateRef.current > 5000) {
            lastEtaUpdateRef.current = now;
            setEta(leg.duration.value);
          }
        }
      );
    }
  });

  return () => unsubscribe();
}, [isLoaded]);

  // /////////////////////////////////////////////////////////////❌ CANCELAR////////////////////////////////////////////
const cancelarViaje = async () => {
  try {
    // 🔥 obtener id de forma segura (mobile-proof)
    const id =
      new URLSearchParams(window.location.search).get("id") ||
      localStorage.getItem("viajeId");

    if (!id) {
      alert("No se encontró el viaje");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("Debes iniciar sesión");
      return;
    }

    const viajeRef = ref(db, "viajes/" + id);

    // 🔥 obtener datos (estable en móvil)
    const snap = await get(viajeRef);

    if (!snap.exists()) {
      alert("Viaje no encontrado");
      return;
    }

    const viaje = snap.val();

    // 🔥 CALCULAR TIEMPO
    const ahora = Date.now();
    const tiempo = ahora - (viaje.timestamp || ahora);
    const minutos = tiempo / 60000;

    let porcentaje = 0;

    if (minutos <= 2) porcentaje = 1;
    else if (minutos <= 5) porcentaje = 0.5;
    else porcentaje = 0;

    // 🔥 ALERTA ANTES DE CANCELAR (IMPORTANTE UX)
    if (viaje.metodoPago === "stripe") {
      const confirmar = confirm(
        porcentaje === 1
          ? "Cancelar viaje\n💳 Reembolso completo"
          : porcentaje === 0.5
          ? "Cancelar viaje\n💳 Reembolso parcial (50%)"
          : "Cancelar viaje\n❌ Sin reembolso"
      );

      if (!confirmar) return;
    }

    // 🔥 LIBERAR DRIVER + NOTIFICAR
    if (viaje.driverId) {
      await update(ref(db, "drivers/" + viaje.driverId), {
        viajeActivo: null
      });

      // 🔥 enviar WhatsApp si existe
      if (viaje.driverTelefono) {
        const mensaje =
          "❌ VIAJE CANCELADO\n\n" +
          "El cliente canceló el viaje.\n\n" +
          "📍 " + viaje.origen + "\n" +
          "🏁 " + viaje.destino;

        const url = `https://wa.me/1${viaje.driverTelefono}?text=${encodeURIComponent(mensaje)}`;

        // ⚠️ en móvil NO bloquea si es dentro de interacción
        window.open(url, "_blank");
      }
    }

    // 🔥 CANCELAR VIAJE
    await update(viajeRef, {
      estado: "Cancelado",
      driverId: null,
      canceladoEn: Date.now()
    });

    // 🔥 REEMBOLSO
    if (
      viaje.metodoPago === "stripe" &&
      viaje.paymentIntentId &&
      porcentaje > 0
    ) {
      const token = await user.getIdToken(true);

      await fetch("/api/refund-cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          viajeId: id,
          percent: porcentaje
        }),
      });
    }

    // 🔥 FINALIZAR TRACKING (IMPORTANTE)
    localStorage.removeItem("viajeId");

    alert("❌ Viaje cancelado");

    // 🔥 REDIRECCIÓN SEGURA (MÓVIL)
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);

  } catch (err) {
    console.error("ERROR CANCELAR:", err);
    alert("Error cancelando viaje");
  }
};
  //////////////////////////////////////////////////////// 🎯 BOTONES///////////////////////////////////////
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

  if (!isLoaded) return <div>Loading...</div>;

  if (viajeCancelado) {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "#111",
      color: "#fff",
      gap: 20
    }}>
      <h2>❌ Ride canceled</h2>

      <button
        style={{
          padding: 14,
          borderRadius: 10,
          border: "none",
          background: "#dc3545",
          color: "#fff",
          fontSize: 16,
          cursor: "pointer"
        }}
        onClick={() => {
          window.location.href = "/";
        }}
      >
        🔙 Back to Home
      </button>
    </div>
  );
}
  if (viajeFinalizado) {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "#111",
      color: "#fff",
      gap: 20
    }}>
      <h2>✅ Trip completed</h2>

      <button
        style={{
          padding: 14,
          borderRadius: 10,
          border: "none",
          background: "#28a745",
          color: "#fff",
          fontSize: 16,
          cursor: "pointer"
        }}
        onClick={() => {
          window.location.href = "/";
        }}
      >
        🔙 Back to Home
      </button>
    </div>
  );
}

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <GoogleMap
  onLoad={handleLoad}
  mapContainerStyle={{ width: "100%", height: "100%" }}
  center={pos || { lat: 36.1699, lng: -115.1398 }}
  zoom={17}
  options={{
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: "greedy",

  }}
>

{path.length > 0 && (
  <Polyline
    path={path}
    options={{
      strokeColor: "#000",
      strokeOpacity: 1,
      strokeWeight: 5
    }}
  />
)}

{pos && (
  <>
    {/* 🔵 CÍRCULO */}
<Marker
  position={pos}
  icon={{
    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
       fillColor: "#1494df",
    fillOpacity: 0.15, // 🔥 efecto glow
    strokeColor: "#1e87a1",
    strokeWeight: 1
  }}
  zIndex={0}
/>

{/* núcleo sólido */}
<Marker
  position={pos}
  icon={{
    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
    scale: 17,
    fillColor: "#0c0c0c",
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 2
  }}
  zIndex={1}
/>
<Marker
  position={pos}
  icon={{
    path: window.google?.maps?.SymbolPath?.FORWARD_CLOSED_ARROW || 0,
    scale: 5,
    fillColor: "#fff",
    fillOpacity: 1,
    strokeColor: "#000",
    strokeWeight: 1,
    rotation: lastHeadingRef.current || 0,
    anchor: new window.google.maps.Point(0, 2)
  }}
  zIndex={2}
/>
{destinoMarker && (
  <Marker
    position={destinoMarker}
   icon={{
  path: `
    M 0,0 m -4,0 a 4,4 0 1,0 8,0 a 4,4 0 1,0 -8,0
    M 0,-20 L 0,0
    M 0,-20 L 10,-16 L 0,-12 Z
  `,
  fillColor: "#ff0000",
  fillOpacity: 1,
  strokeColor: "#000",
  strokeWeight: 2,
  scale: 1.8
}}
    zIndex={3}
  />
)}
  </>
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
  : "🚗 Ride in progress"}
</h3>

      <p>
        {eta > 0
          ? Math.ceil(eta / 60) + " min"
          : "Arriving..."}
      </p>

  
     {/* 💵 INFO DE PAGO */}
<div style={{ marginTop: 10 }}>

{viajeData?.metodoPago === "stripe" ? (
  <p style={{ color: "green", fontWeight: "bold" }}>
    💳 Paid (${viajeData?.precio?.toFixed(2)})
  </p>
) : (
  <p style={{ fontWeight: "bold", color: "#000" }}>
    💵 Pay ${viajeData?.precio?.toFixed(2)} to driver
  </p>
)}

</div>

{/* ⚠️ AVISO CANCELACIÓN */}
<p style={{ fontSize: 12, color: "#686666", marginTop: 5 }}>
  Cancellations after 2 minutes may incur charges.
</p>

      {/* ❌ CANCEL */}
      <button
  style={{ ...btn("red"), marginTop: 15, width: "100%" }}
  onMouseDown={press}
  onMouseUp={release}
  onMouseLeave={release}
 onClick={() => {
    const ok = confirm(
      "Canceling may incur a fee, depending on the timing..\n\nDo you wish to continue"
    );
    if (ok) cancelarViaje();
  }}
>
  Cancel Ride
</button>

    </div>
  </div>
);
}