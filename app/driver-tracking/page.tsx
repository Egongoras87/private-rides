"use client";
export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";


export default function DriverTrackingPage() {

  const watchRef = useRef<any>(null);
  const lastHeadingRef = useRef(0);
  const lastGpsRef = useRef<any>(null);   // 📡 GPS
const lastMapRef = useRef<any>(null);   // 🗺️ cámara
  const [pos, setPos] = useState<any>(null);
  const [ruta, setRuta] = useState<any>(null);
  const [fase, setFase] = useState("pickup");
const [eta, setEta] = useState(0);
  const mapRef = useRef<any>(null);
  const animRef = useRef<any>(null);
const lastPanRef = useRef(0);
const lastRouteRef = useRef(0);
const lastInstructionRef = useRef("");
  const { isLoaded } = useJsApiLoader(googleMapsConfig);
  const speak = (text: string) => {
  if (!window.speechSynthesis) return;

  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-US";
  msg.rate = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(msg);
};
 
// 🔥 TRACKING + RUTA
useEffect(() => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  return onValue(viajeRef, (snap) => {
    const d = snap.val();
    if (!d || !d.driverLat) return;

    const nueva = {
      lat: Number(d.driverLat),
      lng: Number(d.driverLng)
    };

    // 🚀 ANIMACIÓN SUAVE
   setPos((prev: any) => {
  if (!prev) return nueva;

  return {
    lat: prev.lat + (nueva.lat - prev.lat) * 0.08,
    lng: prev.lng + (nueva.lng - prev.lng) * 0.08
  };
});

  // 🚗 NAVEGACIÓN TIPO UBER (FOLLOW + ROTACIÓN + CÁMARA)

const dx = nueva.lng - (lastMapRef.current?.lng || nueva.lng);
const dy = nueva.lat - (lastMapRef.current?.lat || nueva.lat);

// 🔥 calcular dirección (heading)
const heading = Math.atan2(dx, dy) * (180 / Math.PI);

// 🔥 suavizar rotación
lastHeadingRef.current =
  lastHeadingRef.current * 0.7 + heading * 0.3;

if (mapRef.current) {
  const dist = lastMapRef.current
    ? Math.hypot(
        nueva.lat - lastMapRef.current.lat,
        nueva.lng - lastMapRef.current.lng
      )
    : 1;

  if (dist > 0.00001) {
    // 🔥 cámara adelantada (como Uber)
    mapRef.current.panTo({
      lat: nueva.lat + 0.00005,
      lng: nueva.lng
    });

    // 🔥 rotación del mapa
    mapRef.current.setHeading(lastHeadingRef.current);

    // 🔥 inclinación tipo navegación
    mapRef.current.setTilt(60);

    // 🔥 zoom ideal conducción
    mapRef.current.setZoom(17);
  }
}

lastMapRef.current = nueva;
   // 🔥 CONTROL DE FRECUENCIA DE RUTA
const nowRoute = Date.now();

if (!lastRouteRef.current || nowRoute - lastRouteRef.current > 5000) {

  if (isLoaded && window.google?.maps?.DirectionsService) {
    const service = new window.google.maps.DirectionsService();

    // 🔥 VALIDACIÓN
    if (!d.origenLat || !d.origenLng || !d.destinoLat || !d.destinoLng) {
      console.log("❌ Coordenadas incompletas", d);
      return;
    }

    const origen = {
      lat: Number(d.origenLat),
      lng: Number(d.origenLng)
    };

    const destino = {
      lat: Number(d.destinoLat),
      lng: Number(d.destinoLng)
    };

    const distPickup = Math.hypot(
      nueva.lat - origen.lat,
      nueva.lng - origen.lng
    );

    console.log("FASE:", distPickup > 0.002 ? "pickup" : "viaje");

    // 🚗 PICKUP
    if (distPickup > 0.002) {
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

            const segundos = res.routes[0].legs[0].duration.value;
            setEta(segundos);
          }
        }
      );

    } else {
      // 🚀 VIAJE
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

            const step = res.routes[0].legs[0].steps[0];

            if (step && step.distance && step.instructions) {
  const instruction = step.instructions.replace(/<[^>]+>/g, "").trim();
  const distancia = step.distance.value;

  if (!instruction) return;

  if (
    instruction !== lastInstructionRef.current &&
    distancia < 300
  ) {
    lastInstructionRef.current = instruction;

    const texto = `In ${Math.round(distancia)} meters, ${instruction}`;
    console.log("VOICE:", texto);

    speak(texto);
  }
}
          }
        }
      );
    }
  }

  // 🔥 ACTUALIZA CONTROL (AQUÍ VA, FUERA DE route)
  lastRouteRef.current = nowRoute;
}
  });

}, [isLoaded]);
 // 📡 GPS DRIVER → FIREBASE
useEffect(() => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
  }

  let lastSendTime = 0;

  watchRef.current = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (lastGpsRef.current) {
        const dist = Math.hypot(
          lat - lastGpsRef.current.lat,
          lng - lastGpsRef.current.lng
        );

        if (dist < 0.00002 && Date.now() - lastSendTime < 2000) return;
      }

      lastSendTime = Date.now();
      lastGpsRef.current = { lat, lng };

      update(ref(db, "viajes/" + id), {
        driverLat: lat,
        driverLng: lng,
        timestamp: Date.now()
      });
    },
    (err) => console.log("GPS ERROR:", err),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  );

  return () => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
  };
}, []);

  // 🔴 FUNCIONES DRIVER
  const finalizar = async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    await update(ref(db, "viajes/" + id), {
      estado: "Finalizado"
    });
  };

  const cancelar = async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    await update(ref(db, "viajes/" + id), {
      estado: "Cancelado"
    });
  };

  // 🎯 BOTONES 3D (IGUAL QUE TU TRACKING)
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

  
const handleLoad = (map: any) => {
  mapRef.current = map;
};

if (!isLoaded) return <div>Loading map...</div>;
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
  gestureHandling: "greedy"
}}
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

        {pos && (
          <Marker
            position={pos}
            icon={{
              url: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
              scaledSize: isLoaded && window.google
  ? new window.google.maps.Size(35, 35)
  : undefined
            }}
          />
        )}

      </GoogleMap>

      {/* PANEL DRIVER */}
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
            ? "🚗 En camino al cliente"
            : "🚗 En viaje"}
        </h3>

        <p>
  {eta > 0 ? Math.ceil(eta / 60) + " min" : "Calculando..."}
</p>

        <div style={{ display: "flex", gap: 10 }}>

          <button
            style={btn("#007bff")}
            onMouseDown={press}
            onMouseUp={release}
            onMouseLeave={release}
            onClick={finalizar}
          >
            ✅ Finalizar
          </button>

          <button
            style={btn("#dc3545")}
            onMouseDown={press}
            onMouseUp={release}
            onMouseLeave={release}
            onClick={cancelar}
          >
            ❌ Cancelar
          </button>
          <button
  style={btn("#25D366")}
  onMouseDown={press}
  onMouseUp={release}
  onMouseLeave={release}
  onClick={() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    const viajeRef = ref(db, "viajes/" + id);

    onValue(viajeRef, (snap) => {
      const d = snap.val();
      if (!d?.telefono) return;

      const telefono = "1" + d.telefono;

      window.open(
        `https://wa.me/${telefono}?text=🚗 Estoy en camino`,
        "_blank"
      );
    }, { onlyOnce: true });
  }}
>
  💬 WhatsApp
</button>

        </div>

      </div>
    </div>
  );
}