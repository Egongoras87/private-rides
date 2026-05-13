"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update, get } from "firebase/database";

import { useJsApiLoader, GoogleMap, Marker, Polyline, DirectionsRenderer } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function UserTrackingPage() {
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
  const refundCheckRef =
  useRef<any>(null);
  const lastCameraMoveRef = useRef(0);
  const [driverInfo, setDriverInfo] = useState<any>(null);
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

              window.location.href =
                `/tracking?id=${key}`;

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


  useEffect(() => {
  if (!viajeData?.driverId) return;

  const driverRef = ref(db, "drivers/" + viajeData.driverId);
  const unsubscribe = onValue(driverRef, (snap) => {
    if (snap.exists()) {
      setDriverInfo(snap.val());
    }
  });

  return () => unsubscribe();
}, [viajeData?.driverId]);
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
// 🔥 AUTO REFUND SI NADIE ACEPTA
// ===================================================

if (
  d.estado === "Pendiente" &&
  d.metodoPago === "stripe" &&
  d.paymentIntentId &&
  !d.refundProcesado
) {

  // 🔒 evitar múltiples timers
  if (!refundCheckRef.current) {

    refundCheckRef.current =
      setInterval(async () => {

        const expirado =

          Date.now() -
          d.timestamp >

          5 * 60 * 1000;

        // ⏳ aún no expira
        if (!expirado) return;

        try {

          console.log(
            "💸 REEMBOLSO AUTOMÁTICO"
          );

          // ===================================================
          // 💳 HACER REFUND
          // ===================================================

          const refundRes =
            await fetch(
              "/api/refund",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body: JSON.stringify({
                  paymentIntentId:
                    d.paymentIntentId
                })
              }
            );

          const refundData =
            await refundRes.json();

          // ❌ FALLÓ REFUND
          if (!refundData.success) {

            console.error(
              "Refund failed"
            );

            return;
          }

          // ===================================================
          // ❌ CANCELAR VIAJE
          // ===================================================

          await update(
            ref(
              db,
              "viajes/" + d.id
            ),
            {
              estado:
                "Cancelado",

              estadoPago:
                "reembolsado",

              pagado: false,

              refundProcesado:
                true,

              canceladoAt:
                Date.now()
            }
          );

          // ===================================================
          // 🧹 LIMPIEZA
          // ===================================================

          clearInterval(
            refundCheckRef.current
          );

          refundCheckRef.current =
            null;

          localStorage.removeItem(
            "viajeId"
          );

          localStorage.removeItem(
            "viajeData"
          );

          // ===================================================
          // 🔔 ALERTA
          // ===================================================

          alert(
            "No drivers available.\nYour payment was refunded."
          );

          // ===================================================
          // 🏠 HOME
          // ===================================================

          window.location.href =
            "/";

        } catch (err) {

          console.error(
            "AUTO REFUND ERROR:",
            err
          );
        }

      }, 15000); // revisar cada 15 segundos
  }
}

    // 1. Verificación de estados finales
    if (d.estado === "Finalizado") {
      setViajeFinalizado(true);
      return;
    }
    if (d.estado === "Cancelado") {
      setViajeCancelado(true);
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

    // 3. NUEVO: Cálculo de ETA Local (Fallback)
const ahora = Date.now();

if (!d.driverEta && d.driverLat && d.origenLat && faseActual === "pickup" && (ahora - lastEtaRequest > 10000)) {
  lastEtaRequest = ahora; 
  const service = new window.google.maps.DirectionsService();

 service.route(
  {
    origin: { lat: Number(d.driverLat), lng: Number(d.driverLng) },
    destination: { lat: Number(d.origenLat), lng: Number(d.origenLng) },
    travelMode: window.google.maps.TravelMode.DRIVING,
  },
  (res: any, status: any) => { // Cambiado a any
    if (status === "OK" && res?.routes?.[0]?.legs?.[0]) {
      setViajeData((prev: any) => ({
        ...prev,
        driverEta: res.routes[0].legs[0].duration?.text || "Calculating...",
      }));
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
      if (mapRef.current && ahora - lastCameraMoveRef.current > 2000) {
        lastCameraMoveRef.current = ahora;
        mapRef.current.panTo(nuevaPos);
      }
    }
  });

  return () => {

  unsubscribe();

  if (refundCheckRef.current) {

    clearInterval(
      refundCheckRef.current
    );

    refundCheckRef.current =
      null;
  }
};
}, [isLoaded]); // Quitamos 'fase' de las dependencias para evitar re-suscripciones innecesarias

  // --- LÓGICA DE CANCELACIÓN (Mantenida de tu código) ---
  const cancelarViaje = async () => {
    try {
      const id = new URLSearchParams(window.location.search).get("id") || localStorage.getItem("viajeId");
      if (!id) return alert("No se encontró el viaje");

      const user = auth.currentUser;
      if (!user) return alert("Debes iniciar sesión");

      const viajeRef = ref(db, "viajes/" + id);
      const snap = await get(viajeRef);
      if (!snap.exists()) return;

      const viaje = snap.val();
      const tiempo = Date.now() - (viaje.timestamp || Date.now());
      const minutos = tiempo / 60000;
      let porcentaje = minutos <= 2 ? 1 : minutos <= 5 ? 0.5 : 0;

      if (viaje.metodoPago === "stripe") {
        const msg = porcentaje === 1 ? "Reembolso completo" : porcentaje === 0.5 ? "Reembolso parcial (50%)" : "Sin reembolso";
        if (!confirm(`Cancelar viaje\n${msg}`)) return;
      }

      // Liberar Driver y actualizar estado
      if (viaje.driverId) {
        await update(ref(db, "drivers/" + viaje.driverId), { viajeActivo: null });
      }

      await update(viajeRef, {
        estado: "Cancelado",
        driverId: null,
        canceladoEn: Date.now()
      });

      if (viaje.metodoPago === "stripe" && viaje.paymentIntentId && porcentaje > 0) {
        const token = await user.getIdToken(true);
        await fetch("/api/refund-cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ viajeId: id, percent: porcentaje }),
        });
      }

      localStorage.removeItem("viajeId");
      window.location.href = "/";
    } catch (err) {
      console.error(err);
    }
  };

  // --- RENDERIZADO DE UI ---
  const btn = (bg: string) => ({
    padding: 12, borderRadius: 10, border: "none", background: bg,
    color: "#fff", cursor: "pointer", boxShadow: "0 4px 0 rgba(0,0,0,0.2)", transition: "0.15s", width: "100%"
  });

  const press = (e: any) => {

  e.currentTarget.style.transform =
    "scale(0.95)";
};

