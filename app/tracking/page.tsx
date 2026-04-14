"use client";

import { useEffect, useState } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

export default function Tracking() {
  const [pos, setPos] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("TU_CSV_URL")
        .then(res => res.text())
        .then(text => {
          const rows = text.split("\n");

          if (rows.length < 2) return;

          const last = rows[rows.length - 2];

          const cols = last.split(",");

          const lat = Number(cols[8]);
          const lng = Number(cols[9]);

          if (!isNaN(lat) && !isNaN(lng)) {
            setPos({ lat, lng });
          }
        });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
      <GoogleMap
        center={pos || { lat: 36.1699, lng: -115.1398 }}
        zoom={15}
        mapContainerStyle={{ width: "100%", height: "100vh" }}
      >
        {pos && <Marker position={pos} />}
      </GoogleMap>
    </LoadScript>
  );
}