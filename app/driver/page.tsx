"use client";
export const dynamic = "force-dynamic";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  ref,
  onValue,
  update,
  get,
  runTransaction,
  set
} from "firebase/database";
import {
  useJsApiLoader,
  GoogleMap,
  Marker
} from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";

// 🔥 ETA
const calcularETA = (o: any, d: any) =>
  new Promise<number>((resolve) => {
    if (!window?.google?.maps?.DirectionsService) {
      resolve(0);
      return;
    }

    const service = new window.google.maps.DirectionsService();

    service.route(
      {
        origin: o,
        destination: d,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (res: any, status: any) => {
        if (status === "OK" && res?.routes?.[0]?.legs?.[0]) {
          const dur = res.routes[0].legs[0].duration.value;
          resolve(dur / 60);
        } else {
          resolve(0);
        }
      }
    );
  });

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
 
export default function DriverPage() {
  const restoringRef = useRef(false);
  const [viajes, setViajes] = useState<any[]>([]);
  const [etas, setEtas] = useState<any>({});
  const [distanciasPickup, setDistanciasPickup] =
  useState<any>({});
  const mapRef = useRef<any>(null);
  const { isLoaded } = useJsApiLoader(googleMapsConfig);
const mapInitializedRef =
  useRef(false);
const ultimoViajeNotificadoRef = useRef<string | null>(null);
const viajesPreviosRef =
  useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Para poder detener el sonido después
 const vibrationRef = useRef<any>(null);
const notificationPermissionRef =
  useRef(false);
const [sonidoActivo, setSonidoActivo] = useState(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("sonido") !== "false";
  }
  return true;
});
 const [activo, setActivo] = useState(true);
 const [driverLocation, setDriverLocation] =
  useState<any>(null);
 const router = useRouter();
 const [driverUser, setDriverUser] =
  useState<any>(null);
const [loadingAuth,
  setLoadingAuth] =
    useState(true);

const darkMapStyle = [

  {
    elementType: "geometry",
    stylers: [
      { color: "#0b1220" }
    ]
  },

  {
    elementType: "labels.text.fill",
    stylers: [
      { color: "#8fa3b8" }
    ]
  },

  {
    elementType: "labels.text.stroke",
    stylers: [
      { color: "#0b1220" }
    ]
  },

  // 🌆 ciudades
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [
      { color: "#d6dee8" }
    ]
  },

  // 🛣️ roads principales
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [
      { color: "#30475e" }
    ]
  },

  // 🛣️ roads normales
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [
      { color: "#1f2c3d" }
    ]
  },

  // 🛣️ labels roads
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [
      { color: "#7c8ea3" }
    ]
  },

  // 🌊 agua
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [
      { color: "#0a1622" }
    ]
  },

  // 🌳 parques
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [
      { color: "#101826" }
    ]
  },

  // ❌ ocultar POI
  {
    featureType: "poi",
    stylers: [
      { visibility: "off" }
    ]
  },

  // ❌ ocultar transit
  {
    featureType: "transit",
    stylers: [
      { visibility: "off" }
    ]
  }
];
// =========================================================
// 🔥 AUTH PERSISTENTE
// =========================================================
useEffect(() => {

  const unsub =

    onAuthStateChanged(

      auth,

      async (user) => {

        // ✅ usuario autenticado
        if (user) {

          setDriverUser(user);

        } else {

          setDriverUser(null);
        }

        // ✅ auth ya terminó
        setLoadingAuth(false);
        
      }
    );

  return () => unsub();

}, []);

// TRACKING DE UBICACIÓN EN TIEMPO REAL
useEffect(() => {

  let watchId: number | null = null;

  if (!driverUser || !activo) return;

  if (!navigator.geolocation) return;

 watchId =
  navigator.geolocation.watchPosition(

    (pos) => {

      setDriverLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });

      update(
        ref(db, "drivers/" + driverUser.uid),
        {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          lastSeen: Date.now(),
          online: true
        }
      );
    },

    (err) => {
      console.error(err);
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    }
  );
       

  return () => {

    if (watchId !== null) {

      navigator.geolocation.clearWatch(
        watchId
      );
    }
  };

}, [driverUser, activo]);