const release = (e: any) => {

  e.currentTarget.style.transform =
    "scale(1)";
};

  if (!isLoaded) return <div style={{ background: "#111", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando mapa...</div>;

  if (viajeCancelado || viajeFinalizado) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#111", color: "#fff", gap: 20 }}>
        <h2>{viajeCancelado ? "❌ Ride canceled" : "✅ Trip completed"}</h2>
        <button style={{ ...btn(viajeCancelado ? "#dc3545" : "#28a745"), width: "auto", padding: "14px 30px" }} onClick={() => window.location.href = "/"}>🔙 Back to Home</button>
      </div>
    );
  }

const vehicleChip = {

  background:
    "#f4f4f4",

  color: "#444",

  padding: "7px 12px",

  borderRadius: 12,

  fontSize: 13,

  fontWeight: 600,

  border:
    "1px solid rgba(0,0,0,0.05)"
};
 return (
  <div
    style={{
      height: "100vh",
      position: "relative",
      background: "#111"
    }}
  >

    <GoogleMap
      onLoad={(map) => {
        mapRef.current = map;
      }}

      mapContainerStyle={{
        width: "100%",
        height: "100%"
      }}

      center={
        pos || {
          lat: Number(
            viajeData?.origenLat || 36.1699
          ),

          lng: Number(
            viajeData?.origenLng || -115.1398
          )
        }
      }

      zoom={17}

      options={{
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "greedy",
        mapId: "c7f305f9e66d61eb57ab057d"
      }}
    >

      {/* Ruta completada */}
      {completedPath.length > 0 && (

        <Polyline
          path={completedPath}

          options={{
            strokeColor: "#888",
            strokeOpacity: 0.5,
            strokeWeight: 3
          }}
        />
      )}

      {/* Ruta restante */}
      {remainingPath.length > 0 && (

        <Polyline
          path={remainingPath}

          options={{
            strokeColor: "#1976FF",
            strokeOpacity: 0.9,
            strokeWeight: 5
          }}
        />
      )}

      {/* Driver marker */}
      {pos && (

        <Marker
          position={pos}

          icon={{

            path:
              "M 0, 0 m -10, 0 a 10,10 0 1,0 20,0 a 10,10 0 1,0 -20,0 M -4,3 L 0,-5 L 4,3 L 0,1 Z",

            fillColor: "#1976FF",

            fillOpacity: 1,

            strokeColor: "#fff",

            strokeWeight: 2,

            scale: 2,

            rotation:
              viajeData?.heading || 0,

            anchor:
              new window.google.maps.Point(
                0,
                0
              )
          }}
        />
      )}

      {/* Destino */}
      {viajeData?.destinoLat && (

        <Marker
          position={{
            lat: Number(
              viajeData.destinoLat
            ),

            lng: Number(
              viajeData.destinoLng
            )
          }}
        />
      )}

    </GoogleMap>
{/* PREMIUM RIDE PANEL */}
<div
  style={{
    position: "absolute",
    bottom: 0,
    width: "100%",

     maxHeight: "34vh",
    overflowY: "auto",
    scrollbarWidth: "none",
    paddingBottom: 30,

    background:
      "linear-gradient(180deg,#ffffff,#f7f7f7)",

    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,

    padding: "6px 8px 8px",

    boxShadow:
      "0 -10px 40px rgba(0,0,0,0.10)",

    borderTop:
      "1px solid rgba(255,255,255,0.9)",

    backdropFilter: "blur(18px)"
  }}
>

  {/* HANDLE */}
  <div
    style={{
      width: 46,
      height: 5,
      borderRadius: 999,
      background: "#d8d8d8",
      margin: "0 auto 18px"
    }}
  />

  {/* STATUS CARD */}
  <div
    style={{
      background: "#fff",

      borderRadius: 24,

      padding: "10px 12px",

      boxShadow:
        "0 8px 24px rgba(0,0,0,0.06)",

      border:
        "1px solid rgba(0,0,0,0.04)"
    }}
  >

    {/* TOP */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}
    >

      <div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1,
            color: "#999"
          }}
        >
          STATUS
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 14,
            fontWeight: 600,
            color: "#111"
          }}
        >

          {fase === "pendiente" &&
            "pending"}

          {fase === "aceptado" &&
            "assigned"}

          {fase === "pickup" &&
            "on_the_way"}

          {fase === "viaje" &&
            "in_progress"}

        </div>

      </div>

     {/* ICON */}
