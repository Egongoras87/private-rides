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
import { useEffect, useState, useRef } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";



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
  const [viajes, setViajes] = useState<any[]>([]);
  const [etas, setEtas] = useState<any>({});
  const { isLoaded } = useJsApiLoader(googleMapsConfig);
const audioRef = useRef<HTMLAudioElement | null>(null);
const viajesPrevRef = useRef<string[]>([]);
const [sonidoActivo, setSonidoActivo] = useState(false);
 const [activo, setActivo] = useState(true);

useEffect(() => {
  let watchId: number | null = null;

  const unsub = onAuthStateChanged(auth, (user) => {
    if (!user || !activo) return;

    if (!navigator.geolocation) return;

    watchId = navigator.geolocation.watchPosition((pos) => {
      update(ref(db, "drivers/" + user.uid), {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        lastSeen: Date.now(),
        online: true
      });
    });
  });

  return () => {
    unsub();

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
}, [activo]);
// 🔐 AUTH
 useEffect(() => {
  let off: any = null;

  const unsub = onAuthStateChanged(auth, async (user) => {
    
    if (!user) {
      window.location.href = "/login?redirect=/driver";
      return;
    }

    const driverRef = ref(db, "drivers/" + user.uid);

    off = onValue(driverRef, async (snap) => {
      const data = snap.val();

      if (!data?.viajeActivo) return;

      const viajeRef = ref(db, "viajes/" + data.viajeActivo);
      const snapViaje = await get(viajeRef);
      const v = snapViaje.val();

      if (!v) return;

      if (v.estado === "En camino" || v.estado === "En viaje") {
        window.location.href = `/driver-tracking?id=${data.viajeActivo}`;
      } else {
        await update(ref(db, "drivers/" + user.uid), {
          viajeActivo: null
        });
      }
    });
  });

  return () => {
    unsub();
    if (off) off();
  };
}, []);

useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {   
    if (!user) return;

    const driverRef = ref(db, "drivers/" + user.uid);

    // 🟢 ONLINE
    update(driverRef, {
  uid: user.uid,
  lastSeen: Date.now()
});

    // 🔴 OFFLINE automático
    onDisconnect(driverRef).update({
      online: false,
      lastSeen: Date.now()
    });
  });

  return () => unsub();
}, []);

useEffect(() => {
  audioRef.current = new Audio("/alert.mp3");
}, []);
  // 📡 VIAJES
  useEffect(() => {
    const viajesRef = ref(db, "viajes");

    const unsub = onValue(viajesRef, (snap) => {
      const data = snap.val();
      if (!data) return setViajes([]);
console.log("🔥 SNAP:", snap.val());
      const lista = Object.entries(data).map(([id, v]: any) => ({
        id,
        ...v
      }));
// 🔊 DETECTAR NUEVOS VIAJES
const idsActuales = lista.map((v) => v.id);

// comparar con anteriores
const nuevos = idsActuales.filter(
  (id) => !viajesPrevRef.current.includes(id)
);

// si hay nuevos → sonar
// si hay nuevos → sonar SOLO si está activado
if (nuevos.length > 0 && sonidoActivo) {
 const nuevos = idsActuales.filter(
  (id) => !viajesPrevRef.current.includes(id)
);
}

// guardar lista actual SIEMPRE
viajesPrevRef.current = idsActuales;

const ahora = Date.now();

const filtrados = lista.filter((v) => {
  if (
  v.estado !== "Pendiente" &&
  !(v.estado === "Asignado" && v.driverId === auth.currentUser?.uid)
) {
  return false;
}

  const esInmediato = Math.abs((v.fecha || 0) - ahora) < 30 * 60 * 1000;

  if (esInmediato) {
   if (!etas[v.id]) return true; // 🔥 MOSTRAR mientras carga

return etas[v.id] < 20;
  }

  return true;
});

setViajes(filtrados);
    });

    return () => unsub();
  }, []);


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

    await Promise.all(
  viajes.map(async (v) => {
    if (!v.origenLat || !v.origenLng) return;

    const origen = {
      lat: Number(v.origenLat),
      lng: Number(v.origenLng)
    };

    const eta = await calcularETA(driverPos, origen);
    nuevos[v.id] = eta;
  })
);

    setEtas(nuevos);
    // 🔥 ORDENAR POR TIEMPO + DISTANCIA
setViajes((prev) => {
  return [...prev].sort((a, b) => {
    const ahora = Date.now();

    const tiempoA = Math.abs((a.fecha || 0) - ahora);
    const tiempoB = Math.abs((b.fecha || 0) - ahora);

    const etaA = nuevos[a.id] || 999;
    const etaB = nuevos[b.id] || 999;

    // 🔥 PESOS (puedes ajustar)
    const scoreA = tiempoA * 0.001 + etaA * 60;
    const scoreB = tiempoB * 0.001 + etaB * 60;

    return scoreA - scoreB;
  });
});
  });
}, [viajes, isLoaded]);

  ////////////////////////////////// 🚗 ACEPTAR RIDE/////////////////////////////////////////////////////////////////////////////