useEffect(() => {

  if (!driverUser) return;

  // evitar doble ejecución
  if (restoringRef.current) return;

  restoringRef.current = true;

  const restoreRide = async () => {

    try {

      // 🔥 buscar driver
      const driverSnap = await get(
        ref(db, "drivers/" + driverUser.uid)
      );

      const driverData = driverSnap.val();

      // 🔥 no hay viaje activo
      if (!driverData?.viajeActivo) {

        restoringRef.current = false;

        return;
      }

      const viajeId =
        driverData.viajeActivo;

      // 🔥 buscar viaje
      const viajeSnap = await get(
        ref(db, "viajes/" + viajeId)
      );

      // 🔥 viaje no existe
      if (!viajeSnap.exists()) {

        await update(
          ref(db, "drivers/" + driverUser.uid),
          {
            viajeActivo: null
          }
        );

        restoringRef.current = false;

        return;
      }

      const viaje = viajeSnap.val();

      // 🔥 estados que deben restaurar tracking
      const estadosTracking = [
        "En camino",
        "En viaje"

      ];

      // 🔥 restaurar tracking
      if (
        estadosTracking.includes(
          viaje.estado
        )
      ) {

   router.replace(
  `/driver-tracking?id=${viajeId}`
);
restoringRef.current = false;

return;
      }

      // 🔥 limpiar basura
      await update(
        ref(db, "drivers/" + driverUser.uid),
        {
          viajeActivo: null
        }
      );

    } catch (err) {

      console.error(
        "RESTORE ERROR",
        err
      );
    }

    restoringRef.current = false;
  };

  restoreRide();

}, [driverUser]);

// 🔥 precargar audio
useEffect(() => {

  const audio =
    new Audio(
      "/notification.mp3"
    );

  audio.load();

}, []);

// 🔥 FIREBASE RECONNECT
useEffect(() => {

  const connectedRef =
    ref(db, ".info/connected");

  const unsub =
    onValue(connectedRef, (snap) => {

      if (snap.val() === true) {

        console.log(
          "🔥 Firebase reconectado"
        );
      }
    });

  return () => unsub();

}, []);
// 📱 APP FOREGROUND
useEffect(() => {

  const handleVisibility = () => {

    if (
      document.visibilityState ===
      "visible"
    ) {

      console.log(
        "📱 App volvió al foreground"
      );
    }
  };

  document.addEventListener(
    "visibilitychange",
    handleVisibility
  );

  return () => {

    document.removeEventListener(
      "visibilitychange",
      handleVisibility
    );
  };

}, []);


useEffect(() => {
  localStorage.setItem("sonido", sonidoActivo.toString());
}, [sonidoActivo]);

// =========================================================
// 🔔 PERMISO NOTIFICACIONES
// =========================================================
useEffect(() => {

  if (
    typeof window === "undefined"
  ) return;

  if (
    !("Notification" in window)
  ) return;

  if (
    Notification.permission ===
    "granted"
  ) {

    notificationPermissionRef.current =
      true;

    return;
  }

  Notification.requestPermission()
    .then((permission) => {

      if (
        permission === "granted"
      ) {

        notificationPermissionRef.current =
          true;
      }
    });

}, []);

useEffect(() => {

  if (!driverUser) return;

  const driverRef =
    ref(db, "drivers/" + driverUser.uid);

  // 🟢 ONLINE
  update(driverRef, {
    uid: driverUser.uid,
    lastSeen: Date.now(),
    online: true
  });

}, [driverUser]);