<div
  style={{
    width: 40,
    height: 40,
    borderRadius: 14,

    background:
      fase === "viaje"
        ? "linear-gradient(145deg,#dff8e8,#f4fff7)"
        : "linear-gradient(145deg,#edf5ff,#f8fbff)",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    fontSize: 18,

    boxShadow:
      "0 6px 14px rgba(0,0,0,0.05)"
  }}
>
      
        {fase === "pendiente" && "🔍"}
        {fase === "aceptado" && "✔"}
        {fase === "pickup" && "🚘"}
        {fase === "viaje" && "🚗"}
      </div>

    </div>

    {/* PENDING MESSAGE */}
    {fase === "pendiente" && (

      <div
        style={{
          marginTop: 8,

          padding: "14px 16px",

          borderRadius: 18,

          background:
            "linear-gradient(145deg,#fff8ea,#fffdf7)",

          border:
            "1px solid rgba(255,193,7,0.14)",

          color: "#946200",

          fontWeight: 600,

          fontSize: 15
        }}
      >
        Looking for available driver
      </div>

    )}

  </div>

  {/* DRIVER CARD */}
  {(fase === "aceptado" ||
    fase === "pickup" ||
    fase === "viaje") && (

    <div
      style={{
        marginTop: 6,

        background: "#fff",

        borderRadius: 14,

        padding: "6px 8px",

        boxShadow:
          "0 10px 26px rgba(0,0,0,0.06)",

        border:
          "1px solid rgba(0,0,0,0.04)"
      }}
    >

      {/* DRIVER HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >

        {/* LEFT */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4
          }}
        >

          {/* AVATAR */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",

              background:
                "linear-gradient(145deg,#f2f2f2,#ffffff)",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              fontSize: 16,

              boxShadow:
                "0 6px 18px rgba(0,0,0,0.10)"
            }}
          >
            🚘
          </div>

          {/* INFO */}
          <div>

            {/* NAME */}
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#111"
              }}
            >
              {driverInfo?.nombre?.split("@")[0] ||
                "Driver"}
            </div>

            {/* PREMIUM */}
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "#777",
                fontWeight: 500
              }}
            >
              Premium Service
            </div>

            {/* STARS */}
            <div
              style={{
                marginTop: 5,
                color: "#f1c40f",
                fontWeight: 600,
                fontSize: 15
              }}
            >
              ★★★★★
            </div>

          </div>

        </div>

        {/* CALL */}
        {(fase === "aceptado" ||
          fase === "pickup") && (

          <button

            onMouseDown={press}
            onMouseUp={release}
            onMouseLeave={release}

            onClick={() => {

              if (
                driverInfo?.telefono
              ) {

                window.location.href =
                  `tel:${driverInfo.telefono}`;
              }
            }}

            style={{
  width: 52,
  height: 52,

  borderRadius: 50,

  border:
    "1px solid rgba(255,255,255,0.25)",

  background:
    "linear-gradient(145deg,#34d058,#1faa43)",

  color: "#fff",

  fontSize: 22,

  cursor: "pointer",

 boxShadow:
  "0 8px 18px rgba(52,208,88,0.28)",

  transition:
    "all 0.12s ease"
}}
          >
            📞
          </button>

        )}

      </div>

      {/* VEHICLE */}
      <div
        style={{
          marginTop: 8,

          display: "flex",
          flexWrap: "wrap",

          gap: 4
        }}
      >

        <div style={vehicleChip}>
          {driverInfo?.carro?.marca}
        </div>

        <div style={vehicleChip}>
          {driverInfo?.carro?.modelo}
        </div>

        <div style={vehicleChip}>
          {driverInfo?.carro?.color}
        </div>

        <div
          style={{
            ...vehicleChip,

            background: "#111",
            color: "#fff",
            fontWeight: 600,
            letterSpacing: 1
          }}
        >
          {driverInfo?.carro?.placa}
        </div>

      </div>

    </div>

  )}

  {/* ETA + PAYMENT */}
  <div
    style={{
      marginTop: 8,

      display: "flex",

      gap: 4
    }}
  >

    {/* ETA */}
    {(fase === "pickup" ||
      fase === "viaje") && (

      <div
        style={{
          flex: 1,

          background:
            "linear-gradient(145deg,#edf5ff,#f8fbff)",

          borderRadius: 24,

          padding: "8px",

          border:
            "1px solid rgba(25,118,255,0.10)",

          boxShadow:
            "0 10px 20px rgba(25,118,255,0.08)"
        }}
      >

        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1,
            color: "#1976FF",
            marginBottom: 6
          }}
        >

          {fase === "pickup"
            ? "PICKUP ETA"
            : "DESTINATION ETA"}

        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111"
          }}
        >
          {viajeData?.driverEta ||
            "1 min"}
        </div>

      </div>

    )}

    {/* PAYMENT */}
    <div
      style={{
        flex: 1,

        background:
          viajeData?.metodoPago ===
          "stripe"

            ? "linear-gradient(145deg,#eefbf2,#f8fff9)"

            : "linear-gradient(145deg,#fff5f5,#fffafa)",

        borderRadius: 24,

        padding: "8px",

        border:
          viajeData?.metodoPago ===
          "stripe"

            ? "1px solid rgba(69,212,131,0.12)"

            : "1px solid rgba(255,90,90,0.12)",

        boxShadow:
          viajeData?.metodoPago ===
          "stripe"

            ? "0 10px 20px rgba(69,212,131,0.08)"

            : "0 10px 20px rgba(255,90,90,0.08)"
      }}
    >

      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1,

          color:
            viajeData?.metodoPago ===
            "stripe"

              ? "#28a745"

              : "#ff4d4d",

          marginBottom: 6
        }}
      >

        {viajeData?.metodoPago ===
        "stripe"

          ? "PAID"

          : "PAY THE DRIVER"}

      </div>

      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "#111"
        }}
      >
        $
        {viajeData?.precio?.toFixed(
          2
        )}
      </div>

    </div>

  </div>

  {/* CANCEL BUTTON */}
  {(fase === "pendiente" ||
    fase === "aceptado" ||
    fase === "pickup") && (

    <button

      onMouseDown={press}
      onMouseUp={release}
      onMouseLeave={release}

      onClick={() => {

        if (
          confirm(
            "Do you want to cancel this ride?"
          )
        ) {

          cancelarViaje();
        }
      }}

      style={{
        width: "100%",

        marginTop: 8,

        padding: "10px",

        border: "none",

        borderRadius: 24,

        background:
          "linear-gradient(145deg,#ff6666,#ff2e2e)",

        color: "#fff",

        fontSize: 16,

        fontWeight: 800,

        cursor: "pointer",

        boxShadow:
          "0 8px 0 #d92323, 0 16px 26px rgba(255,80,80,0.22)",

        transition:
          "all 0.15s ease"
      }}
    >
      Cancel Ride
    </button>

  )}

</div>
</div>/////////////////////////////////
  
  );
}