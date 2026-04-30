"use client";
export const dynamic = "force-dynamic";

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
    

    return onValue(viajeRef, (snap) => {
  const d = snap.val();
  if (!d) return;
  

  // 🚨 DETECTAR FINALIZADO
if (d.estado === "Finalizado") {
  setViajeFinalizado(true);
  return;
}

// 🚨 DETECTAR CANCELADO
if (d.estado === "Cancelado") {
  setViajeFinalizado(true);
  return;
}

  // 🔥 AHORA SÍ VALIDAS GPS
  if (!d.driverLat) return;
    if (!pickup && d.origenLat && d.origenLng) {
  setPickup({
    lat: Number(d.origenLat),
    lng: Number(d.origenLng)
  });
}

if (!destino && d.destinoLat && d.destinoLng) {
  setDestino({
    lat: Number(d.destinoLat),
    lng: Number(d.destinoLng)
  });
}

      const nueva = {
  lat: Number(d.driverLat),
  lng: Number(d.driverLng)
  
};



      // 🔥 1. MOVER MAPA (FUERA de setPos)
if (mapRef.current) {
  if (!lastPos.current) {
    mapRef.current.panTo(nueva);
  } else {
    const distMove = Math.hypot(
      nueva.lat - lastPos.current.lat,
      nueva.lng - lastPos.current.lng
    );

    if (distMove > 0.001) {
      mapRef.current.panTo(nueva);
    }
  }
}

// 🔥 2. ACTUALIZAR POSICIÓN SUAVE
setPos((prev: any) => {
  if (!prev) return nueva;

  const dy = nueva.lat - prev.lat;
  const dx = nueva.lng - prev.lng;
  const angulo = Math.atan2(dy, dx) * (180 / Math.PI);

  setHeading(angulo);

  return {
    lat: prev.lat + (nueva.lat - prev.lat) * 0.7,
    lng: prev.lng + (nueva.lng - prev.lng) * 0.7
  };
});


// 🔥 3. GUARDAR ÚLTIMA POSICIÓN
lastPos.current = nueva;

      // 🧠 CONTROL DE RUTA
      const now = Date.now();

      if (now - lastRoute.current > 10000) {

       const origen = {
  lat: Number(d.origenLat),
  lng: Number(d.origenLng)
};

const destino = {
  lat: Number(d.destinoLat),
  lng: Number(d.destinoLng)
};

        if (window?.google?.maps?.DirectionsService) {
  const service = new window.google.maps.DirectionsService();

  // 🔥 DISTANCIA DRIVER → ORIGEN
  const distPickup = Math.hypot(
    nueva.lat - origen.lat,
    nueva.lng - origen.lng
  );

  // 🚗 FASE 1: IR A RECOGER
  if (distPickup > 0.02) {
    setFase("pickup");

    service.route(
      {
        origin: nueva,
        destination: origen,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (res: any, status: any) => {
        if (status === "OK") {
          setRuta(res);
        }
      }
    );

  } else {
    // 🚀 FASE 2: VIAJE REAL
    setFase("viaje");

    service.route(
      {
        origin: origen,
        destination: destino,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (res: any, status: any) => {
        if (status === "OK") {
          setRuta(res);

          const segundos = res.routes[0].legs[0].duration.value;
          setEta(segundos);
          setTiempo(Math.round(segundos / 60) + " min");
        }
      }
    );
  }
}

        lastRoute.current = now;
      }
    });
  }, []);

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

      {ruta && <DirectionsRenderer directions={ruta} />}

      {destino && (
        <Marker
          position={destino}
          icon={{
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
          }}
        />
      )}

      {pos && (
       <Marker
  position={pos}
  icon={{
    url: "https://maps.google.com/mapfiles/kml/shapes/cabs.png",
    scaledSize: new window.google.maps.Size(50, 50)
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
  {fase === "pickup"
    ? "🚗 Driver on the way"
    : fase === "viaje"
    ? "🚗 Route"
    : "⏳ Expecting"}
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