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
  const lastCameraMoveRef = useRef(0);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);

  // Redirección si no hay sesión
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) window.location.href = "/login-user";
    });
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

  const unsubscribe = onValue(viajeRef, (snap) => {
    const d = snap.val();
    if (!d) return;

    setViajeData(d);

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
if (faseActual === "viaje" && d.destinoLat && !d.remainingPath) {
  const ds = new google.maps.DirectionsService();
  ds.route({
    origin: { lat: Number(d.driverLat), lng: Number(d.driverLng) },
    destination: { lat: Number(d.destinoLat), lng: Number(d.destinoLng) },
    travelMode: google.maps.TravelMode.DRIVING
  }, (result: any, status: any) => { // Usamos any para evitar el conflicto de tipos
    if (status === "OK") {
      setDirectionsResponse(result);
    }
  });
}

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

  return () => unsubscribe();
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

  const press = (e: any) => { e.target.style.transform = "scale(0.95)"; };
  const release = (e: any) => { e.target.style.transform = "scale(1)"; };

  if (!isLoaded) return <div style={{ background: "#111", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando mapa...</div>;

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
<div style={{ position: "absolute", bottom: 0, width: "100%", background: "#fff", padding: "24px 20px", borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: "0 -5px 20px rgba(0,0,0,0.1)" }}>
  
  {/* NUEVA LÍNEA: DATOS DEL CONDUCTOR */}
  {driverInfo && (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: "bold", fontSize: 30 }}>
          {driverInfo.nombre?.split('@')[0]} {/* Muestra el nombre antes del @ */}
          <span style={{ marginLeft: 8, color: "#f1c40f" }}>★ {driverInfo.rating || "5.0"}</span>
        </div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
          {driverInfo.carro?.marca} {driverInfo.carro?.modelo} • <span style={{ color: "#000", fontWeight: "600" }}>{driverInfo.carro?.placa}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 12, color: driverInfo.carro?.color === "Blanco" ? "#999" : driverInfo.carro?.color }}>
        {driverInfo.carro?.color}
      </div>
    </div>
  )}

 <h3 style={{ margin: 0, fontSize: 18 }}>
  {fase === "pendiente" && "🔍 Looking for a driver..."} {/* 👈 AÑADE ESTO */}
  {fase === "aceptado" && "✅ Your ride was accepted"}
  {fase === "pickup" && "🚗 Driver on the way"}
  {fase === "viaje" && "✨ Ride in progress"}
</h3>

{/* Ajuste de lógica de ETA */}
{fase === "pendiente" || fase === "aceptado" ? (
  <p style={{ fontSize: 16, color: "#666", margin: "8px 0" }}>
    Waiting for driver to confirm...
  </p>
) : (
  <p style={{ fontSize: 22, fontWeight: "bold", color: "#1976FF", margin: "4px 0" }}>
    {viajeData?.driverEta || "Calculating..."}
  </p>
)}

  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
    {viajeData?.metodoPago === "stripe" ? (
      <span style={{ color: "#28a745", fontWeight: "600" }}>💳 Paid: ${viajeData?.precio?.toFixed(2)}</span>
    ) : (
      <span style={{ fontWeight: "700", fontSize: "22px" }}>
  💵 Pay the Driver: <span style={{ color: "#f70909" }}>${viajeData?.precio?.toFixed(2)}</span>
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