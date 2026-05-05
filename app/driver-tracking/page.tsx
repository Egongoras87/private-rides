"use client";
export const dynamic = "force-dynamic";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { useJsApiLoader, GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";

export default function DriverTrackingPage() {
  const [viajeData, setViajeData] = useState<any>(null);
  const [pos, setPos] = useState<any>(null);
  const [path, setPath] = useState<any[]>([]);
  const [eta, setEta] = useState(0);
  const [fase, setFase] = useState("pickup");
  const [viajeFinalizado, setViajeFinalizado] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [destinoMarker, setDestinoMarker] = useState<any>(null);

  const mapRef = useRef<any>(null);
  const watchRef = useRef<any>(null);
  const lastHeadingRef = useRef(0);
  const lastRouteTimeRef = useRef(0);
  const lastInstructionRef = useRef("");
  const directionsServiceRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader(googleMapsConfig);

  // --- 1. UTILIDADES ---
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = "es-ES";
    msg.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  };

  const calcularDistancia = (a: any, b: any) => {
    const R = 3958.8;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  // --- 2. AUTH & PULSE ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { if (!user) window.location.href = "/login"; });
    const interval = setInterval(() => setPulse((p) => (p > 10 ? 0 : p + 0.5)), 60);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  // --- 3. FIREBASE: SOLO ESTADO ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    const viajeRef = ref(db, "viajes/" + id);
    const unsubscribe = onValue(viajeRef, (snap) => {
      const d = snap.val();
      if (!d) return;

      setViajeData(d);
      setFase(d.estado === "En viaje" ? "viaje" : "pickup");

      if (d.estado === "Finalizado" || d.estado === "Cancelado") {
        if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
        setViajeFinalizado(true);
        if (d.estado === "Cancelado") {
            alert("Viaje cancelado");
            window.location.replace("/driver");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // --- 4. GPS & CÁMARA & RUTAS (EL MOTOR) ---
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("id");

    if (!directionsServiceRef.current) {
        directionsServiceRef.current = new window.google.maps.DirectionsService();
    }

    watchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const nuevaPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // A. MOVER MARKER (UI Instantánea)
        setPos((prev: any) => {
          if (!prev) return nuevaPos;
          return {
            lat: prev.lat + (nuevaPos.lat - prev.lat) * 0.4,
            lng: prev.lng + (nuevaPos.lng - prev.lng) * 0.4
          };
        });

        // B. FIREBASE UPDATE (Throttle interno)
        const uid = auth.currentUser?.uid;
        if (uid) {
            update(ref(db, "drivers/" + uid), { ...nuevaPos, lastSeen: Date.now() });
            // API para el cliente
            fetch("/api/update-driver-location", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + await auth.currentUser?.getIdToken() },
                body: JSON.stringify({ viajeId: id, ...nuevaPos })
            }).catch(() => {});
        }

        // C. CÁMARA TIPO UBER (Animación suave)
        if (mapRef.current) {
            const heading = position.coords.heading ?? lastHeadingRef.current;
            if (heading !== null) {
                let diff = heading - lastHeadingRef.current;
                diff = ((diff + 540) % 360) - 180;
                lastHeadingRef.current += diff * 0.2;

                mapRef.current.moveCamera({
                    center: nuevaPos,
                    heading: lastHeadingRef.current,
                    tilt: 65,
                    zoom: 18
                });
            }
        }

        // D. RUTA CADA 8 SEGUNDOS
        const now = Date.now();
        if (now - lastRouteTimeRef.current > 8000 && viajeData) {
            const target = viajeData.estado === "En camino" 
                ? { lat: Number(viajeData.origenLat), lng: Number(viajeData.origenLng) }
                : { lat: Number(viajeData.destinoLat), lng: Number(viajeData.destinoLng) };

            directionsServiceRef.current.route({
                origin: nuevaPos,
                destination: target,
                travelMode: google.maps.TravelMode.DRIVING
            }, (res: any, status: any) => {
                if (status === "OK") {
                    const leg = res.routes[0].legs[0];
                    setEta(leg.duration.value);
                    setPath(res.routes[0].overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() })));
                    setDestinoMarker(target);

                    // E. VOZ (Solo acciones de giro)
                    const step = leg.steps[0];
                    const rawInstruction = step.instructions.replace(/<[^>]+>/g, "").trim();
                    
                    // Solo hablar si la instrucción cambia y estamos cerca de la acción
                    if (rawInstruction !== lastInstructionRef.current && step.distance.value < 50) {
                        lastInstructionRef.current = rawInstruction;
                        speak(rawInstruction);
                    }
                }
            });
            lastRouteTimeRef.current = now;
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, [isLoaded, viajeData?.estado]); // Se reinicia si cambia el estado del viaje

  // --- 5. FUNCIONES DE BOTONES (SIN TOCAR LÓGICA DE NEGOCIO) ---
  const finalizar = async (id: string) => {
    try {
      const user = auth.currentUser;
      if (!user || !viajeData) return;

      // 📍 VALIDACIÓN DE CERCANÍA AL DESTINO
      if (pos && viajeData.destinoLat && viajeData.destinoLng) {
        const dist = calcularDistancia(
          { lat: pos.lat, lng: pos.lng },
          { lat: Number(viajeData.destinoLat), lng: Number(viajeData.destinoLng) }
        );

        // Si la distancia es mayor a 0.12 millas (aprox 200 metros)
        if (dist > 0.12) {
          const confirmar = window.confirm(
            "⚠️ No pareces estar en el destino todavía.\n\n¿Estás seguro de que quieres finalizar el viaje ahora?"
          );
          if (!confirmar) return; // El driver canceló la acción
        }
      }

      const token = await user.getIdToken();
      const res = await fetch("/api/finalizar-viaje", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: "Bearer " + token 
        },
        body: JSON.stringify({ viajeId: id })
      });

      if (res.ok) {
        if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
        window.location.href = "/driver";
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Error al finalizar el viaje");
      }
    } catch (err) { 
      console.error("Error en finalizar:", err);
      alert("Ocurrió un error inesperado.");
    }
  };

  const cancelar = async () => {
    if (loadingCancel) return;
    setLoadingCancel(true);
    try {
      const id = new URLSearchParams(window.location.search).get("id");
      const user = auth.currentUser;
      if (!user || !id) return;
      const token = await user.getIdToken();
      const res = await fetch("/api/cancelar-viaje-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ viajeId: id })
      });
      if (res.ok) window.location.replace("/driver");
    } catch (error) { console.error(error); } finally { setLoadingCancel(false); }
  };

  // --- RENDER ---
  const btn = (bg: string) => ({
    padding: 9, borderRadius: 9, fontSize: 10, fontWeight: "bold", border: "none",
    background: bg, color: "#fff", cursor: "pointer", boxShadow: "0 4px 0 rgba(0,0,0,0.2)", transition: "0.15s"
  });

  const press = (e: any) => { e.currentTarget.style.transform = "scale(0.95)"; e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.2)"; };
  const release = (e: any) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 0 rgba(0,0,0,0.2)"; };
