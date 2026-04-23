"use client";

import { useEffect, useState } from "react";

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

export default function DriverPage() {
  const [rides, setRides] = useState<any[]>([]);

  const load = async () => {
    const res = await fetch(CSV_URL + "&t=" + Date.now());
    const text = await res.text();

    const rows = text.split("\n").slice(1).map(r => r.split(","));
    setRides(rows.filter(r => r[7] !== "Completed" && r[7] !== "Canceled"));
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, []);

  const startRide = (tripId: string, phone: string, pickup: string) => {
    // status
    fetch("/api/rides", {
      method: "POST",
      body: JSON.stringify({
        updateStatus: true,
        tripId,
        status: "On the way"
      })
    });

    // gps tracking
    navigator.geolocation.watchPosition((pos) => {
      fetch("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          updateLocation: true,
          tripId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        })
      });
    });

    // navigation
    window.open(`https://www.google.com/maps/dir/?destination=${encodeURIComponent(pickup)}`);

    // notify client
    window.open(`https://wa.me/1${phone}?text=Driver on the way`);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Driver Panel</h2>

      {rides.map((r, i) => (
        <div key={i} style={{ marginBottom: 15, border: "1px solid #ccc", padding: 10 }}>
          <p><b>{r[0]}</b></p>
          <p>{r[2]} → {r[3]}</p>
          <button onClick={() => startRide(r[10], r[1], r[2])}>
            Start Ride
          </button>
        </div>
      ))}
    </div>
  );
}