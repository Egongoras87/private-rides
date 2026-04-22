"use client";

import { useEffect, useState, Suspense } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { useSearchParams } from "next/navigation";

function TrackingContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [rideData, setRideData] = useState<any>(null);
  const [map, setMap] = useState<any>(null);

  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

  useEffect(() => {
    if (!tripId) return;

    const fetchLocation = async () => {
  try {

    const res = await fetch(CSV_URL, { cache: "no-store" });
    const text = await res.text();

    const rows = text
      .split("\n")
      .slice(1)
      .map(r => r.split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/).map(c => c.replace(/(^\"|\"$)/g, "").trim()))
      .filter(r => r.length >= 11);

    const match = rows.find(r => r[10]?.trim() === tripId?.trim());

    // ✅ AHORA SÍ
    console.log("TRIP BUSCADO:", tripId);
    console.log("FILAS:", rows.length);
    console.log("MATCH:", match);

    if (match) {
      setRideData({
        name: match[0],
        status: match[7],
        pickup: match[2],
        dropoff: match[3]
      });

      const lat = parseFloat(match[8]);
      const lng = parseFloat(match[9]);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {

        setPos({ lat, lng });

        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(16);
        }
      }
    }

  } catch (e) {
    console.error("Error obteniendo ubicación:", e);
  }
};

    fetchLocation();
    const interval = setInterval(fetchLocation, 3000); // Actualiza cada 3 segundos
    return () => clearInterval(interval);
  }, [tripId, map]);

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative", background: "#000" }}>
      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
        <GoogleMap
          center={pos || { lat: 36.1699, lng: -115.1398 }}
          zoom={16}
          onLoad={m => setMap(m)}
          options={{ disableDefaultUI: true, styles: mapDarkStyle }}
          mapContainerStyle={{ width: "100%", height: "100%" }}
        >
          {pos && (
            <Marker
              position={pos}
              icon={{
                url: "https://cdn-icons-png.flaticon.com/512/2643/2643441.png", // Icono de coche premium
                scaledSize: new window.google.maps.Size(45, 45),
                anchor: new window.google.maps.Point(22, 22)
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>

      {/* PANEL FLOTANTE DE INFORMACIÓN (UBER STYLE) */}
      <div style={statusPanel}>
        {!rideData ? (
          <p style={{ margin: 0, textAlign: 'center' }}>Buscando tu viaje...</p>
        ) : (
          <>
            <div style={headerRow}>
              <span style={statusText}>
                {rideData.status === "En camino" ? "🚕 TU CONDUCTOR VA HACIA TI" : "⏳ PROCESANDO VIAJE"}
              </span>
              <div style={pulseDot}></div>
            </div>
            <p style={addressLabel}>📍 {rideData.pickup}</p>
            <div style={divider}></div>
            <p style={footerNote}>Mantén esta ventana abierta para ver el seguimiento en vivo.</p>
          </>
        )}
      </div>
    </div>
  );
}

// Layout de seguridad para parámetros de búsqueda en Next.js
export default function TrackingPage() {
  return (
    <Suspense fallback={<div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando Mapa...</div>}>
      <TrackingContent />
    </Suspense>
  );
}

// --- ESTILOS ---
const statusPanel = {
  position: "absolute" as const, bottom: 30, left: "5%", width: "90%",
  background: "white", padding: "20px", borderRadius: "20px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.3)", color: "#000", zIndex: 10
};

const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 };
const statusText = { fontWeight: "bold", fontSize: 14, color: "#000", letterSpacing: "0.5px" };
const pulseDot = { width: 10, height: 10, background: "#27ae60", borderRadius: "50%", boxShadow: "0 0 10px #27ae60" };
const addressLabel = { fontSize: 13, color: "#444", margin: "5px 0" };
const divider = { height: "1px", background: "#eee", margin: "12px 0" };
const footerNote = { fontSize: 11, color: "#999", textAlign: "center" as const };

const mapDarkStyle = [
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
];