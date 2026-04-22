"use client";

import { useState, useRef, useEffect } from "react";
import {
  GoogleMap,
  LoadScript,
  DirectionsRenderer
} from "@react-google-maps/api";

const libraries: ("places")[] = ["places"];

export default function Page() {

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwITBSQxYqzLaM1Oa3uHQgpBq1cNV0k_szAZYv-yaOcgY6x_rk7AdY_SiNrHI4C_EdKpg/exec";
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [directions, setDirections] = useState<any>(null);
  const [rideStatus, setRideStatus] = useState("Pendiente");
  const [isLoaded, setIsLoaded] = useState(false);

  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);

  const cleanPhone = (p: string) => p.replace(/\D/g, "");

  // 🔥 EFECTO BOTÓN
  const pressIn = (e: any) => {
    e.currentTarget.style.transform = "scale(0.95)";
  };
  const pressOut = (e: any) => {
    e.currentTarget.style.transform = "scale(1)";
  };

  // 💾 LOCAL STORAGE
  useEffect(() => {
    const saved = localStorage.getItem("rideData");
    if (saved) {
      const data = JSON.parse(saved);
      setName(data.name || "");
      setPhone(data.phone || "");
      setPickup(data.pickup || "");
      setDropoff(data.dropoff || "");
      setPrice(data.price || null);
      setDistance(data.distance || null);
      setDateTime(data.dateTime || "");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("rideData", JSON.stringify({
      name, phone, pickup, dropoff, price, distance, dateTime
    }));
  }, [name, phone, pickup, dropoff, price, distance, dateTime]);

  // 🔄 STATUS
  useEffect(() => {
    if (!phone) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(CSV_URL);
        const text = await res.text();
        const rows = text.split("\n").slice(1).map(r => r.split(","));
        const ride = rows.find(r => r[1] === cleanPhone(phone));
        if (ride) setRideStatus(ride[7]);
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [phone]);

  // 📍 AUTOCOMPLETE
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    const a1 = new window.google.maps.places.Autocomplete(pickupRef.current!);
    const a2 = new window.google.maps.places.Autocomplete(dropoffRef.current!);

    a1.addListener("place_changed", () => {
      const p = a1.getPlace();
      if (p.formatted_address) setPickup(p.formatted_address);
    });

    a2.addListener("place_changed", () => {
      const p = a2.getPlace();
      if (p.formatted_address) setDropoff(p.formatted_address);
    });

  }, [isLoaded]);

  // 🚗 CALCULAR
  const calculateRoute = async () => {
    if (!pickup || !dropoff || !window.google) return;

    const service = new window.google.maps.DirectionsService();

    service.route({
      origin: pickup,
      destination: dropoff,
      travelMode: window.google.maps.TravelMode.DRIVING
    }, (res, status) => {
      if (status === "OK") {
        const r = res!.routes[0].legs[0];
        const miles = r.distance!.value / 1609;
        const minutes = r.duration!.value / 60;

        setDistance(+miles.toFixed(2));
        setPrice(+(10 + miles * 1.5 + minutes * 0.5).toFixed(2));
        setDirections(res);
      }
    });
  };

  // 📍 GPS
  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const geocoder = new window.google.maps.Geocoder();
      const res = await geocoder.geocode({
        location: { lat: pos.coords.latitude, lng: pos.coords.longitude }
      });
      if (res.results?.[0]) setPickup(res.results[0].formatted_address);
    });
  };

  // 🚀 CONFIRMAR
  const confirmRide = async () => {

    if (!price) return alert("Calculate fare first");

    if (!name || !phone || !pickup || !dropoff || !dateTime) {
      return alert("Complete all fields");
    }

    const tripId = "TRIP-" + Date.now();

    const formData = new FormData();
    formData.append("tripId", tripId);
    formData.append("name", name);
    formData.append("phone", cleanPhone(phone));
    formData.append("pickup", pickup);
    formData.append("dropoff", dropoff);
    formData.append("price", String(price));
    formData.append("distance", String(distance || 0));
    formData.append("dateTime", new Date(dateTime).toISOString());

    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: formData
    });

    // ADMIN
    window.open(`https://wa.me/17252876197?text=${encodeURIComponent(
      `🚗 New Ride\n👤 ${name}\n📞 ${phone}`
    )}`);

    // CLIENTE
    const link = `${window.location.origin}/tracking?tripId=${tripId}`;
    window.open(`https://wa.me/1${cleanPhone(phone)}?text=${encodeURIComponent(
      `🚗 Ride Confirmed\n📍 ${link}`
    )}`);

    localStorage.setItem("tripId", tripId);
  };

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""} libraries={libraries} onLoad={() => setIsLoaded(true)}>

      <GoogleMap
        center={{ lat: 36.1699, lng: -115.1398 }}
        zoom={13}
        mapContainerStyle={{ width: "100%", height: "100vh" }}
      >
        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>

      <div style={panel}>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={input} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={input} />
        <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} style={input} />

        <div style={{ display: "flex", gap: 5 }}>
          <input ref={pickupRef} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup" style={{ ...input, flex: 1 }} />
          <button style={btnGPS} onClick={getCurrentLocation}>📍</button>
        </div>

        <input ref={dropoffRef} value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Dropoff" style={input} />

        <button style={btnMain} onClick={calculateRoute}>Calculate</button>

        {price && (
          <>
            <h3>💰 ${price} • {distance} mi</h3>

            <div style={row}>
              <button style={btnZelle}>Zelle</button>
              <button style={btnPaypal}>PayPal</button>
              <button style={btnVenmo}>Venmo</button>
            </div>

            <div style={row}>
              <button style={btnConfirm} onClick={confirmRide}>Confirm</button>
              <button style={btnCancel}>Cancel</button>
            </div>
          </>
        )}

      </div>

    </LoadScript>
  );
}

// 🎨 UI
const panel = {
  position: "absolute" as const,
  bottom: 0,
  width: "100%",
  background: "#fff",
  padding: 12,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20
};

const input = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ccc",
  marginBottom: 6
};

const row = {
  display: "flex",
  gap: 6,
  marginTop: 6
};

const btnMain = {
  width: "100%",
  padding: 12,
  background: "#000",
  color: "#fff",
  borderRadius: 10
};

const btnGPS = {
  padding: 10,
  background: "#000",
  color: "#fff",
  borderRadius: 10
};

const btnZelle = { flex: 1, background: "#6d1ed1", color: "#fff", padding: 10, borderRadius: 10 };
const btnPaypal = { flex: 1, background: "#003087", color: "#fff", padding: 10, borderRadius: 10 };
const btnVenmo = { flex: 1, background: "#3d95ce", color: "#fff", padding: 10, borderRadius: 10 };

const btnConfirm = { flex: 1, background: "#27ae60", color: "#fff", padding: 10, borderRadius: 10 };
const btnCancel = { flex: 1, background: "#e74c3c", color: "#fff", padding: 10, borderRadius: 10 };