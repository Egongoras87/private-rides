"use client";

import { useEffect, useState } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

export default function Tracking() {

  const [pos, setPos] = useState<any>(null);
  const [map, setMap] = useState<any>(null);

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

  useEffect(() => {

    const interval = setInterval(async () => {
      try {
        const res = await fetch(CSV_URL);
        const text = await res.text();

        const rows = text
          .split("\n")
          .slice(1)
          .map(r =>
            r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
              .map(c => c.replace(/(^"|"$)/g, "").trim())
          )
          .filter(r => r.length >= 10);

        // 🔥 FILTRAR SOLO LOS QUE TIENEN GPS
        const valid = rows.filter(r => r[8] && r[9]);

        if (valid.length === 0) return;

        // 🔥 TOMAR EL MÁS RECIENTE REAL
        const last = valid[valid.length - 1];

        const lat = Number(last[8]);
        const lng = Number(last[9]);

        if (!isNaN(lat) && !isNaN(lng)) {
          const newPos = { lat, lng };

          setPos(newPos);

          // 🔥 MOVER MAPA AUTOMÁTICAMENTE (tipo Uber)
          if (map) {
            map.panTo(newPos);
          }
        }

      } catch (e) {
        console.error("Tracking error:", e);
      }
    }, 3000);

    return () => clearInterval(interval);

  }, [map]);

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
      <GoogleMap
        center={pos || { lat: 36.1699, lng: -115.1398 }}
        zoom={15}
        onLoad={(m) => setMap(m)}
        mapContainerStyle={{ width: "100%", height: "100vh" }}
      >
        {pos && (
          <Marker
            position={pos}
            icon={{
              url: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
              scaledSize: new window.google.maps.Size(50, 50),
            }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
}