"use client";
export const dynamic = "force-dynamic";



import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";

export default function DriverPage() {
  const [viajes, setViajes] = useState<any[]>([]);
  const [etas, setEtas] = useState<any>({});
  const watchRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
 const { isLoaded } = useJsApiLoader(googleMapsConfig);
 const llegoPickupRef = useRef(false);

useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "/login";
    }
  });

  return () => unsub();
}, []);

  // 🔥 LEER VIAJES EN TIEMPO REAL
  useEffect(() => {
    const viajesRef = ref(db, "viajes");

    const unsubscribe = onValue(viajesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return setViajes([]);

      const lista = Object.entries(data).map(([id, v]: any) => ({
        id,
        ...v
      }));

      const activos = lista.filter(
        (v) => v.estado === "Pendiente" || v.estado === "En camino"
      );

      activos.sort((a, b) => b.fecha - a.fecha);

      setViajes(activos);
    });

    return () => unsubscribe();
  }, []);

  // 🔥 CALCULAR ETA
  // 🔥 CALCULAR ETA COMPLETO
useEffect(() => {
  if (!isLoaded) return;
  if (!navigator.geolocation) return;
  if (!viajes || viajes.length === 0) return;

  const calcularTodos = async () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {

      const driverPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      const nuevosEtas: any = {};

      for (const v of viajes) {

        // 🔥 VALIDAR DATOS
        if (
          !v.origenLat ||
          !v.origenLng ||
          !v.destinoLat ||
          !v.destinoLng
        ) {
          continue;
        }

        const origen = {
          lat: Number(v.origenLat),
          lng: Number(v.origenLng)
        };

        const destino = {
          lat: Number(v.destinoLat),
          lng: Number(v.destinoLng)
        };

        // 🔥 CALCULAR ETAs
        const etaPickup = await calcularETA(driverPos, origen);
        const etaDestino = await calcularETA(origen, destino);

        // 🔥 CALCULAR DELAY
        const fechaViaje = Number(v.fecha || Date.now());
        const ahora = Date.now();

        const diferenciaMin = (fechaViaje - ahora) / 60000;
        const retraso = diferenciaMin - etaPickup;

        nuevosEtas[v.id] = {
          pickup: etaPickup,
          destino: etaDestino,
          retraso
        };
      }

      setEtas(nuevosEtas);
    });
  };

  calcularTodos();

}, [viajes, isLoaded]);

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
        if (
          status === "OK" &&
          res?.routes?.[0]?.legs?.[0]
        ) {
          const leg = res.routes[0].legs[0];

          const minutos = leg.duration?.value
            ? leg.duration.value / 60
            : 0;

          resolve(minutos);
        } else {
          resolve(0);
        }
      }
    );
  });

 // 🚗 EN CAMINO
const enCamino = async (v: any) => {
  // 1. Actualizar estado
  await update(ref(db, "viajes/" + v.id), {
    estado: "En camino"
  });

  
  const telefono = "1" + v.telefono;
  const urlTracking = `${window.location.origin}/tracking?id=${v.id}`;

  // 3. Enviar WhatsApp (opcional)
  window.open(
    `https://wa.me/${telefono}?text=${encodeURIComponent(
      "🚗 Voy en camino\n\n📡 Tracking:\n" + urlTracking
    )}`
  );

  // 4. 🔥 IR A TU MAPA (NO Google Maps)
  window.location.href = `/driver-tracking?id=${v.id}`;
};

  // ✅ FINALIZAR
  const finalizar = async (id: string) => {
    await update(ref(db, "viajes/" + id), {
      estado: "Finalizado"
    });

    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
  };

  // ❌ CANCELAR
  const cancelar = async (v: any) => {
    await update(ref(db, "viajes/" + v.id), {
      estado: "Cancelado"
    });

    const telefono = "1" + v.telefono;

    window.open(
      `https://wa.me/${telefono}?text=${encodeURIComponent(
        "❌ Tu viaje ha sido cancelado"
      )}`
    );
  };
// 🚫 DECLINAR VIAJE
const declinar = async (v: any) => {
  if (!v?.id) return;

  try {
    const viajeRef = ref(db, "viajes/" + v.id);

    // 🔴 1. ACTUALIZAR ESTADO COMPLETO
    await update(viajeRef, {
      estado: "Cancelado",
      mensaje: "❌ Your trip has been declined. Please try again later.",
      driverLat: null,
      driverLng: null,
      timestampCancelado: Date.now()
    });

    // 🔴 2. DETENER GPS (POR SI ESTABA ACTIVO)
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    // 🔴 3. ENVIAR WHATSAPP
    if (v.telefono) {
      const telefono = "1" + v.telefono;

      window.open(
        `https://wa.me/${telefono}?text=${encodeURIComponent(
          "❌ Your trip has been declined. Please try again later."
        )}`,
        "_blank"
      );
    }

    // 🔴 4. FEEDBACK VISUAL
    alert("Ride declined correctamente");

  } catch (error) {
    console.log("❌ Error declinando:", error);
  }
};

  const btn = (bg: string) => ({
    padding: "10px 15px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background: bg,
    color: "#fff",
    boxShadow: "0 4px 0 rgba(0,0,0,0.2)",
    transition: "all 0.15s"
  });

  if (!isLoaded) return <div>Cargando mapa...</div>;

return (
  <div style={{ padding: 20 }}>
    <h2>🚗 Driver Panel</h2>
    <div style={{ color: "lime", background: "black", padding: 10 }}>
  GPS: {lastPosRef.current?.lat} - {lastPosRef.current?.lng}
</div>

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
    <p><b>Precio:</b> ${v.precio}</p>
    <p><b>Distancia:</b> {v.distancia} mi</p>

    {etas[v.id] && (
      <>
        <p>⏱ Pickup: {etas[v.id].pickup.toFixed(1)} min</p>
        <p>🏁 Viaje: {etas[v.id].destino.toFixed(1)} min</p>
        <p>
          {etas[v.id].retraso < 0
            ? "⚠️ Retrasado"
            : "✔ A tiempo"}
        </p>
      </>
    )}

    <p><b>Estado:</b> {v.estado}</p>

    {/* BOTONES */}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button onClick={() => window.location.href = "/login"}>
  Login Driver
</button>

      <button
        style={btn("#28a745")}
        onClick={(e) => {
          e.stopPropagation();
          enCamino(v);
        }}
      >
        🚗 En camino
      </button>

      <button
        style={btn("#007bff")}
        onClick={(e) => {
          e.stopPropagation();
          finalizar(v.id);
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
        style={btn("#6c757d")}
        onClick={(e) => {
          e.stopPropagation();
          declinar(v);
        }}
      >
        🚫 Ride Declined
      </button>

    </div>
  </div>
))}
  </div>
);
}