const handleLoad = (map: any) => {
  mapRef.current = map;
};


  if (!isLoaded) return <div>Cargando mapa...</div>;
  if (viajeFinalizado) return <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#111", color: "#fff" }}><h1>Viaje Terminado</h1><button onClick={() => window.location.href = "/driver"}>Volver</button></div>;

  return (
     <div style={{ height: "100vh", position: "relative" }}>
    <GoogleMap
  onLoad={handleLoad}
  mapContainerStyle={{ width: "100%", height: "100%" }}
  center={pos || { lat: 36.11, lng: -115.22 }}
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
      <div style={{ position: "absolute", bottom: 0, width: "100%", background: "#fff", padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, boxShadow: "0 -2px 10px rgba(0,0,0,0.1)" }}>
        {viajeData?.metodoPago === "cash" && !viajeData?.pagado && (
          <div style={{ background: "#ff0000", color: "#fff", padding: 10, borderRadius: 10, marginBottom: 10, textAlign: "center", fontWeight: "bold" }}>
            💵 COBRAR EN EFECTIVO
            </div>
        )}
        <h3>{fase === "pickup" ? "🚗 Buscando al cliente" : "🚗 En curso al destino"}</h3>
        <p style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{eta > 0 ? Math.ceil(eta / 60) + " min" : "Calculando..."}</p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
           style={btn("#007bff")} onMouseDown={press} onMouseUp={release} onClick={() => finalizar(viajeData.id)}>✅ Finalizar</button>
          <button
           style={btn("#dc3545")} onMouseDown={press} onMouseUp={release} onClick={cancelar}>❌ Cancelar</button>
          
          {fase === "pickup" && (
            <button style={btn("#ffc107")} onMouseDown={press} onMouseUp={release} onClick={async () => {
                const token = await auth.currentUser?.getIdToken();
                await fetch("/api/en-viaje", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ viajeId: viajeData.id }) });
                window.speechSynthesis.resume();
            }}>📍 Recoger</button>
          )}

          <button style={btn("#25D366")} onClick={() => {
              const tel = "1" + String(viajeData.telefono).replace(/\D/g, "");
              window.open(`https://wa.me/${tel}?text=Estoy fuera`, "_blank");
          }}>💬 WhatsApp</button>
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