const aceptarViaje = async (v: any) => {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    alert("Error de usuario");
    return;
  }

  const viajeRef = ref(db, "viajes/" + v.id);

  const result = await runTransaction(viajeRef, (data) => {
    if (!data) return;

    // 🔴 si otro driver ya lo tomó
    if (data.driverId && data.driverId !== uid) return;

    // 🔴 si ya no está disponible
    if (data.estado !== "Pendiente") return;

    // 🟢 asignar viaje
    return {
      ...data,
      driverId: uid,
      estado: "Asignado",
      asignadoAt: Date.now()
    };
  });

  if (!result.committed) {
    alert("❌ Otro driver tomó este viaje");
    return;
  }

  // 🔥 marcar driver ocupado
  await update(ref(db, "drivers/" + uid), {
    viajeActivo: v.id
  });

  alert("✅ Viaje aceptado");
};
////////////////////////////////////////////// INICIAR VIAJE ////////////////////////////////////////////////////////////
const iniciarViaje = async (v: any) => {
  if (!v?.id) return;

  const uid = auth.currentUser?.uid;

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

  // 🚗 iniciar
  await update(ref(db, "viajes/" + v.id), {
    estado: "En camino"
  });

  window.location.href = `/driver-tracking?id=${v.id}`;
};
// /////////////////////////////////////FINALIZAR////////////////////////////////////////////////////////////////////////////
const finalizar = async (v: any) => {
  if (!v?.id) return;

  const uid = auth.currentUser?.uid;

  // 📍 VALIDAR DISTANCIA
  if (v.driverLat && v.driverLng && v.destinoLat && v.destinoLng) {
    const dist = calcularDistancia(
      { lat: Number(v.driverLat), lng: Number(v.driverLng) },
      { lat: Number(v.destinoLat), lng: Number(v.destinoLng) }
    );

    // 🔥 SI ESTÁ LEJOS (ej: más de 0.1 millas ≈ 160m)
    if (dist > 0.1) {
      const confirmar = confirm(
        "⚠️ Aún no has llegado al destino.\n\n¿Seguro quieres finalizar el viaje?"
      );

      if (!confirmar) return;
    }
  }

  // 💵 CASH VALIDATION
  if (v.metodoPago === "cash" && !v.pagado) {
    if (!confirm("¿Cliente pagó en efectivo?")) return;
  }

  await update(ref(db, "viajes/" + v.id), {
    estado: "Finalizado",
    pagado: true
  });

  if (uid) {
    await update(ref(db, "drivers/" + uid), {
      viajeActivo: null
    });
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


// ❌ RECHAZAR VIAJE ///////////////////////////////////////////////
const rechazar = async (v: any) => {
  if (!v?.id) return;

  try {
    const viajeRef = ref(db, "viajes/" + v.id);

    // 🔴 REFUND SOLO SI APLICA
    if (v.metodoPago === "stripe" && v.pagado && v.paymentIntentId) {
      const token = await auth.currentUser?.getIdToken();

await fetch("/api/refund-reject", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    viajeId: v.id
  })
});
    }

    await update(viajeRef, {
      estado: "Cancelado",
      canceladoPor: "driver",
      mensaje: "Driver no disponible"
    });

    if (v.telefono) {
    const telefono = "1" + v.telefono.replace(/\D/g, "");

      const mensaje =
        "❌ Driver no disponible\n\n" +
        (v.metodoPago === "stripe"
          ? "💳 Tu pago será reembolsado completamente."
          : "Puedes intentar nuevamente más tarde.");

      window.open(
        `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
      );
    }

  } catch (error) {
    console.error("ERROR RECHAZANDO:", error);
    alert("Error al rechazar viaje");
  }
};
// ❌ CANCELAR VIAJE (YA TOMADO)////////////////////////////////////////////////////////////////////////////
const cancelar = async (v: any) => {
  try {
    const id = v.id;

    if (!id) {
      alert("No hay viajeId");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("No autenticado");
      return;
    }

    const token = await user.getIdToken();

    const res = await fetch("/api/refund-driver", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        viajeId: id
      })
    });

    // 🔥 DEBUG
    const text = await res.text();

    console.log("STATUS:", res.status);
    console.log("RAW:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("❌ NO ES JSON →", text);
    }

    if (!res.ok) {
      alert("Error cancelando viaje");
      return;
    }

    alert("Viaje cancelado");

    window.location.href = "/driver";

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
        color: "#fff",
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
>
  {activo ? "🟢 Online" : "🔴 Offline"}
</button>
    <button
  onClick={() => (window.location.href = "/admin-drivers")}
  style={{
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer"
  }}
>
  ⚙️
</button>

 </div>
</div> {/* 🔥 CIERRA HEADER COMPLETO */}

<div style={{ padding: 16 }}>
  {viajes.map((v) => (
      <div
        key={v.id}
        onClick={() => {
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
            <p>⏱ Pickup: {etas[v.id].toFixed(1)} min</p>
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
        <div style={{ display: "flex", gap: 5, marginTop: 10 }}>

  <button
    style={estiloBoton("#28a745")}
    disabled={v.estado !== "Pendiente"}
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

  {/* 🔥 AQUÍ VA */}
  {(() => {
    const ahora = Date.now();
    const puedeIniciar =
      v.estado === "Asignado" &&
      (!v.fecha || v.fecha <= ahora + 2 * 60 * 1000);

    return (
      <button
        style={estiloBoton("#007bff")}
        disabled={!puedeIniciar}
        onMouseDown={presionar}
        onMouseUp={soltar}
        onMouseLeave={soltar}
        onClick={(e) => {
          e.stopPropagation();
          iniciarViaje(v);
        }}
      >
        {puedeIniciar ? "🚗 Iniciar" : "⏳ Esperar"}
      </button>
    );
  })()}

  <button
    style={estiloBoton("#dc3545")}
    onClick={(e) => {
      e.stopPropagation();
      cancelar(v);
    }}
  >
    ❌ Cancelar
  </button>

</div>
        

        </div>
          ))}
  </div>

</div> 
);
}