// //📡 VIAJES
// //📡 VIAJES
useEffect(() => {
  const viajesRef = ref(db, "viajes");

  const unsub = onValue(viajesRef, (snap) => {
    const data = snap.val();
    if (!data) {
      setViajes([]);
      return;
    }

    // 🔥 1. OBTENER UID AL PRINCIPIO (Evita el error de initialization)
    const uid = auth.currentUser?.uid; 
    const ahora = Date.now();

    // 🔥 2. CONVERTIR DATA
    const lista = Object.entries(data).map(([id, v]: any) => ({
      id,
      ...v
    }));

    // 🔥 3. NOTIFICAR DRIVERS (Ahora 'uid' ya existe)
    lista.forEach((v: any) => {
      if (!uid) return;
      if (v.estado === "Pendiente") {
        set(ref(db, "viajes/" + v.id + "/driversNotificados/" + uid), true);
      }
    });

    // =========================================================
// 🔥 5. FILTRO DE VIAJES
// =========================================================
const filtrados = lista.filter((v: any) => {

  // ❌ ocultar rechazados
  if (
    uid &&
    v.rechazos &&
    v.rechazos[uid]
  ) {
    return false;
  }

  // ✅ mostrar:
  // Pendientes
  // o asignados al driver
  if (

    v.estado !== "Pendiente" &&

    !(

      v.estado === "Asignado" &&
      v.driverId === uid

    )
  ) {

    return false;
  }

  // ⏰ lógica viajes inmediatos
  const esInmediato =

    Math.abs(
      (v.fecha || 0) - ahora
    ) < 30 * 60 * 1000;

  if (esInmediato) {

    // 🔥 aún no calculó ETA
    if (!etas[v.id]) return true;

    // 🔥 solo viajes cerca
    return etas[v.id] < 20;
  }

  return true;
});

// =========================================================
// 🔥 6. ORDEN INTELIGENTE
// =========================================================
filtrados.sort((a: any, b: any) => {

  const ahora = Date.now();

  const tiempoA =
    Math.abs(
      (a.fecha || 0) - ahora
    );

  const tiempoB =
    Math.abs(
      (b.fecha || 0) - ahora
    );

  const etaA =
    etas[a.id] || 999;

  const etaB =
    etas[b.id] || 999;

  const distA =
    distanciasPickup[a.id] || 999;

  const distB =
    distanciasPickup[b.id] || 999;

  // 🔥 score inteligente
  const scoreA =

    tiempoA * 0.001 +

    etaA * 60 +

    distA * 10;

  const scoreB =

    tiempoB * 0.001 +

    etaB * 60 +

    distB * 10;

  return scoreA - scoreB;
});

// =========================================================
// 🔥 7. ACTUALIZAR ESTADO
// =========================================================
setViajes(filtrados);
  });

  return () => unsub();
  
}, []); 

//centrar mapa en driver y primer viaje
useEffect(() => {

  if (

    !mapRef.current ||

    !driverLocation ||

    viajes.length === 0

  ) return;

  // 🔥 evitar brincar infinito
  if (
    mapInitializedRef.current
  ) return;

  const bounds =

    new window.google.maps
      .LatLngBounds();

  // 🚗 DRIVER
  bounds.extend(
    driverLocation
  );

  // 📍 TODOS LOS VIAJES
  viajes.forEach((v) => {

    if (
      v.origenLat &&
      v.origenLng
    ) {

      bounds.extend({

        lat: Number(
          v.origenLat
        ),

        lng: Number(
          v.origenLng
        )
      });
    }
  });

  mapRef.current.fitBounds(
    bounds
  );

  // 🔥 esperar fitBounds
  setTimeout(() => {

    const zoom =
      mapRef.current?.getZoom();

    if (zoom > 14) {

      mapRef.current.setZoom(14);
    }

    if (zoom < 11) {

      mapRef.current.setZoom(11);
    }

  }, 300);

  // 🔥 SOLO 1 VEZ
  mapInitializedRef.current =
    true;

}, [viajes]);
//
 useEffect(() => {

  if (!isLoaded) return;

  if (!navigator.geolocation) return;

  if (viajes.length === 0) return;

  if (!driverLocation) return;

const driverPos = driverLocation;

(async () => {

    const nuevos: any = {};

    const nuevasDistancias: any = {};

    await Promise.all(

      viajes.map(async (v) => {

        if (!v.origenLat || !v.origenLng)
          return;

        const origen = {
          lat: Number(v.origenLat),
          lng: Number(v.origenLng)
        };

        // 🔥 ETA
        const eta =
          await calcularETA(
            driverPos,
            origen
          );

        nuevos[v.id] = eta;

        // 🔥 DISTANCIA
        const dist =
          calcularDistancia(
            driverPos,
            origen
          );

        nuevasDistancias[v.id] =
          dist;
      })
    );

    // 🔥 guardar ETAS
    setEtas(nuevos);

    // 🔥 guardar DISTANCIAS
    setDistanciasPickup(
      nuevasDistancias
    );

  })();

  
}, [isLoaded, driverLocation, viajes]);

