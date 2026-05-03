"use client";
export const dynamic = "force-dynamic";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, update, get, runTransaction } from "firebase/database";
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


export default function DriverPage() {
  const [viajes, setViajes] = useState<any[]>([]);
  const [etas, setEtas] = useState<any>({});
  const { isLoaded } = useJsApiLoader(googleMapsConfig);
const audioRef = useRef<HTMLAudioElement | null>(null);
const viajesPrevRef = useRef<string[]>([]);
const [sonidoActivo, setSonidoActivo] = useState(false);
const [tomandoViajeId, setTomandoViajeId] = useState<string | null>(null);
  

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
  audioRef.current?.play().catch(() => {});
}

// guardar lista actual
viajesPrevRef.current = idsActuales;
const activos = lista.filter((v) => {
  return (
    v.estado === "Pendiente" &&
    (!v.driverId || v.driverId === "")
  );
});


setViajes(activos);
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

  // 🚗 EN CAMINO/////////////////////////////////////////////////////////////////////////////
const enCamino = async (v: any) => {
  if (!v?.id) return;

  // 🔒 EVITAR DOBLE CLICK POR VIAJE
  if (v.estado !== "Pendiente") return;
  setTomandoViajeId(v.id);

  const uid = auth.currentUser?.uid;
  if (!uid) {
    setTomandoViajeId(null);
    return;
  }

  const viajeRef = ref(db, "viajes/" + v.id);

  try {
    // 🔒 1. TRANSACCIÓN → SOLO ASIGNAR
    const result = await runTransaction(viajeRef, (currentData) => {
      if (!currentData) return;

      // 🚫 ya tomado por otro driver
      if (currentData.driverId && currentData.driverId !== uid) {
        return;
      }

      // 🚫 ya no disponible
      if (currentData.estado !== "Pendiente") {
        return;
      }

      // ✅ ASIGNAR
      return {
        ...currentData,
        driverId: uid,
        estado: "Asignado",
        asignadoAt: Date.now()
      };
    });

    // 🚫 si otro lo tomó
    if (!result.committed) {
      alert("❌ Este viaje ya fue tomado por otro driver");
      setTomandoViajeId(null);
      return;
    }

    // 🔴 2. GUARDAR EN DRIVER
    await update(ref(db, "drivers/" + uid), {
      viajeActivo: v.id
    });

    // 🚗 3. CAMBIAR A "EN CAMINO"
    await update(viajeRef, {
      estado: "En camino"
    });

    // 📲 WHATSAPP
    if (v.telefono) {
    const telefono = "1" + v.telefono.replace(/\D/g, "");
      const link = `${window.location.origin}/tracking?id=${v.id}`;

      window.open(
        `https://wa.me/${telefono}?text=${encodeURIComponent(
          "🚗 Voy en camino\n\n📍 Sigue tu viaje aquí:\n" + link
        )}`
      );
    }

    // 🔀 IR A TRACKING
    setTomandoViajeId(null);
    window.location.href = `/driver-tracking?id=${v.id}`;

  } catch (error) {
    console.error("ERROR TRANSACTION:", error);
    alert("❌ Error al tomar el viaje");
    setTomandoViajeId(null);
  }
};

// 📍 LLEGAR
const llegarPickup = async (v: any) => {
  if (!v?.id) return;

  await update(ref(db, "viajes/" + v.id), {
    estado: "En pickup"
  });
};

// 🚀 INICIAR
const iniciarViaje = async (v: any) => {
  if (!v?.id) return;

  await update(ref(db, "viajes/" + v.id), {
    estado: "En viaje"
  });
};

// ✅ FINALIZAR
const finalizar = async (v: any) => {
  if (!v?.id) return;

  const uid = auth.currentUser?.uid;

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

await fetch("/api/refund-driver", {
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
// ❌ CANCELAR VIAJE (YA TOMADO)
const cancelar = async (v: any) => {
  if (!v?.id) return;

  try {
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
      alert("No autenticado");
      return;
    }

    const res = await fetch("/api/refund-driver", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        viajeId: v.id
      })
    });

    if (!res.ok) {
      alert("Error al cancelar");
      return;
    }

    if (v.telefono) {
    const telefono = "1" + v.telefono.replace(/\D/g, "");

      const mensaje =
        "❌ Tu viaje fue cancelado por el conductor.\n\n" +
        (v.metodoPago === "stripe"
          ? "💳 Tu pago será reembolsado completamente."
          : "Puedes intentar nuevamente.");

      window.open(
        `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
      );
    }

    alert("Viaje cancelado");

  } catch (error) {
    console.error(error);
    alert("Error al cancelar");
  }
};

  if (!isLoaded) return <div>Cargando...</div>;

  return (
  <div style={{ padding: 20 }}>
    <h2>🚗 Driver Panel</h2>

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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
  style={btn("#6c757d")} // gris elegante tipo Uber
  onClick={(e) => {
    e.stopPropagation();
    rechazar(v);
  }}
>
  ❌ Rechazar
</button>

  <button
  style={btn("#28a745")}
  disabled={tomandoViajeId === v.id}
  onClick={(e) => {
    e.stopPropagation();
    enCamino(v);
  }}
>
  {tomandoViajeId === v.id ? "Tomando..." : "En camino"}
</button>

          <button
            style={btn("#007bff")}
            onClick={(e) => {
              e.stopPropagation();
              iniciarViaje(v);
            }}
          >
            🚀 Iniciar
          </button>

          <button
            style={btn("#28a745")}
            onClick={(e) => {
              e.stopPropagation();
              finalizar(v);
            }}
          >
            ✅ Finalizar
          </button>

          <button
            style={btn("#dc3545")}
            onClick={(e) => {
              e.stopPropagation();
              cancelar(v);
            }}
          >
            ❌ Cancelar
          </button>
         <button
  onClick={(e) => {
    e.stopPropagation();

    // 🔁 cambiar estado
    setSonidoActivo(!sonidoActivo);

    // 🔊 reproducir solo al activar
    if (!sonidoActivo) {
      audioRef.current?.play().catch(() => {});
    }
  }}
>
  {sonidoActivo ? "🔊 Sonido ON" : "🔇 Sonido OFF"}
</button>

        </div>
      </div>
    ))}
    </div>
);
}