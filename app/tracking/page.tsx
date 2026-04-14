"use client";

import { useEffect, useState } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

export default function TrackingPage() {
  const [pos, setPos] = useState<any>(null);

  const loadLocation = async () => {
    try {
      const res = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv");
      const text = await res.text();

      const rows = text.split("\n");
      const last = rows[rows.length - 1].split(",");

      const lat = parseFloat(last[0]);
      const lng = parseFloat(last[1]);

      if (!isNaN(lat) && !isNaN(lng)) {
        setPos({ lat, lng });
      }

    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    loadLocation();

    const interval = setInterval(loadLocation, 5000); // 🔥 cada 5s

    return () => clearInterval(interval);
  }, []);

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
      <div style={{ height: "100vh" }}>
        <GoogleMap
          center={pos || { lat: 36.1699, lng: -115.1398 }}
          zoom={15}
          mapContainerStyle={{ width: "100%", height: "100%" }}
        >
          {pos && <Marker position={pos} />}
        </GoogleMap>
      </div>
    </LoadScript>
  );
}