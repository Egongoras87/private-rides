"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, get } from "firebase/database";

import { useJsApiLoader, GoogleMap, Marker, Polyline, DirectionsRenderer } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function UserTrackingPage() {
  // ===================================================
// 🔥 WAKE LOCK
// ===================================================

const activarWakeLock =
  async () => {

    try {

      if (
        "wakeLock" in navigator
      ) {

        wakeLockRef.current =

          await (
            navigator as any
          ).wakeLock.request(
            "screen"
          );

        console.log(
          "🔒 Wake Lock activo"
        );
      }

    } catch (err) {

      console.error(
        "Wake Lock error:",
        err
      );
    }
  };
  const { isLoaded } = useJsApiLoader(googleMapsConfig);

  // --- ESTADO DEL MAPA ---
  const [pos, setPos] = useState<any>(null);
  const [remainingPath, setRemainingPath] = useState<any[]>([]);
  const [completedPath, setCompletedPath] = useState<any[]>([]);
  const [viajeData, setViajeData] = useState<any>(null);
  
  // --- UI & CONTROL ---
  const [fase, setFase] = useState("espera");
  const [viajeCancelado, setViajeCancelado] = useState(false);
  const [viajeFinalizado, setViajeFinalizado] = useState(false);
  const mapRef = useRef<any>(null);
 
  const lastCameraMoveRef = useRef(0);
const wakeLockRef =
  useRef<any>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);

  // Redirección si no hay sesión
 useEffect(() => {

  const unsub =
    onAuthStateChanged(
      auth,
      async (user) => {

        if (!user) {

          window.location.href =
            "/login-user";

          return;
        }

        // 🔥 SI NO HAY ID EN URL
        let id =
          new URLSearchParams(
            window.location.search
          ).get("id");

        // 🔥 BUSCAR EN LOCALSTORAGE
        if (!id) {

          id =
            localStorage.getItem(
              "viajeId"
            );
        }

        // 🔥 SI TODAVÍA NO HAY ID
        // BUSCAR VIAJE ACTIVO
        if (!id) {

          const snap =
            await get(
              ref(db, "viajes")
            );

          if (!snap.exists()) return;

          const viajes =
            snap.val();

          for (const key in viajes) {

            const v = viajes[key];

            if (

              v.userId === user.uid &&

              (
                v.estado === "Pendiente" ||
                v.estado === "Asignado" ||
                v.estado === "En camino" ||
                v.estado === "En viaje"
              )
            ) {

              localStorage.setItem(
                "viajeId",
                key
              );

             window.location.replace(
  `/tracking?id=${key}`
);

              return;
            }
          }

          // ❌ NO HAY VIAJE ACTIVO
          window.location.href = "/";
        }
      }
    );

  return () => unsub();

}, []);

// ===================================================
// 🔥 MANTENER PANTALLA ENCENDIDA
// ===================================================