// =========================================================
// 🔔 SISTEMA PROFESIONAL NUEVO VIAJE
// =========================================================
useEffect(() => {

  if (!sonidoActivo)
    return;

  // 🔥 viajes pendientes
  const pendientes = viajes.filter(
    (v) =>
      v.estado === "Pendiente"
  );

  // 🔥 ids actuales
  const idsActuales =
    pendientes.map(
      (v) => v.id
    );

  // =====================================================
  // 🔥 PRIMERA CARGA
  // =====================================================
  if (
    viajesPreviosRef.current.length === 0
  ) {

    viajesPreviosRef.current =
      idsActuales;

    // 🔥 si ya había viajes
    if (
      idsActuales.length > 0
    ) {

      reproducirAlertaViaje();
    }

    return;
  }

  // =====================================================
  // 🔥 DETECTAR NUEVO
  // =====================================================
  const nuevoViaje =
    idsActuales.find(
      (id) =>
        !viajesPreviosRef.current.includes(id)
    );

  // 🔥 actualizar memoria
  viajesPreviosRef.current =
    idsActuales;

  // ❌ nada nuevo
  if (!nuevoViaje)
    return;

  // 🔥 ALERTA TOTAL
  reproducirAlertaViaje();

}, [viajes, sonidoActivo]);

  // 🚗 ACEPTAR RIDE//
const aceptarViaje = async (v: any) => {
  
  const user = auth.currentUser;
  // 🔊 DETENER AUDIO INMEDIATAMENTE
  if (audioRef.current) {
  audioRef.current.pause();
  audioRef.current.currentTime = 0;
  audioRef.current = null;
}

if (navigator.vibrate) {
  navigator.vibrate(0);
}
  if (!user) {
    alert("Error de usuario");
    return;
  }

  try {
    const token = await user.getIdToken();

    // 🔐 TODO SE VALIDA EN BACKEND
    const res = await fetch("/api/aceptar-viaje", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ viajeId: v.id })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "❌ Otro driver tomó este viaje");
      return;
    }
    // 🔥 SNAPSHOT DRIVER
const driverSnap =
  await get(
    ref(
      db,
      "drivers/" + user.uid
    )
  );

const driverData =
  driverSnap.val();

// 🔥 GUARDAR INFO DRIVER EN VIAJE
await update(
  ref(db, "viajes/" + v.id),

  {

    driverNombre:
      driverData?.nombre || "",

    driverTelefono:
      driverData?.telefono || "",

    driverCarro:
      driverData?.carro || {}
  }
);

   
    alert("✅ Viaje aceptado");

    
  } catch (error) {
    console.error("ERROR ACEPTANDO:", error);
    alert("Error aceptando viaje");
  }
};
// INICIAR VIAJE //
const iniciarViaje = async (v: any) => {
  if (!v?.id) return;

  try {
    const user = auth.currentUser;
    if (!user) {
      alert("No autenticado");
      return;
    }

    const uid = user.uid;

    // 🔒 validar dueño
    if (v.driverId !== uid) {
      alert("Este viaje no es tuyo");
      return;
    }

    // 🔒 validar que esté aceptado
    if (v.estado !== "Asignado") {
      alert("Primero debes aceptar el viaje");
      return;
    }

    const ahora = Date.now();

    // 🔥 BLOQUEO VIAJES PROGRAMADOS
    if (v.fecha && v.fecha > ahora + 2 * 60 * 1000) {
      alert("⏳ Aún no es hora de iniciar este viaje");
      return;
    }

    const token = await user.getIdToken();

    // 🔐 CAMBIO DE ESTADO SEGURO (backend)
    const res = await fetch("/api/iniciar-viaje", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ viajeId: v.id })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Error:", data.error);
      alert(data.error || "No se pudo iniciar el viaje");
      return;
    }
    // 🔥 activar tracking REAL
