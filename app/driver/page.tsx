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
  onDisconnect,
  set
} from "firebase/database";

import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth }
from "@/components/AuthProvider";

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
  const { isLoaded } = useJsApiLoader(googleMapsConfig);
const { user, loading } = useAuth();
const ultimoViajeNotificadoRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Para poder detener el sonido después
const [sonidoActivo, setSonidoActivo] = useState(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("sonido") !== "false";
  }
  return true;
});
 const [activo, setActivo] = useState(true);
 const router = useRouter();

useEffect(() => {

  let watchId: number | null = null;

  if (!user || !activo) return;

  if (!navigator.geolocation) return;

  watchId =
    navigator.geolocation.watchPosition(
      (pos) => {

        update(
          ref(db, "drivers/" + user.uid),
          {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            lastSeen: Date.now(),
            online: true
          }
        );
      }
    );

  return () => {

    if (watchId !== null) {

      navigator.geolocation.clearWatch(
        watchId
      );
    }
  };

}, [user, activo]);
// 🔐 AUTH
 useEffect(() => {

  if (loading) return;

  if (!user) {

    router.replace(
      "/login?redirect=/driver"
    );

    return;
  }

  // 🔥 usuario autenticado aquí

}, [user, loading, router]);

useEffect(() => {

  if (!user) return;

  // evitar doble ejecución
  if (restoringRef.current) return;

  restoringRef.current = true;

  const restoreRide = async () => {

    try {

      // 🔥 buscar driver
      const driverSnap = await get(
        ref(db, "drivers/" + user.uid)
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
          ref(db, "drivers/" + user.uid),
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

        "Asignado",

        "En camino",

        "En viaje"

      ];

      // 🔥 restaurar tracking
      if (
        estadosTracking.includes(
          viaje.estado
        )
      ) {

        window.location.replace(
          `/driver-tracking?id=${viajeId}`
        );

        return;
      }

      // 🔥 limpiar basura
      await update(
        ref(db, "drivers/" + user.uid),
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

}, [user]);
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

useEffect(() => {

  if (!user) return;

  const driverRef =
    ref(db, "drivers/" + user.uid);

  // 🟢 ONLINE
  update(driverRef, {
    uid: user.uid,
    lastSeen: Date.now(),
    online: true
  });

  // 🔴 OFFLINE
  onDisconnect(driverRef).update({
    online: false,
    lastSeen: Date.now()
  });

}, [user]);

// ///////////////////////////////////////////////////////////////📡 VIAJES
// ///////////////////////////////////////////////////////////////📡 VIAJES
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
    // 🔥 5. FILTRO DE VIAJES (Sincronizado con 'rechazos')
    // =========================================================
    const filtrados = lista.filter((v: any) => {
      // Ocultar si ya rechazó
      if (uid && v.rechazos && v.rechazos[uid]) {
        return false;
      }

      // Visibilidad de estados
      if (
        v.estado !== "Pendiente" &&
        !(v.estado === "Asignado" && v.driverId === uid)
      ) {
        return false;
      }

      // Lógica de tiempo
      const esInmediato = Math.abs((v.fecha || 0) - ahora) < 30 * 60 * 1000;
      if (esInmediato) {
        if (!etas[v.id]) return true;
        return etas[v.id] < 20;
      }

      return true;
    });

    // =========================================================
    // 🔥 6. SET FINAL (Solo una vez)
    // =========================================================
    setViajes(filtrados);
  });

  return () => unsub();
  
}, [sonidoActivo, etas]); // Añadí dependencias necesarias
 useEffect(() => {

  if (!isLoaded) return;

  if (!navigator.geolocation) return;

  if (viajes.length === 0) return;

  navigator.geolocation.getCurrentPosition(async (pos) => {

    const driverPos = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

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

    // 🔥 ordenar viajes
    setViajes((prev) => {

      return [...prev].sort(
        (a, b) => {

          const ahora =
            Date.now();

          const tiempoA =
            Math.abs(
              (a.fecha || 0) -
              ahora
            );

          const tiempoB =
            Math.abs(
              (b.fecha || 0) -
              ahora
            );

          const etaA =
            nuevos[a.id] || 999;

          const etaB =
            nuevos[b.id] || 999;

          const distA =
            nuevasDistancias[a.id] || 999;

          const distB =
            nuevasDistancias[b.id] || 999;

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
        }
      );
    });

  });

}, [viajes, isLoaded]);

  ////////////////////////////////// 🚗 ACEPTAR RIDE/////////////////////////////////////////////////////////////////////////////
const aceptarViaje = async (v: any) => {
  
  const user = auth.currentUser;
  // 🔊 DETENER AUDIO INMEDIATAMENTE
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;
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
    

    // 🟢 SOLO ESTO SE QUEDA EN FRONTEND
    await update(ref(db, "drivers/" + user.uid), {
      viajeActivo: v.id
    });

    alert("✅ Viaje aceptado");

    
  } catch (error) {
    console.error("ERROR ACEPTANDO:", error);
    alert("Error aceptando viaje");
  }
};
////////////////////////////////////////////// INICIAR VIAJE ////////////////////////////////////////////////////////////
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

    console.log("🚗 Viaje en camino");

    // 🔁 REDIRECCIÓN (mantienes tu flujo)
    window.location.href = `/driver-tracking?id=${v.id}`;

  } catch (err) {
    console.error("ERROR iniciarViaje:", err);
    alert("Error inesperado");
  }
};
// /////////////////////////////////////FINALIZAR////////////////////////////////////////////////////////////////////////////
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

