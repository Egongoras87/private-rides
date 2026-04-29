"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, DirectionsRenderer, LoadScript } from "@react-google-maps/api";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { useJsApiLoader } from "@react-google-maps/api";
export default function TrackingPage() {

  const [pos, setPos] = useState<any>(null);
  const [ruta, setRuta] = useState<any>(null);
  const [tiempo, setTiempo] = useState("");
  const [fase, setFase] = useState("pickup");
  const [mostrarZelle, setMostrarZelle] = useState(false);

  const mapRef = useRef<any>(null);
  const lastPos = useRef<any>(null);
  const lastRoute = useRef<number>(0);
  const { isLoaded } = useJsApiLoader({
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
});

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

  // 📡 FIREBASE TRACKING
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    const viajeRef = ref(db, "viajes/" + id);

    return onValue(viajeRef, (snap) => {
      const d = snap.val();
      if (!d || !d.driverLat) return;

      const nueva = { lat: d.driverLat, lng: d.driverLng };

      // 🔥 MOVIMIENTO SUAVE
      setPos((prev: any) => {
        if (!prev) return nueva;

        return {
          lat: prev.lat + (nueva.lat - prev.lat) * 0.2,
          lng: prev.lng + (nueva.lng - prev.lng) * 0.2
        };
      });

      mapRef.current?.panTo(nueva);

      // 🧠 CONTROL DE RUTA
      const now = Date.now();

      if (now - lastRoute.current > 4000) {

        const origen = { lat: d.origenLat, lng: d.origenLng };
        const destino = { lat: d.destinoLat, lng: d.destinoLng };

        const dist = Math.hypot(
          nueva.lat - origen.lat,
          nueva.lng - origen.lng
        );

        const target = dist > 0.02 ? origen : destino;

        setFase(dist > 0.02 ? "pickup" : "viaje");

        if (window.google) {
          const service = new window.google.maps.DirectionsService();

          service.route(
            {
              origin: nueva,
              destination: target,
              travelMode: "DRIVING"
            },
            (res: any, status: any) => {
              if (status === "OK") {
                setRuta(res);
                setTiempo(res.routes[0].legs[0].duration.text);
              }
            }
          );
        }

        lastRoute.current = now;
      }
    });

  }, []);

  // ❌ CANCELAR
  const cancelar = async () => {
    const id = localStorage.getItem("viajeId");
    if (!id) return;

    await update(ref(db, "viajes/" + id), { estado: "Cancelado" });

    window.open(
      "https://wa.me/17252876197?text=" +
      encodeURIComponent("❌ VIAJE CANCELADO")
    );

    localStorage.clear();
    location.href = "/";
  };

   
   if (!isLoaded) {
  return <div>Loading map...</div>;
}

return (
  <div style={{ height: "100vh", position: "relative" }}>
    <GoogleMap
      onLoad={(map) => {
        mapRef.current = map;
      }}
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={{ lat: 36.1699, lng: -115.1398 }}
      zoom={16}
    >

      {pos && <Marker position={pos} />}

      {ruta && <DirectionsRenderer directions={ruta} />}

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
          {fase === "pickup"
            ? "🚗 Driver on the way"
            : "🚗 En ruta"}
        </h3>

        <p>{tiempo || "Calculando..."}</p>

        {/* PAGOS */}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btn("#6f42c1")} onMouseDown={press} onMouseUp={release}
            onClick={() => setMostrarZelle(!mostrarZelle)}>Zelle</button>

          <button style={btn("#0070ba")} onMouseDown={press} onMouseUp={release}
            onClick={() => window.open("https://paypal.me")}>PayPal</button>

          <button style={btn("#3d95ce")} onMouseDown={press} onMouseUp={release}
            onClick={() => window.open("https://venmo.com")}>Venmo</button>
        </div>

        {mostrarZelle && (
          <div style={{ marginTop: 10 }}>
            <b>7252876197</b>
          </div>
        )}

        <button
          style={{ ...btn("red"), marginTop: 15 }}
          onMouseDown={press}
          onMouseUp={release}
          onClick={cancelar}
        >
          Cancel Ride
        </button>

      </div>
    </div>
  );
}