await update(
  ref(db, "drivers/" + uid),
  {
    viajeActivo: v.id
  }
);

    console.log("🚗 Viaje en camino");

    // 🔁 REDIRECCIÓN (mantienes tu flujo)
    router.push(
  `/driver-tracking?id=${v.id}`
);

  } catch (err) {
    console.error("ERROR iniciarViaje:", err);
    alert("Error inesperado");
  }
};
// //FINALIZAR//
const finalizar = async (v: any) => {
  if (!v?.id) return;

  try {
    const user = auth.currentUser;
    if (!user) {
      alert("No autenticado");
      return;
    }

    const uid = user.uid;

    // 📍 VALIDAR DISTANCIA
    if (v.driverLat && v.driverLng && v.destinoLat && v.destinoLng) {
      const dist = calcularDistancia(
        { lat: Number(v.driverLat), lng: Number(v.driverLng) },
        { lat: Number(v.destinoLat), lng: Number(v.destinoLng) }
      );

      if (dist > 0.1) {
        const confirmar = confirm(
          "⚠️ Aún no has llegado al destino.\n\n¿Seguro quieres finalizar el viaje?"
        );
        if (!confirmar) return;
      }
    }

    // 💵 VALIDACIÓN CASH
    if (v.metodoPago === "cash" && !v.pagado) {
      const confirmCash = confirm("¿Cliente pagó en efectivo?");
      if (!confirmCash) return;
    }

    // 🔐 TOKEN PARA BACKEND
    const token = await user.getIdToken();

    // 🔥 FINALIZAR EN BACKEND (SEGURO)
    const res = await fetch("/api/finalizar-viaje", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        viajeId: v.id
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Error:", data.error);
      alert(data.error || "Error finalizando viaje");
      return;
    }

    // 🔴 LIMPIAR DRIVER (esto sí puede ir en frontend)
    await update(ref(db, "drivers/" + uid), {
      viajeActivo: null
    });

    console.log("✅ Viaje finalizado correctamente");

  } catch (err) {
    console.error("ERROR FINALIZANDO:", err);
    alert("Error inesperado");
  }
};

// //❌ RECHAZAR VIAJE (OPTIMIZADO) //
const rechazar = async (v: any) => {
  if (!v?.id) return;

  // 1. Confirmación rápida
  const confirmar = confirm("¿Seguro que quieres ignorar este viaje?");
  if (!confirmar) return;

  // 🔊 DETENER AUDIO INMEDIATAMENTE
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
  }
  if (navigator.vibrate) {
  navigator.vibrate(0);
}

  try {
    const user = auth.currentUser;
    if (!user) {
      alert("Sesión expirada. Por favor, inicia sesión nuevamente.");
      return;
    }

    const token = await user.getIdToken();

    // 🚀 API rechazo
    const res = await fetch("/api/rechazar-viaje-driver", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ viajeId: v.id })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.error || "No se pudo procesar el rechazo.");
      return;
    }

    // 🔥 SOLO LOG (sin WhatsApp)
    if (data.message === "Viaje cancelado por falta de drivers") {
      console.log("📢 Viaje cancelado globalmente.");
    }

    console.log("❌ Viaje ocultado para este driver.");

  } catch (error) {
    console.error("🔥 ERROR CRÍTICO EN RECHAZAR:", error);
    alert("Hubo un problema de conexión. Intenta de nuevo.");
  }
};
// ❌ CANCELAR VIAJE (YA TOMADO)//



