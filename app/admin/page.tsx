"use client";

import { useEffect, useState } from "react";

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

export default function AdminPage() {

  const [rides, setRides] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const res = await fetch(CSV_URL + "&t=" + Date.now());
      const text = await res.text();

      const rows = text
        .split("\n")
        .slice(1)
        .map(r => r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/))
        .map(r => r.map(c => c.replace(/(^"|"$)/g, "").trim()));

      setRides(rows.reverse());

    } catch (err) {
      console.error("ADMIN ERROR:", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (tripId: string, status: string) => {

    await fetch("/api/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updateStatus: true,
        tripId,
        status
      })
    });

    loadData();
  };

  return (
    <div style={{ padding: 20 }}>

      <h2>Admin Panel</h2>

      {rides.map((r, i) => (
        <div key={i} style={card}>

          <p><b>{r[0]}</b> ({r[1]})</p>
          <p>{r[2]} → {r[3]}</p>
          <p>Status: {r[7]}</p>
          <p>Trip ID: {r[10]}</p>

          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => updateStatus(r[10], "Pending")}>Pending</button>
            <button onClick={() => updateStatus(r[10], "On the way")}>On the way</button>
            <button onClick={() => updateStatus(r[10], "Completed")}>Done</button>
          </div>

        </div>
      ))}

    </div>
  );
}

const card = {
  border: "1px solid #ccc",
  padding: 10,
  marginBottom: 10,
  borderRadius: 10
};