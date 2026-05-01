"use client";
export const dynamic = "force-dynamic";
export const runtime = "edge";


import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
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
const [viajeFinalizado, setViajeFinalizado] = useState(false);
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
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "/login";
    }
  });

  return () => unsub();
}, []);

 
// 🔥 TRACKING + RUTA
useEffect(() => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  const unsubscribe = onValue(viajeRef, (snap) => {
  const d = snap.val();
  const uid = auth.currentUser?.uid;

  if (!uid) return;

  // 🔒 PROTECCIÓN DRIVER (AQUÍ EXACTAMENTE)
  if (d?.driverId && d.driverId !== uid) {
    console.log("🚫 No eres el driver de este viaje");

    // 🔥 OPCIONAL: sacar al driver de la pantalla
    window.location.replace("/driver");

    return;
  }

  // 🔴 1. VALIDACIÓN BASE
  if (!d) {
    console.log("⛔ snapshot vacío");
    return;
  }

    // 🔴 2. FINALIZADO (PRIMERO SIEMPRE)
    if (d.estado === "Finalizado") {
  console.log("✅ VIAJE FINALIZADO (DRIVER)");

  const uid = auth.currentUser?.uid;
  if (uid) {
    update(ref(db, "drivers/" + uid), {
      viajeActivo: null
    });
  }

  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }

  setRuta(null);
  setPos(null);
  setViajeFinalizado(true);

  return;
}
// ❌ CANCELADO
if (d.estado === "Cancelado") {
  console.log("❌ VIAJE CANCELADO");

  const uid = auth.currentUser?.uid;
  if (uid) {
    update(ref(db, "drivers/" + uid), {
      viajeActivo: null
    });
  }

  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }

  setRuta(null);
  setPos(null);

  alert("Viaje cancelado");

  window.location.replace("/driver");

  return;
}
// 🟢 👇 AQUÍ EXACTAMENTE VA
if (d.estado === "En viaje") {
  setFase("viaje");
}
if (d.estado === "En camino") {
  setFase("pickup");
}

    // 🔴 3. VALIDAR DRIVER
    if (!d.driverLat || !d.driverLng || d.estado === "Cancelado") {
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
        lat: prev.lat + (nueva.lat - prev.lat) * 0.08,
        lng: prev.lng + (nueva.lng - prev.lng) * 0.08
      };
    });

    // 🚗 NAVEGACIÓN TIPO UBER
   const dx = nueva.lng - (lastMapRef.current?.lng || nueva.lng);
const dy = nueva.lat - (lastMapRef.current?.lat || nueva.lat);

// 🔥 ORDEN CORRECTO
const heading = Math.atan2(dy, dx) * (180 / Math.PI);

let headingDeg = heading * (180 / Math.PI);

// 🔥 evitar valores negativos
if (headingDeg < 0) headingDeg += 360;

    lastHeadingRef.current =
  lastHeadingRef.current + (headingDeg - lastHeadingRef.current) * 0.2;

    if (mapRef.current) {
      const dist = lastMapRef.current
        ? Math.hypot(
            nueva.lat - lastMapRef.current.lat,
            nueva.lng - lastMapRef.current.lng
          )
        : 1;

      if (dist > 0.00001) {
        mapRef.current.panTo(nueva);

        mapRef.current.setHeading(lastHeadingRef.current);
        mapRef.current.setTilt(60);
        mapRef.current.setZoom(17);
      }
    }

    lastMapRef.current = nueva;

 // 🔥 CONTROL DE RUTA
const nowRoute = Date.now();