const cancelar = async (v: any) => {
  try {
    if (!v?.id) {
      alert("No hay viajeId");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("No autenticado");
      return;
    }

    // 🔒 VALIDACIÓN FRONT (UX)
    if (v.estado === "Cancelado" || v.estado === "Finalizado") {
      alert("Este viaje ya no se puede cancelar");
      return;
    }

    const confirmar = confirm("¿Seguro deseas cancelar este viaje?");
    if (!confirmar) return;

    const token = await user.getIdToken();

    const res = await fetch("/api/cancelar-viaje-driver", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ viajeId: v.id })
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      console.error("❌ Respuesta no es JSON");
    }

    if (!res.ok) {
      console.error("❌ Error:", data?.error);
      alert(data?.error || "Error cancelando viaje");
      return;
    }

    // 🔔 Feedback
    alert("Viaje cancelado correctamente");

    // 🔁 REDIRECCIÓN SEGURA (no vuelve a tracking ni a home)
    router.replace("/driver");

  } catch (error) {
    console.error("ERROR FRONTEND:", error);
    alert("Error general");
  }
};
const estiloBoton = (color: string) => ({
  padding: "6px 12px",
  borderRadius: "12px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "12px",
  color: "#fff",
  background: color,
  boxShadow: "0 5px 0 rgba(0,0,0,0.2)",
  transition: "all 0.1s ease-in-out",
});

const presionar = (e: any) => {
  e.currentTarget.style.transform = "translateY(3px)";
  e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.2)";
};

const soltar = (e: any) => {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 5px 0 rgba(0,0,0,0.2)";
};
// =========================================================
// 🔔 ALERTA GLOBAL VIAJE
// =========================================================
const reproducirAlertaViaje =
  async () => {

  try {

    // 🔇 detener audio anterior
    if (audioRef.current) {

      audioRef.current.pause();

      audioRef.current.currentTime = 0;
    }

    // 🔊 nuevo audio
    const audio =
      new Audio(
        "/notification.mp3"
      );

    audio.volume = 1;

    // 🔥 loop infinito
    audio.loop = true;

    await audio.play();

    audioRef.current = audio;

    // =====================================================
    // 📳 VIBRACIÓN
    // =====================================================
    if (navigator.vibrate) {

      navigator.vibrate([
        500,
        300,
        500,
        300,
        800
      ]);
    }

    // =====================================================
    // 🔔 PUSH VISUAL
    // =====================================================
    if (
      notificationPermissionRef.current
    ) {

      new Notification(
  "🚖 New Ride Request",
  {
    body:
      "A customer needs a ride now.",

    icon:
      "/icon-192.png",

    badge:
      "/icon-192.png",

    requireInteraction:
      true,

    silent: false
  } as NotificationOptions
);
    }

    console.log(
      "🔔 ALERTA ACTIVADA"
    );

  } catch (err) {

    console.error(
      "ALERTA ERROR:",
      err
    );
  }
};

if (loadingAuth) {

  return (

    <div
      style={{
        color: "#fff",
        display: "flex",
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
        fontSize: 18,
        background: "#000"
      }}
    >
      🔐 Restoring session...
    </div>
  );
}

  if (!isLoaded) return <div>Cargando...</div>;

 return (
  <div
    style={{
      minHeight: "100vh",
      background: "#0f0f0f",
      color: "#fff",
      fontFamily: "system-ui"
    }}
  >
    <div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 10,
   background:
  "rgba(10,10,10,0.92)",
     backdropFilter: "blur(10px)",
    padding: "8px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
  }}
>
  {/* IZQUIERDA */}
  <div>
    <h3 style={{ margin: 0 }}>🚗 Driver Panel</h3>
    <span style={{ fontSize: 12, color: activo ? "#00ff99" : "#ff4d4d" }}>
  {activo ? "● Online" : "● Offline"}