const btn = (bg: string) => ({
  padding: "10px 15px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: bg,
  color: "#fff",
  boxShadow: "0 4px 0 rgba(0,0,0,0.2)"
});


// //////////////////////////////////////////❌ RECHAZAR VIAJE (OPTIMIZADO) ///////////////////////////////////////////////
const rechazar = async (v: any) => {
  if (!v?.id) return;

  // 1. Confirmación rápida
  const confirmar = confirm("¿Seguro que quieres ignorar este viaje?");
  if (!confirmar) return;

  // 🔊 DETENER AUDIO INMEDIATAMENTE
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;
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
//////////////////////////////// ❌ CANCELAR VIAJE (YA TOMADO)///////////////////////////////////////////////////



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
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "14px",
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
// 🔊 LÓGICA DE AUDIO INDEPENDIENTE (UBICACIÓN CORRECTA)
// =========================================================
useEffect(() => {
  // Filtramos solo los pendientes de la lista que ya tenemos en el estado
  const pendientes = viajes.filter((v: any) => v.estado === "Pendiente");

  if (pendientes.length === 0) {
    ultimoViajeNotificadoRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    return;
  }

  const viajeActualId = pendientes[0].id;

  // Solo suena si el ID es nuevo y el switch de sonido está ON
  if (viajeActualId !== ultimoViajeNotificadoRef.current && sonidoActivo) {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const nuevoAudio = new Audio("/alert.mp3");
    nuevoAudio.play().catch(() => console.log("Esperando click del driver..."));
    
    audioRef.current = nuevoAudio;
    ultimoViajeNotificadoRef.current = viajeActualId;
  }
}, [viajes, sonidoActivo]);

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
    background: "#1a1a1a",
    padding: "12px 16px",
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
          audioRef.current?.play().catch(() => {});
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
</button> {/* 🔥 AQUÍ FALTABA ESTE CIERRE */}

{/* BOTÓN CONFIGURACIÓN */}
<motion.button
  whileHover={{ scale: 1.2, rotate: 90 }}
  whileTap={{ scale: 0.9 }}
  onClick={() => (window.location.href = "/driver/profile")}
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
<div style={{ padding: 16 }}>
  {viajes.map((v) => (
      <div
        key={v.id}
        onClick={() => {
          // 🔊 Detener audio al tocar la tarjeta del viaje
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
          window.location.href = `/driver-tracking?id=${v.id}`;
        }}
        style={{
          border: "1px solid #ddd",
          padding: 15,
          marginBottom: 10,
          borderRadius: 12,
          cursor: "pointer"
        }}
      >
        <p><b>ID:</b> {v.id}</p>
        <p><b>Cliente:</b> {v.nombre}</p>
        <p><b>Tel:</b> {v.telefono}</p>
        <p><b>Origen:</b> {v.origen}</p>
        <p><b>Destino:</b> {v.destino}</p>
        <p>
  ⭐ Prioridad: {(etas[v.id] || 0).toFixed(1)} min
</p>

        <p>
          <b>Precio:</b>{" "}
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
          }).format(v.precio || 0)}
        </p>

        <p><b>Distancia:</b> {Number(v.distancia || 0).toFixed(2)} mi</p>

        {etas[v.id] && (
          <>
           <p
  style={{
    color: "#00d4ff",
    fontWeight: "bold"
  }}
>
  🚗 Pickup:
  {" "}
  {etas[v.id]?.toFixed(1)}
  min
  •
  {" "}
  {distanciasPickup[v.id]?.toFixed(1)}
  mi away
</p>
          </>
        )}

        <p>
  <b>Estado:</b>{" "}
  {v.estado === "Asignado" ? "🔒 Assigned" : v.estado}
</p>
{v.esProgramado && (
  <p style={{ color: "#17a2b8", fontWeight: "bold" }}>
    🕓 Viaje programado
  </p>
)}
{v.driverId && v.driverId !== auth.currentUser?.uid && (
  <p style={{ color: "red", fontWeight: "bold" }}>
    ❌ Tomado por otro driver
  </p>
)}
{v.fecha && (
  <p style={{ color: "#ffc107", fontWeight: "bold" }}>
    ⏳ {Math.max(0, Math.floor((v.fecha - Date.now()) / 60000))} min restantes
  </p>
)}

        {/* 💳 PAYMENT STATUS */}
        {v.metodoPago === "cash" && !v.pagado && (
          <p style={{ color: "red", fontWeight: "bold" }}>
            💵 CASH - CLIENT PAYS DRIVER
          </p>
        )}

        {v.metodoPago === "stripe" && v.pagado && (
          <p style={{ color: "green", fontWeight: "bold" }}>
            💳 PAID WITH CARD
          </p>
        )}

      {/* BOTONES */}
<div style={{ display: "flex", gap: 10, marginTop: 15, flexWrap: "wrap" }}>
  
  {/* SOLO SE MUESTRAN SI EL VIAJE ESTÁ PENDIENTE */}
  {v.estado === "Pendiente" && (
    <>
      <button
        style={estiloBoton("#28a745")}
        onMouseDown={presionar}
        onMouseUp={soltar}
        onMouseLeave={soltar}
        onClick={(e) => {
          e.stopPropagation();
          aceptarViaje(v);
        }}
      >
        ✅ Aceptar
      </button>

      <button
        style={estiloBoton("#6c757d")}
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
);
}