if (!lastRouteRef.current || nowRoute - lastRouteRef.current > 5000) {

  if (!isLoaded || !window.google?.maps?.DirectionsService) return;

  if (!d.origenLat || !d.origenLng || !d.destinoLat || !d.destinoLng) {
    console.log("❌ Coordenadas incompletas");
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

  const service = new window.google.maps.DirectionsService();

  // 🚗 CONTROL MANUAL POR FASE
  if (d.estado === "En camino") {

    // 👉 ruta driver → origen
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

  } else if (d.estado === "En viaje") {

    // 👉 ruta origen → destino + VOZ
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

          // 🔊 NAVEGACIÓN POR VOZ (SOLO EN VIAJE)
          const steps = res.routes[0].legs[0].steps;

// 🔥 elegir el step más cercano al driver
let step = null;

for (let i = 0; i < steps.length; i++) {
  const s = steps[i];

  const dist = Math.hypot(
    nueva.lat - s.start_location.lat(),
    nueva.lng - s.start_location.lng()
  );

  if (dist < 0.001) {
    step = s;
    break;
  }
}

// fallback
if (!step) step = steps[0];

          if (step?.instructions && step?.distance) {
            const instruction = step.instructions
              .replace(/<[^>]+>/g, "")
              .trim();

            const distancia = step.distance.value;

            if (instruction && instruction !== lastInstructionRef.current) {
  lastInstructionRef.current = instruction;

  speak(`In ${Math.round(distancia)} meters, ${instruction}`);
}
          }
        }
      }
    );
  }

  lastRouteRef.current = nowRoute;


    }
  });

  return () => unsubscribe();

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
  const finalizar = async (id: string) => {
  try {
    const viajeRef = ref(db, "viajes/" + id);

    // 🔴 1. ACTUALIZAR ESTADO
    await update(viajeRef, {
      estado: "Finalizado",
      driverLat: null,
      driverLng: null,
      timestampFinalizado: Date.now()
    });

    // 🔴 2. DETENER GPS
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    // 🔴 3. LIMPIAR MAPA
    setRuta(null);
    setPos(null);

    // 🔴 4. FEEDBACK
    alert("Viaje finalizado");

    // 🔴 5. REDIRECCIÓN
    window.location.href = "/driver";

  } catch (err) {
    console.log("❌ Error finalizando:", err);
  }
};

  const cancelar = async () => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  try {
    const viajeRef = ref(db, "viajes/" + id);

    // 🔴 1. OBTENER DATOS PARA WHATSAPP
    let telefono = "";
    await new Promise((resolve) => {
      onValue(
        viajeRef,
        (snap) => {
          const d = snap.val();
          const uid = auth.currentUser?.uid;

if (!uid) return;
          telefono = d?.telefono || "";
          resolve(true);
        },
        { onlyOnce: true }
      );
    });

    // 🔴 2. ACTUALIZAR ESTADO EN FIREBASE
    await update(viajeRef, {
      estado: "Cancelado",
      mensaje: "❌ The driver has canceled the ride.",
      driverLat: null,
      driverLng: null
      
    });
    // 🔴 2.1 LIMPIAR VIAJE ACTIVO DEL DRIVER
const uid = auth.currentUser?.uid;
if (uid) {
  await update(ref(db, "drivers/" + uid), {
    viajeActivo: null
  });
}

    // 🔴 3. DETENER TRACKING GPS
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    // 🔴 4. LIMPIAR MAPA
    setRuta(null);
    setPos(null);

    // 🔴 5. AVISAR AL USUARIO (WHATSAPP)
    if (telefono) {
      const tel = "1" + telefono;
      window.open(
        `https://wa.me/${tel}?text=${encodeURIComponent(
          "❌ Your ride has been canceld. We apologize for the inconvenience caused"
        )}`,
        "_blank"
      );
    }

    // 🔴 6. ALERTA
    alert("Viaje cancelado correctamente");

    // 🔴 7. REDIRECCIÓN LIMPIA
    window.location.replace("/driver");

  } catch (error) {
    console.log("❌ Error cancelando:", error);
  }
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
  e.currentTarget.style.transform = "scale(0.95)";
  e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.2)";
};

const release = (e: any) => {
  e.currentTarget.style.transform = "scale(1)";
  e.currentTarget.style.boxShadow = "0 4px 0 rgba(0,0,0,0.2)";
};

  
const handleLoad = (map: any) => {
  mapRef.current = map;
};

if (!isLoaded) return <div>Loading map...</div>;
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
      <h1>✅ Trip completed</h1>

      <button
        onClick={() => {
          window.location.href = "/driver";
        }}
      >
        Volver
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
  gestureHandling: "greedy"
}}
>

        {ruta && (
  <DirectionsRenderer
  directions={ruta}
  options={{
    preserveViewport: true,
    suppressMarkers: true // 👈 CLAVE
  }}
/>
)}

  {pos && (
  <>
    {/* 🔵 CÍRCULO BASE */}
    <Marker
      position={pos}
      icon={{
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#000",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2
      }}
      zIndex={1}
    />

    {/* 🔺 FLECHA DIRECCIÓN */}
    <Marker
      position={pos}
      icon={{
        path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: "#fff",
        fillOpacity: 1,
        strokeWeight: 0,
        rotation: lastHeadingRef.current // 🔥 dirección real
      }}
      zIndex={2}
    />
  </>
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
            onClick={() => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (id) finalizar(id);
}}
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
          
          {fase === "pickup" && (
  <button
    style={btn("#ffc107")}
    onMouseDown={press}
    onMouseUp={release}
    onMouseLeave={release}
    onClick={async () => {
      const id = new URLSearchParams(window.location.search).get("id");
      if (!id) return;

      // 🔥 ACTIVAR AUDIO (CLAVE EN MÓVIL)
      window.speechSynthesis.resume();

      setFase("viaje");

      await update(ref(db, "viajes/" + id), {
        estado: "En viaje"
      });
    }}
  >
    📍 Recoger
  </button>
)}
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
      const uid = auth.currentUser?.uid;

if (!uid) return;
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
<button
  style={btn("#4285F4")}
  onMouseDown={press}
  onMouseUp={release}
  onMouseLeave={release}
  onClick={() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    const viajeRef = ref(db, "viajes/" + id);

    onValue(viajeRef, (snap) => {
      const d = snap.val();
      const uid = auth.currentUser?.uid;

if (!uid) return;
      if (!d) return;

      let url = "";

      if (fase === "pickup" && d.origenLat && d.origenLng) {
        const destino = `${d.origenLat},${d.origenLng}`;

        url = `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving&dir_action=navigate`;

      } else if (
        fase === "viaje" &&
        d.origenLat && d.origenLng &&
        d.destinoLat && d.destinoLng
      ) {
        const origen = `${d.origenLat},${d.origenLng}`;
        const destino = `${d.destinoLat},${d.destinoLng}`;

        url = `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&travelmode=driving&dir_action=navigate`;
      }

      if (url) {
        window.open(url, "_blank");
      }

    }, { onlyOnce: true });
  }}
>
  🧭 Google Maps
</button>

        </div>

      </div>
    </div>
  );
}