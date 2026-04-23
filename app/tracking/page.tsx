"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

// ==============================
// PARSER CSV ROBUSTO
// ==============================
const parseCSV = (text: string) => {
  return text
    .split("\n")
    .slice(1)
    .map(row =>
      row
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map(cell => cell.replace(/(^"|"$)/g, "").trim())
    )
    .filter(r => r.length >= 11);
};

// ==============================
// COMPONENTE PRINCIPAL
// ==============================
function TrackingContent() {

  const params = useSearchParams();
  const tripId = params.get("tripId");

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<string>("Loading...");
  const [pickup, setPickup] = useState<string>("");

  useEffect(() => {
    if (!tripId) return;

    let interval: any;

    const fetchData = async () => {
      try {
        const res = await fetch(CSV_URL + "&t=" + Date.now());
        const text = await res.text();

        const rows = parseCSV(text);

        const match = rows.find(r => r[10]?.trim() === tripId.trim());

        if (match) {

          setStatus(match[7]);
          setPickup(match[2]);

          const lat = parseFloat(match[8]);
          const lng = parseFloat(match[9]);

          if (!isNaN(lat) && !isNaN(lng)) {
            setPos({ lat, lng });
          }
        }

      } catch (err) {
        console.error("TRACKING ERROR:", err);
      }
    };

    fetchData();
    interval = setInterval(fetchData, 3000);

    return () => clearInterval(interval);

  }, [tripId]);

  return (
    <div style={container}>

      <h2 style={{ marginBottom: 10 }}>Live Tracking</h2>

      <div style={card}>
        <p><b>Status:</b> {status}</p>
        <p><b>Pickup:</b> {pickup}</p>
      </div>

      {pos ? (
        <div style={mapBox}>
          <p>📍 Driver Location</p>
          <p>{pos.lat}, {pos.lng}</p>
        </div>
      ) : (
        <div style={waiting}>
          Waiting for driver location...
        </div>
      )}

    </div>
  );
}

// ==============================
// WRAPPER OBLIGATORIO (NEXT)
// ==============================
export default function TrackingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Loading tracking...</div>}>
      <TrackingContent />
    </Suspense>
  );
}

// ==============================
// ESTILOS
// ==============================
const container = {
  padding: 15,
  maxWidth: 420,
  margin: "auto",
  background: "#f4f4f4",
  borderRadius: 12
};

const card = {
  background: "#fff",
  padding: 10,
  borderRadius: 10,
  marginBottom: 10,
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
};

const mapBox = {
  background: "#000",
  color: "#fff",
  padding: 15,
  borderRadius: 10,
  textAlign: "center" as const
};

const waiting = {
  padding: 15,
  textAlign: "center" as const,
  color: "#777"
};