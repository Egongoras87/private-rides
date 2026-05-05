"use client";
export const dynamic = "force-dynamic";


import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";


export default function DriverTrackingPage() {
const [viajeData, setViajeData] = useState<any>(null);
  const watchRef = useRef<any>(null);
  const lastHeadingRef = useRef(0);
 const [loadingCancel, setLoadingCancel] = useState(false);
const lastMapRef = useRef<any>(null);   // 🗺️ cámara
  const [pos, setPos] = useState<any>(null);
  const [fase, setFase] = useState("pickup");
const [eta, setEta] = useState(0);
  const mapRef = useRef<any>(null);
  const calcularDistancia = (a: any, b: any) => {
  const R = 3958.8;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * c;
};
 

const lastRouteRef = useRef(0);
const [path, setPath] = useState<any[]>([]);
const [viajeFinalizado, setViajeFinalizado] = useState(false);
const lastInstructionRef = useRef("");
const [pulse, setPulse] = useState(0);
const [destinoMarker, setDestinoMarker] = useState<any>(null);
  const { isLoaded } = useJsApiLoader(googleMapsConfig);
  const speak = (text: string) => {
  if (!window.speechSynthesis) return;

  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "es-ES";
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

useEffect(() => {
  const interval = setInterval(() => {
    setPulse((p) => (p > 10 ? 0 : p + 0.5));
  }, 60);

  return () => clearInterval(interval);
}, []);
 
// 🔥 TRACKING + RUTA
useEffect(() => {
  if (typeof window === "undefined") return;
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  const unsubscribe = onValue(viajeRef, async (snap) => {
  const d = snap.val();
if (!d) return;

setViajeData(d);

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

  // 🔴 limpiar driver activo
  if (uid) {
    await update(ref(db, "drivers/" + uid), {
      viajeActivo: null
    });
  }

  // 🔴 DETENER GPS (CLAVE)
  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }

  // 🔴 LIMPIAR UI
  setPos(null);
  setPath([]);
  setViajeFinalizado(true);

  return; // 🔥 ESTO ES LO MÁS IMPORTANTE
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

  
  setPos(null);
setPath([]);
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
    lat: prev.lat + (nueva.lat - prev.lat) * 0.35,
    lng: prev.lng + (nueva.lng - prev.lng) * 0.35
  };
});

// ✅ AQUÍ FUERA
setPath((prev) =>
  prev.filter((p) => {
    const dist = Math.hypot(p.lat - nueva.lat, p.lng - nueva.lng);
    return dist > 0.0003;
  })
);
  

   // 🚗 NAVEGACIÓN TIPO UBER (PRO)

// 🔴 1. INICIALIZAR
if (!lastMapRef.current) {
  lastMapRef.current = nueva;
  return;
}

// 🔴 2. DIFERENCIA DE MOVIMIENTO
const dx = nueva.lng - lastMapRef.current.lng;
const dy = nueva.lat - lastMapRef.current.lat;

// 🔥 evitar ruido GPS
if (Math.abs(dx) < 0.00001 && Math.abs(dy) < 0.00001) {
  return;
}

// 🔴 3. CALCULAR HEADING REAL
let heading = Math.atan2(dy, dx) * (180 / Math.PI);
if (heading < 0) heading += 360;

// 🔴 4. SUAVIZADO (CLAVE PARA QUE NO SALTE)
let diff = heading - lastHeadingRef.current;
diff = ((diff + 540) % 360) - 180;

const smoothFactor = 0.2;

lastHeadingRef.current =
  lastHeadingRef.current + diff * smoothFactor;

// 🔴 5. FALLBACK
if (!isFinite(lastHeadingRef.current)) {
  lastHeadingRef.current = heading;
}

// 🔴 6. MOVER CÁMARA (ESTILO UBER REAL)
if (mapRef.current) {
  const map = mapRef.current;

  const speed = Math.hypot(dx, dy);

  const zoom = speed > 0.0005 ? 15 : 17;

  // 🔥 OFFSET (ADELANTA LA CÁMARA)
  const offsetDistance = 0.0003;

  const rad = (lastHeadingRef.current * Math.PI) / 180;

  const offsetLat = nueva.lat + Math.sin(rad) * offsetDistance;
  const offsetLng = nueva.lng + Math.cos(rad) * offsetDistance;

  map.moveCamera({
    center: {
      lat: offsetLat,
      lng: offsetLng
    },
    heading: lastHeadingRef.current,
    tilt: 65,
    zoom: zoom
  });
}

// 🔴 7. GUARDAR POSICIÓN
lastMapRef.current = nueva;

 // 🔥 CONTROL DE RUTA
const nowRoute = Date.now();

if (!lastRouteRef.current || nowRoute - lastRouteRef.current > 3000) {

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

  if (d.estado === "En camino") {

    service.route(
      {
        origin: nueva,
        destination: origen,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (res: any, status: any) => {
        if (status === "OK") {
          setEta(res.routes[0].legs[0].duration.value);

          const points = res.routes[0].overview_path.map((p: any) => ({
            lat: p.lat(),
            lng: p.lng()
          }));

          setPath(points);
        }
      }
    );

  } else if (d.estado === "En viaje") {

    service.route(
      {
        origin: nueva,
        destination: destino,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (res: any, status: any) => {
        if (status === "OK") {

          setEta(res.routes[0].legs[0].duration.value);

          const points = res.routes[0].overview_path.map((p: any) => ({
            lat: p.lat(),
            lng: p.lng()
          }));

          setPath(points);
          setDestinoMarker(points[points.length - 1]);

          // 🔊 VOZ
          const steps = res.routes[0].legs[0].steps;

          const step = steps.find((s: any) => {
            const dist = Math.hypot(
              nueva.lat - s.start_location.lat(),
              nueva.lng - s.start_location.lng()
            );
            return dist < 0.0002;
          });

          if (!step) return;

          const instruction = step.instructions
            .replace(/<[^>]+>/g, "")
            .trim();

          const distancia = step.distance.value;

          if (distancia < 30) return;

          if (instruction !== lastInstructionRef.current) {
            lastInstructionRef.current = instruction;
            const miles = distancia / 1609;

if (miles < 0.02) return; // evita ruido

const textoDistancia =
  miles < 0.1
    ? `${(miles * 5280).toFixed(0)} pies`
    : `${miles.toFixed(2)} millas`;

speak(`En ${textoDistancia}, ${instruction}`);
if (
  !instruction.toLowerCase().includes("left") &&
  !instruction.toLowerCase().includes("right")
) {
  return;
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
  if (typeof window === "undefined") return;

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
  }

  let lastSendTime = 0;

  watchRef.current = navigator.geolocation.watchPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // ⏱ throttle
      if (Date.now() - lastSendTime < 1000) return;
      lastSendTime = Date.now();

      try {
        const user = auth.currentUser;
        if (!user) return;

        const uid = user.uid;
        const token = await user.getIdToken();

        // 🔐 1. ACTUALIZAR VIAJE (backend seguro)
        await fetch("/api/update-driver-location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({
            viajeId: id,
            lat,
            lng
          })
        });

        // 🟢 2. ACTUALIZAR DRIVER (frontend permitido)
        await update(ref(db, "drivers/" + uid), {
          lat,
          lng,
          lastSeen: Date.now()
        });

      } catch (err) {
        console.error("ERROR GPS:", err);
      }
    },
    (err) => console.log("GPS ERROR:", err),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 3000
    }
  );

  return () => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
  };
}, []);

  //////////////////////// 🔴 FUNCIONES DRIVER////////////////////////////////////////////////////////////////////////////////
  const finalizar = async (id: string) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert("No autenticado");
      return;
    }

    const viajeRef = ref(db, "viajes/" + id);

    // 🔥 OBTENER DATA ACTUAL (UNA SOLA VEZ)
    const snap = await new Promise<any>((resolve) => {
      onValue(viajeRef, (s) => resolve(s.val()), { onlyOnce: true });
    });

    if (!snap) {
      alert("Viaje no encontrado");
      return;
    }

    // 🔒 VALIDAR ESTADO (CRÍTICO)
    if (snap.estado !== "En viaje") {
      alert("No puedes finalizar aún. Debes haber recogido al cliente.");
      return;
    }

    // 📍 VALIDAR DISTANCIA (DESTINO)
    const driverLat = Number(snap?.driverLat);
    const driverLng = Number(snap?.driverLng);
    const destinoLat = Number(snap?.destinoLat);
    const destinoLng = Number(snap?.destinoLng);

    if (
      isFinite(driverLat) &&
      isFinite(driverLng) &&
      isFinite(destinoLat) &&
      isFinite(destinoLng)
    ) {
      const dist = calcularDistancia(
        { lat: driverLat, lng: driverLng },
        { lat: destinoLat, lng: destinoLng }
      );

      // ⚠ NO HA LLEGADO → advertencia
      if (dist > 0.1) {
        const confirmar = confirm(
          "⚠️ Aún no has llegado al destino.\n\n¿Seguro quieres finalizar el viaje?"
        );

        if (!confirmar) return;
      }
    }

    const token = await user.getIdToken();

    // 🔐 FINALIZAR EN BACKEND
    const res = await fetch("/api/finalizar-viaje", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ viajeId: id })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error finalizando");
      return;
    }

    // 🧹 LIMPIAR TRACKING
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    setPos(null);
    setPath([]);

    alert("Viaje finalizado");

    window.location.href = "/driver";

  } catch (err) {
    console.error("❌ Error finalizando:", err);
    alert("Error inesperado");
  }
};
/////////////////////////////////////////  CANCELAR  /////////////////////////////////////////////
 const cancelar = async () => {
  try {
    // 🔒 evitar doble click
    if (loadingCancel) return;
    setLoadingCancel(true);

    // 🔥 obtener ID
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
      alert("No se encontró el viaje");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("Debes iniciar sesión");
      window.location.replace("/login-driver"); // 🔁 driver login
      return;
    }

    const token = await user.getIdToken();

    // 🔥 timeout (mobile safe)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // 🔐 ENDPOINT CORRECTO (DRIVER)
    const res = await fetch("/api/cancelar-viaje-driver", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ viajeId: id }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    // 🔍 debug seguro
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      console.warn("Respuesta no JSON");
    }

    if (!res.ok) {
      alert(data?.error || "Error cancelando el viaje");
      return;
    }

    // 📲 MENSAJE UX
    if (data?.refundId) {
      alert("❌ Viaje cancelado\n💳 El dinero será devuelto.");
    } else {
      alert("❌ Viaje cancelado");
    }

    // 🧹 LIMPIEZA TOTAL TRACKING (CLAVE)
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    setPos(null);
    setPath([]);

    // 🔄 limpiar storage
    localStorage.removeItem("viajeId");
    localStorage.removeItem("viajeData");

    // 🔁 REDIRECCIÓN CORRECTA (SIEMPRE DRIVER)
    window.location.replace("/driver");

  } catch (error: any) {
    console.error("ERROR FRONTEND:", error);

    if (error.name === "AbortError") {
      alert("Tiempo de espera agotado. Intenta de nuevo.");
    } else {
      alert("Error de conexión");
    }

  } finally {
    setLoadingCancel(false);
  }
};

  // 🎯 BOTONES 3D (IGUAL QUE TU TRACKING)
  const btn = (bg: string) => ({
    padding: 9,
    borderRadius: 9,
    fontSize: 10, 
    fontWeight: "bold",
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
  center={undefined}
  zoom={17}
  options={{
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: "greedy",
    mapId: "c7f305f9e66d61eb57ab057d"
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

      {/* PANEL DRIVER */}
      <div style={{
        position: "absolute",
        bottom: 0,
        width: "100%",
        background: "#fff",
        padding: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16
      }}>

{viajeData?.metodoPago === "cash" && !viajeData?.pagado && (
  <div style={{
    background: "#ff0000",
    color: "#fff",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "bold"
  }}>
    💵 CASH - CLIENT MUST PAY DRIVER
  </div>
)}

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

    try {
      const user = auth.currentUser;
      if (!user) {
        alert("No autenticado");
        return;
      }

      const token = await user.getIdToken();

      // 🔥 ACTIVAR AUDIO (CLAVE EN MÓVIL)
      window.speechSynthesis.resume();

      // 🔥 UI inmediata (no se rompe tu UX)
      setFase("viaje");

      // 🔐 CAMBIO DE ESTADO SEGURO (backend)
      const res = await fetch("/api/en-viaje", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ viajeId: id })
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("❌ Error:", data.error);
        alert(data.error || "Error cambiando estado");
        return;
      }

      console.log("✅ Estado cambiado a EN VIAJE");

    } catch (err) {
      console.error("ERROR:", err);
      alert("Error inesperado");
    }
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

    onValue(
      viajeRef,
      (snap) => {
        const d = snap.val();

        if (!d?.telefono) return;

        // 🔥 CORRECTO
        const telefono = "1" + String(d.telefono).replace(/\D/g, "");

        window.open(
          `https://wa.me/${telefono}?text=${encodeURIComponent("🚗 Estoy en camino")}`,
          "_blank"
        );
      },
      { onlyOnce: true }
    );
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

    onValue(
      viajeRef,
      (snap) => {
        const d = snap.val();
        const uid = auth.currentUser?.uid;

        if (!uid) return;
        if (!d) return;

        let url = "";

        if (fase === "pickup" && d.origenLat && d.origenLng) {
          const destino = `${d.origenLat},${d.origenLng}`;
          url = `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`;
        } else if (
          fase === "viaje" &&
          d.origenLat &&
          d.destinoLat
        ) {
          const origen = `${d.origenLat},${d.origenLng}`;
          const destino = `${d.destinoLat},${d.destinoLng}`;

          url = `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&travelmode=driving`;
        }

        if (url) {
          window.open(url, "_blank");
        }
      },
      { onlyOnce: true }
    );
  }}
>
  🧭 Google Maps
</button>

        </div>

      </div>
    </div>
  );
}