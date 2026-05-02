"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";

export default function UserTrackingPage() {
  const { isLoaded } = useJsApiLoader(googleMapsConfig);

  // 🔥 MAPA
  const [pos, setPos] = useState<any>(null);
  const [path, setPath] = useState<any[]>([]);
  const [destinoMarker, setDestinoMarker] = useState<any>(null);

  const lastMapRef = useRef<any>(null);
  const lastHeadingRef = useRef(0);
  const mapRef = useRef<any>(null);
  const [pulse, setPulse] = useState(0);

  // 🔥 UI
  const [eta, setEta] = useState(0);
  const [fase, setFase] = useState("espera");
  const [mostrarZelle, setMostrarZelle] = useState(false);
  const [viajeCancelado, setViajeCancelado] = useState(false);
  const [viajeFinalizado, setViajeFinalizado] = useState(false);
  const lastEtaUpdateRef = useRef(0);
const handleLoad = (map: any) => {
  if (!map) return;

  mapRef.current = map;
};
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
      if (!d) return;

      // 🔴 estados
      if (d.estado === "Cancelado") {
        setViajeCancelado(true);
        setPos(null);
        setPath([]);
        return;
      }

      if (d.estado === "Finalizado") {
        setViajeFinalizado(true);
        setPos(null);
        setPath([]);
        return;
      }

      if (d.estado === "En camino") setFase("pickup");
      if (d.estado === "En viaje") setFase("viaje");

      if (!d.driverLat || !d.driverLng) return;

      const nueva = {
        lat: Number(d.driverLat),
        lng: Number(d.driverLng)
      };

      // 🔥 suavizado
      setPos((prev: any) => {
        if (!prev) return nueva;
        return {
          lat: prev.lat + (nueva.lat - prev.lat) * 0.35,
          lng: prev.lng + (nueva.lng - prev.lng) * 0.35
        };
      });

      // 🔥 ROTACIÓN
      const dx = nueva.lng - (lastMapRef.current?.lng || nueva.lng);
      const dy = nueva.lat - (lastMapRef.current?.lat || nueva.lat);

      let headingDeg = Math.atan2(dy, dx) * (180 / Math.PI);
      if (headingDeg < 0) headingDeg += 360;

      const diff = headingDeg - lastHeadingRef.current;
      const adjustedDiff = ((diff + 540) % 360) - 180;

      lastHeadingRef.current += adjustedDiff * 0.35;

      if (!isFinite(lastHeadingRef.current)) {
        lastHeadingRef.current = headingDeg;
      }

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

     // 🔥 RUTA
if (d.destinoLat && d.destinoLng) {
  const service = new window.google.maps.DirectionsService();

  service.route(
    {
      origin: nueva,
      destination: {
        lat: Number(d.destinoLat),
        lng: Number(d.destinoLng)
      },
      travelMode: window.google.maps.TravelMode.DRIVING
    },
    (res: any, status: any) => {
      if (status === "OK") {
        const points = res.routes[0].overview_path.map((p: any) => ({
          lat: p.lat(),
          lng: p.lng()
        }));

        setPath(points);
        setDestinoMarker(points[points.length - 1]);

        // 🔥 CONTROL INTELIGENTE DE ETA (cada 5 segundos)
        const now = Date.now();

        if (
          !lastEtaUpdateRef.current ||
          now - lastEtaUpdateRef.current > 5000
        ) {
          lastEtaUpdateRef.current = now;

          setEta(res.routes[0].legs[0].duration.value);
        }
      }
    }
  );
}
    });

    return () => unsubscribe();
  }, [isLoaded]);

  // ❌ CANCELAR
  const cancelar = async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    await update(ref(db, "viajes/" + id), {
      estado: "Cancelado"
    });

    window.location.href = "/";
  };

  // 🎯 BOTONES
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

  if (viajeCancelado) return <div>❌ Ride canceled</div>;
  if (viajeFinalizado) return <div>✅ Trip completed</div>;

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
    mapId: "DEMO_MAP_ID"
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
    scale: 18 + pulse, // 🔥 animación
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