</span>
  </div>

  {/* DERECHA */}
  <div style={{ display: "flex", alignItems: "center", gap: 15 }}>

    {/* 🔊 SONIDO */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        setSonidoActivo(!sonidoActivo);

       if (!sonidoActivo) {

  const unlock =
    new Audio(
      "/notification.mp3"
    );

  unlock.volume = 0.01;

  unlock.play()
    .then(() => {

      unlock.pause();

      unlock.currentTime = 0;
    })
    .catch(() => {});
}
      }}
      style={{
        background: "transparent",
        border: "none",
        fontSize: "22px",
        cursor: "pointer",
        color: "#eee9e9",
        transition: "0.2s"
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {sonidoActivo ? "🔊" : "🔇"}
    </button>
   
<button
  onClick={async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const nuevoEstado = !activo;
    setActivo(nuevoEstado);

    await update(ref(db, "drivers/" + uid), {
      activo: nuevoEstado,
      online: nuevoEstado
    });
  }}
  style={{
    background: activo ? "rgba(40, 167, 69, 0.2)" : "#333", // Fondo sutil si está online
    border: activo ? "1px solid #28a745" : "none",
    padding: "8px 12px",
    borderRadius: 8,
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600"
  }}
>
  {activo ? "🟢 Online" : "🔴 Offline"}
</button>

{/* BOTÓN CONFIGURACIÓN */}
<motion.button
  whileHover={{ scale: 1.2, rotate: 90 }}
  whileTap={{ scale: 0.9 }}
  onClick={() => (router.push("/driver/profile"))}
  style={{
    background: "transparent",
    border: "none",
    color: "#f1ebeb",
    fontSize: 22,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px"
  }}
>
  ⚙️
</motion.button>

{/* CIERRES DE DIVS DEL HEADER */}
  </div>
</div> {/* 🔥 CIERRA HEADER COMPLETO */}
<div
  style={{
    position: "relative",
    height: "calc(100vh - 70px)"
  }}
>

  {/* 🗺️ MAPA */}

  <GoogleMap
  onLoad={(map) => {

  mapRef.current = map;
}}
    mapContainerStyle={{
      width: "100%",
      height: "100%"
    }}

    center={
      driverLocation || {
        lat: 36.1699,
        lng: -115.1398
      }
    }

    zoom={12}

    options={{styles: darkMapStyle,
      disableDefaultUI: true,
      clickableIcons: false
    }}
  >

    {/* 🚗 DRIVER */}

    {driverLocation && (

      <Marker
  position={driverLocation}

  label={{
    text: "🚘",
    fontSize: "20px"
  }}
/>
    )}

    {/* 📍 USERS */}
{viajes.map((v, index) => (

  v.origenLat &&
  v.origenLng && (

    <Marker

      key={`marker-${v.id}`}

      position={{
        lat: Number(v.origenLat),
        lng: Number(v.origenLng)
      }}

      label={{

        text: `${index + 1}`,

        color: "#111",

        fontWeight: "bold",

        fontSize: "13px"
      }}

      icon={{

        url:
"data:image/svg+xml;charset=UTF-8," +

encodeURIComponent(`

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="44"
  height="44"
  viewBox="0 0 24 24"
>

  <path
    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
    fill="#FFD400"
    stroke="white"
    stroke-width="1.5"
  />

</svg>
`),

        scaledSize:
          new window.google.maps.Size(
            44,
            44
          ),

        labelOrigin:
          new window.google.maps.Point(
            22,
            15
          )
      }}
    />
  )
))}

  </GoogleMap>

  {/* 🚕 PANEL VIAJES */}

  <div
    style={{
      position: "absolute",

      bottom: 0,

      left: 0,

      width: "100%",

      maxHeight: "32vh",

      overflowY: "auto",

      padding: 10,

      borderTopLeftRadius: 28,

      borderTopRightRadius: 28,

      background:
        "rgba(12,12,12,0.96)",

      backdropFilter:
        "blur(14px)",

      boxShadow:
        "0 -10px 50px rgba(0,0,0,0.6)"
    }}
  >

    {viajes.map((v, index) => (

      <div
        key={v.id}

      
       style={{
  background:
    index === 0
      ? "linear-gradient(90deg,#162617,#101010)"
      : "#1a1a1a",

  boxShadow:
    index === 0
      ? "0 0 20px rgba(0,255,153,0.12)"
      : "none",

  border:
    index === 0
      ? "1px solid #00ff99"
      : "1px solid #2a2a2a",

  borderRadius: 20,

  padding: "10px 12px",

  marginBottom: 6,

  cursor: "default",

  WebkitTapHighlightColor:
    "transparent",

  userSelect: "none"
}}
      >

        {/* CLIENTE */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10
  }}
>

  <div
    style={{
      width: 30,
      height: 30,

      borderRadius: "50%",

      border:
        "2px solid #FFD400",

      display: "flex",

      alignItems: "center",

      justifyContent: "center",

      color: "#FFD400",

      fontWeight: "bold",

      flexShrink: 0
    }}
  >
    {index + 1}
  </div>
        <p
          style={{
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 2
          }}
        >
          {v.nombre}
        </p>
        </div>

        {/* PICKUP */}

        <p
          style={{
            color: "#ddd",
            fontSize: 14,
            marginBottom: 2
          }}
        >
          📍 {v.origen}
        </p>

        {/* DESTINO */}

        <p
          style={{
            color: "#999",
            fontSize: 14
          }}
        >
          🏁 {v.destino}
        </p>

        {/* ETA + PRECIO */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",

            alignItems: "center",

            marginTop: 2,

            marginBottom: 2
          }}
        >

          <div
            style={{
              color: "#00ff99",
              fontWeight: "bold",
              fontSize: 15
            }}
          >
            🚗 {etas[v.id]?.toFixed(0) || "--"} min
            {" "}
(
{distanciasPickup[v.id]
  ?.toFixed(1)} mi
)
          </div>

          <div
            style={{
              color: "#ffd54f",
              fontWeight: "bold",
              fontSize: 16
            }}
          >
          <div
  style={{
    textAlign: "right"
  }}
>

  <div
    style={{
      color: "#FFD54F",
      fontWeight: "bold",
      fontSize: 22
    }}
  >
    ${Number(v.precio || 0)
      .toFixed(2)}
  </div>

  <div
    style={{
      marginTop: 2,

      fontSize: 11,

      color:
        v.metodoPago === "cash"
          ? "#00ff99"
          : "#00d4ff",

      fontWeight: "bold"
    }}
  >
    {v.metodoPago === "cash"
      ? "CASH"
      : "CARD"}
  </div>

</div>
          </div>

        </div>

        {/* ESTADO */}

        <p
          style={{
            marginTop: 4,
            fontSize: 10,
            color:
              v.estado === "Asignado"
                ? "#00ff99"
                : "#ccc",

            fontWeight: "bold"
          }}
        >
          {v.estado === "Asignado"
            ? "🔒 Assigned"
            : v.estado}
        </p>

        {/* BOTONES */}

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 10,
            flexWrap: "wrap"
          }}
        >

          {v.estado ===
            "Pendiente" && (

            <>
              <button
                style={estiloBoton(
                  "#28a745"
                )}

                onMouseDown={
                  presionar
                }

                onMouseUp={
                  soltar
                }

                onMouseLeave={
                  soltar
                }

                onClick={(e) => {

                  e.stopPropagation();

                  aceptarViaje(v);
                }}
              >
                ✅ Aceptar
              </button>

              <button
                style={estiloBoton(
                  "#6c757d"
                )}

                onClick={(e) => {

                  e.stopPropagation();

                  rechazar(v);
                }}
              >
                ❌ Rechazar
              </button>
            </>
          )}
          
  {/* SE MUESTRAN SI EL VIAJE YA FUE ASIGNADO A ESTE DRIVER */}
  {v.estado === "Asignado" && v.driverId === auth.currentUser?.uid && (
    <>
      {(() => {
        const ahora = Date.now();
        const puedeIniciar = !v.fecha || v.fecha <= ahora + 2 * 60 * 1000;

        return (
          <button
            style={estiloBoton(puedeIniciar ? "#007bff" : "#555")}
            disabled={!puedeIniciar}
            onMouseDown={presionar}
            onMouseUp={soltar}
            onMouseLeave={soltar}
            onClick={async (e) => {
              e.stopPropagation();
              await iniciarViaje(v);
            }}
          >
            {puedeIniciar ? "🚗 Iniciar Viaje" : "⏳ Esperar hora"}
          </button>
        );
      })()}

      <button
        style={estiloBoton("#dc3545")}
        onMouseDown={presionar}
        onMouseUp={soltar}
        onMouseLeave={soltar}
        onClick={(e) => {
          e.stopPropagation();
          cancelar(v);
        }}
      >
        🚫 Cancelar
      </button>
    </>
  )}

</div>

      </div>
    ))}

  </div>
</div>
</div>
);
}