useEffect(() => {

  activarWakeLock();

  const handleVisibility =
    async () => {

      // 🔥 volver activar
      if (

        document.visibilityState ===
        "visible"

      ) {

        activarWakeLock();
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

    // 🔓 liberar wake lock
    if (
      wakeLockRef.current
    ) {

      wakeLockRef.current
        .release();

      wakeLockRef.current =
        null;
    }
  };

}, []);


  // --- TRACKING PASIVO (BAJO CONSUMO) ---
useEffect(() => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id || !isLoaded) return;

  const viajeRef = ref(db, "viajes/" + id);
  // Ref para no saturar la API de Google si ya calculamos el ETA local recientemente
  let lastEtaRequest = 0;

  const unsubscribe = onValue(
  viajeRef,
  async (snap) => {
    const d = snap.val();
    if (!d) return;

    setViajeData(d);

// ===================================================
// 🚫 STRIPE REFUND YA NO EN FRONTEND
// ===================================================

// ✅ Backend controla:
// - refunds
// - expiración
// - cancelaciones automáticas
// - scheduler
// - timeout rides

// Frontend SOLO escucha Firebase.

// ===================================================
// ✅ ESTADOS FINALES
// ===================================================

if (
  d.estado === "Finalizado"
) {

  // 🧹 limpiar storage
  localStorage.removeItem(
    "viajeId"
  );

  localStorage.removeItem(
    "viajeData"
  );

  setViajeFinalizado(
    true
  );

  setTimeout(() => {

    window.location.href =
      "/";

  }, 2000);

  return;
}

if (
  d.estado === "Cancelado"
) {

  // 🧹 limpiar storage
  localStorage.removeItem(
    "viajeId"
  );

  localStorage.removeItem(
    "viajeData"
  );

  setViajeCancelado(
    true
  );

  // 🔔 ALERTA SOLO
  // SI NO HAY DRIVERS

  if (
    d.canceladoPor ===
    "no_drivers_available"
  ) {

    alert(
      "No drivers available."
    );
  }

  setTimeout(() => {

    window.location.href =
      "/";

  }, 1500);

  return;
}

    // 2. Sincronización de Fase
    // Usamos una variable local para la lógica inmediata antes de que el estado 'fase' actualice
   let faseActual = "espera";
if (d.estado === "Pendiente") faseActual = "pendiente"; // 👈 AÑADE ESTA LÍNEA
else if (d.estado === "Asignado") faseActual = "aceptado";
else if (d.estado === "En camino") faseActual = "pickup";
else if (d.estado === "En viaje") faseActual = "viaje";
    
    setFase(faseActual);
   // --- BLOQUE CORREGIDO PARA LA RUTA AL DESTINO ---
if (

  faseActual === "viaje" &&

  d.destinoLat &&

  !d.remainingPath &&

  !directionsResponse &&

  window.google?.maps

) {

  const ds =

    new window.google.maps
      .DirectionsService();

  ds.route(

    {

      origin: {

        lat: Number(
          d.driverLat
        ),

        lng: Number(
          d.driverLng
        )
      },

      destination: {

        lat: Number(
          d.destinoLat
        ),

        lng: Number(
          d.destinoLng
        )
      },

      travelMode:
        window.google.maps
          .TravelMode.DRIVING
    },

    (
      result: any,
      status: any
    ) => {

      if (
        status === "OK"
      ) {

        setDirectionsResponse(
          result
        );
      }
    }
  );
}

    // 4. Lectura Directa de Rutas
    if (Array.isArray(d.remainingPath)) setRemainingPath(d.remainingPath);
    if (Array.isArray(d.completedPath)) setCompletedPath(d.completedPath);

    // 5. Posición del Conductor con Suavizado
    const lat = Number(d.driverLat);
    const lng = Number(d.driverLng);
    if (isFinite(lat) && isFinite(lng)) {
      const nuevaPos = { lat, lng };
      
      setPos((prev: any) => {
        if (!prev) return nuevaPos;
        return {
          lat: prev.lat + (nuevaPos.lat - prev.lat) * 0.25,
          lng: prev.lng + (nuevaPos.lng - prev.lng) * 0.25
        };
      });

      // Throttle de cámara (Cada 2 segundos)
      const nowCamera = Date.now();

if (
  mapRef.current &&
  nowCamera - lastCameraMoveRef.current > 2000
) {

  lastCameraMoveRef.current =
    nowCamera;

  mapRef.current.panTo(
    nuevaPos
  );
}
    }
  });

 return () => {

  unsubscribe();

};
}, [isLoaded]); // Quitamos 'fase' de las dependencias para evitar re-suscripciones innecesarias

  // --- LÓGICA DE CANCELACIÓN (Mantenida de tu código) ---
 const cancelarViaje = async () => {

  try {

    const id =
      new URLSearchParams(window.location.search).get("id") ||
      localStorage.getItem("viajeId");

    if (!id) {

      alert("Ride not found");

      return;
    }

    const user =
      auth.currentUser;

    if (!user) {

      alert("Session expired");

      return;
    }

    const viajeRef =
      ref(db, "viajes/" + id);

    const snap =
      await get(viajeRef);

    if (!snap.exists()) {

      alert("Ride does not exist");

      return;
    }

    const viaje =
      snap.val();

    console.log(
      "CANCELANDO VIAJE:",
      viaje
    );

    // ===================================================
    // 🚫 ESTADOS INVÁLIDOS
    // ===================================================

    if (

      viaje.estado === "Finalizado" ||

      viaje.estado === "Cancelado"

    ) {

      alert("Ride already closed");

      return;
    }

    // ===================================================
    // 🚫 DOBLE REFUND
    // ===================================================

    if (
      viaje.refundProcesado
    ) {

      alert(
        "Refund already processed"
      );

      return;
    }

    // ===================================================
    // ⏳ CALCULAR REFUND
    // ===================================================

    const minutos =

      (
        Date.now() -

        (
          viaje.timestamp ||
          Date.now()
        )
      ) / 60000;

    let porcentaje = 0;

    if (minutos <= 2) porcentaje = 1;
    else if (minutos <= 5) porcentaje = 0.5;

    // ===================================================
    // 💳 MENSAJE STRIPE
    // ===================================================

    let mensaje =
      "Cancel ride?";

    if (
      viaje.metodoPago ===
      "stripe"
    ) {

      mensaje =

        porcentaje === 1

          ? "Cancel ride?\nFull refund"

          : porcentaje === 0.5

          ? "Cancel ride?\n50% refund"

          : "Cancel ride?\nNo refund";
    }

    const ok =
      confirm(mensaje);

    if (!ok) return;

   
    // ===================================================
    // 🔐 TOKEN
    // ===================================================

    const token =
      await user.getIdToken(true);

    // ===================================================
    // 🚀 API CANCEL
    // ===================================================

    const response =
      await fetch(
        "/api/refund-cancel",
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`
          },

          body: JSON.stringify({

            viajeId: id,

            percent: porcentaje
          })
        }
      );

    const data =
      await response.json();

    // ===================================================
    // ❌ API ERROR
    // ===================================================

    if (!response.ok) {

      alert(

        data.error ||

        "Unable to cancel ride"
      );

      return;
    }

    console.log(
      "✅ VIAJE CANCELADO:",
      data
    );

    // ===================================================
    // 🧹 STORAGE
    // ===================================================

    localStorage.removeItem(
      "viajeId"
    );

    localStorage.removeItem(
      "viajeData"
    );

    // ===================================================
    // ✅ UI
    // ===================================================

    setViajeCancelado(
      true
    );

    // ===================================================
    // 🏠 REDIRECT
    // ===================================================

    setTimeout(() => {

      window.location.href =
        "/";

    }, 1200);

  } catch (err) {

    console.error(
      "CANCEL ERROR:",
      err
    );

    alert(
      "Unable to cancel ride"
    );
  }
};

  // --- RENDERIZADO DE UI ---
  const btn = (bg: string) => ({
    padding: 12, borderRadius: 10, border: "none", background: bg,
    color: "#fff", cursor: "pointer", boxShadow: "0 4px 0 rgba(0,0,0,0.2)", transition: "0.15s", width: "100%"
  });

  const press = (e: any) => { e.target.style.transform = "scale(0.95)"; };
  const release = (e: any) => { e.target.style.transform = "scale(1)"; };
if (
  !isLoaded ||
  !window.google?.maps
) {

  return (

    <div
      style={{

        background: "#111",

        color: "#fff",

        height: "100vh",

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        fontSize: 18,

        fontWeight: 600
      }}
    >
      Cargando mapa...
    </div>
  );
}

  if (viajeCancelado || viajeFinalizado) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#111", color: "#fff", gap: 20 }}>
        <h2>{viajeCancelado ? "❌ Ride canceled" : "✅ Trip completed"}</h2>
        <button style={{ ...btn(viajeCancelado ? "#dc3545" : "#28a745"), width: "auto", padding: "14px 30px" }} onClick={() => window.location.href = "/"}>🔙 Back to Home</button>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", position: "relative", background: "#111" }}>
      <GoogleMap
        onLoad={(map) => { mapRef.current = map; }}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={pos || { lat: Number(viajeData?.origenLat || 36.1699), lng: Number(viajeData?.origenLng || -115.1398) }}
        zoom={17}
        options={{
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: "greedy",
          mapId: "c7f305f9e66d61eb57ab057d" // Tu ID de mapa de lujo
        }}
      >
        {/* Polilínea Gris: Lo que ya se recorrió */}
        {completedPath.length > 0 && (
          <Polyline path={completedPath} options={{ strokeColor: "#888", strokeOpacity: 0.5, strokeWeight: 3 }} />
        )}

        {/* Polilínea Azul: La ruta exacta que ve el driver */}
        {remainingPath.length > 0 && (
          <Polyline path={remainingPath} options={{ strokeColor: "#1976FF", strokeOpacity: 0.9, strokeWeight: 5 }} />
        )}

        {/* Marcador Conductor (Círculo con Flecha) */}
{pos && (
  <Marker 
    position={pos} 
    icon={{
      // Este path dibuja un círculo (M) y luego una flecha (L/Z) en el centro
      path: "M 0, 0 m -10, 0 a 10,10 0 1,0 20,0 a 10,10 0 1,0 -20,0 M -4,3 L 0,-5 L 4,3 L 0,1 Z",
      fillColor: "#1976FF",
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
      scale: 2, // Ajusta el tamaño general aquí
      rotation: viajeData?.heading || 0,
      anchor: new window.google.maps.Point(0, 0), // Centra el icono en la coordenada
    }} 
  />
)}

        {/* Destino Final */}
        {viajeData?.destinoLat && (
          <Marker position={{ lat: Number(viajeData.destinoLat), lng: Number(viajeData.destinoLng) }} />
        )}
        {directionsResponse && (
    <DirectionsRenderer 
      directions={directionsResponse} 
      options={{ 
        preserveViewport: true, 
        suppressMarkers: true, 
        polylineOptions: { strokeColor: "#1976FF", strokeWeight: 5, strokeOpacity: 0.8 } 
      }} 
    />
  )}
</GoogleMap>

     {/* PANEL DE INFORMACIÓN */}
<div
  style={{

    position: "absolute",

    overflow: "visible",

    zIndex: 20,

    bottom: 0,

    width: "100%",

    background: "#fff",

    padding: "24px 20px",

    borderTopLeftRadius: 24,

    borderTopRightRadius: 24,

    boxShadow:
      "0 -5px 20px rgba(0,0,0,0.1)"
  }}
>

  {/* DRIVER INFO */}
  {viajeData?.driverNombre && (

    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: "1px solid #eee"
      }}
    >

      <div style={{ flex: 1 }}>

        <div
          style={{
            fontWeight: "bold",
            fontSize: 30
          }}
        >

          {viajeData.driverNombre?.split("@")[0]}

          <span
            style={{
              marginLeft: 8,
              color: "#f1c40f"
            }}
          >
            ★ {viajeData.driverRating || "5.0"}
          </span>

        </div>

        <div
          style={{
            fontSize: 13,
            color: "#666",
            marginTop: 2
          }}
        >

          {viajeData.driverCarro?.marca}
          {" "}
          {viajeData.driverCarro?.modelo}

          {" • "}

          <span
            style={{
              color: "#000",
              fontWeight: "600"
            }}
          >
            {viajeData.driverCarro?.placa}
          </span>

        </div>

      </div>

      <div
        style={{
          textAlign: "right",
          fontSize: 12,
          color:
            viajeData.driverCarro?.color === "Blanco"
              ? "#999"
              : viajeData.driverCarro?.color
        }}
      >
        {viajeData.driverCarro?.color}
      </div>

    </div>
  )}
 {/* CALL DRIVER */}
{(fase === "aceptado" || fase === "pickup") &&
  viajeData?.driverTelefono && (

  <div
    style={{

      position: "absolute",

      right: 16,

      top: -26,

      zIndex: 50
    }}
  >

    <a
      href={`tel:${viajeData.driverTelefono}`}

      onMouseDown={(e) => {

        e.currentTarget.style.transform =
          "scale(0.90)";
      }}

      onMouseUp={(e) => {

        e.currentTarget.style.transform =
          "scale(1)";
      }}

      onMouseLeave={(e) => {

        e.currentTarget.style.transform =
          "scale(1)";
      }}

      style={{

        width: 62,

        height: 62,

        borderRadius: "50%",

        background:
          "linear-gradient(145deg,#1fd15a,#12a846)",

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        textDecoration: "none",

        boxShadow:
          "0 10px 25px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.25)",

        border:
          "2px solid rgba(255,255,255,0.25)",

        transition:
          "all 0.15s ease",

        transform:
          "scale(1)",

        userSelect: "none",

        WebkitTapHighlightColor:
          "transparent"
      }}
    >

      <span
        style={{
          fontSize: 28,

          filter:
            "drop-shadow(0 2px 2px rgba(0,0,0,0.35))"
        }}
      >
        📞
      </span>

    </a>

  </div>
)}

 <h3 style={{ margin: 0, fontSize: 18 }}>
  {fase === "pendiente" && "🔍 Looking for nearby drivers...."} {/* 👈 AÑADE ESTO */}
  {fase === "aceptado" && "✅ Your ride was accepted"}
  {fase === "pickup" && "🚗 Driver on the way"}
  {fase === "viaje" && "✨ Ride in progress"}
</h3>

{/* ETA / STATUS */}


{(fase === "pickup" || fase === "viaje") && (
  <p style={{ fontSize: 22, fontWeight: "bold", color: "#1976FF", margin: "4px 0" }}>
    {viajeData?.driverEta || "Calculating..."}
  </p>
)}

  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
    {viajeData?.metodoPago === "stripe" ? (
      <span style={{ color: "#28a745", fontWeight: "600" }}>💳 Paid: ${viajeData?.precio?.toFixed(2)}</span>
    ) : (
     <span
  style={{
    fontWeight: "700",
    fontSize: "22px"
  }}
>
  💵 Pay the Driver:

  <span
    style={{
      color: "#f70909"
    }}
  >
    $

    {Number(
      viajeData?.precio || 0
    ).toFixed(2)}

  </span>
</span>
    )}
  </div>

 {/* Ahora incluimos 'pendiente' y 'espera' para que siempre pueda cancelar antes del viaje */}
{(fase === "pendiente" || fase === "espera" || fase === "aceptado" || fase === "pickup") && (
  <button
    style={{ ...btn("#000"), marginTop: 20 }}
    onMouseDown={press}
    onMouseUp={release}
    onClick={() => { if(confirm("Do you wish to cancel this ride?")) cancelarViaje(); }}
  >
    Cancel Ride
  </button>
)}
</div>
    </div>
  );
}