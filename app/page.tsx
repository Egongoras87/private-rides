"use client";

import { useState, useRef, useEffect } from "react";
import {
  GoogleMap,
  LoadScript,
  DirectionsRenderer,
  Marker
} from "@react-google-maps/api";

const libraries: ("places")[] = ["places"];

export default function Page() {

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [directions, setDirections] = useState<any>(null);

  const [drivers, setDrivers] = useState<any[]>([]);
  const [eta, setEta] = useState<number | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);

  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwITBSQxYqzLaM1Oa3uHQgpBq1cNV0k_szAZYv-yaOcgY6x_rk7AdY_SiNrHI4C_EdKpg/exec";
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv";

  const handleLoad = () => setIsLoaded(true);

  // 🔥 AUTOCOMPLETE SEGURO
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    if (pickupRef.current) {
      const auto1 = new window.google.maps.places.Autocomplete(pickupRef.current);
      auto1.addListener("place_changed", () => {
        const place = auto1.getPlace();
        if (place?.formatted_address) setPickup(place.formatted_address);
      });
    }

    if (dropoffRef.current) {
      const auto2 = new window.google.maps.places.Autocomplete(dropoffRef.current);
      auto2.addListener("place_changed", () => {
        const place = auto2.getPlace();
        if (place?.formatted_address) setDropoff(place.formatted_address);
      });
    }
  }, [isLoaded]);

  // 📍 UBICACIÓN SEGURA
  const getCurrentLocation = () => {
    if (!navigator.geolocation || !window.google) {
      alert("GPS no disponible");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const res = await geocoder.geocode({
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
        });

        if (res?.results?.length) {
          setPickup(res.results[0].formatted_address);
        }
      } catch {
        alert("Error obteniendo ubicación");
      }
    });
  };

  // 🚗 CALCULAR RUTA SEGURO
  const calculateRoute = async () => {
    try {
      if (!pickup || !dropoff || !window.google) {
        alert("Completa direcciones");
        return;
      }

      const service = new window.google.maps.DirectionsService();

      const result: any = await new Promise((resolve, reject) => {
        service.route(
          {
            origin: pickup,
            destination: dropoff,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (res: any, status: any) => {
            if (status === "OK") resolve(res);
            else reject(status);
          }
        );
      });

      const leg = result.routes?.[0]?.legs?.[0];
      if (!leg) return;

      const miles = leg.distance.value / 1609;
      const minutes = leg.duration.value / 60;

      setDistance(Number(miles.toFixed(2)));
      setPrice(Number((10 + miles * 2 + minutes * 0.5).toFixed(2)));
      setDirections(result);

    } catch {
      alert("Error calculando ruta");
    }
  };

  // 💾 GUARDAR SEGURO
  const saveBooking = async () => {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        name,
        phone,
        pickup,
        dropoff,
        price,
        distance,
        dateTime
      }),
    });

    const text = await res.text();
    console.log("API RESPONSE:", text);

  } catch (err) {
    console.error("ERROR:", err);
    alert("Error guardando reserva");
  }
};

  // 🔥 TRACKING + ETA
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

      const driversData = rows
        .filter(r => r[8] && r[9])
        .map(r => ({
          lat: Number(r[8]),
          lng: Number(r[9])
        }))
        .filter(d => !isNaN(d.lat) && !isNaN(d.lng)); // 🔥 extra seguridad

      setDrivers(driversData);

      if (driversData.length && pickup && window.google && isLoaded) {
        const service = new window.google.maps.DistanceMatrixService();

        service.getDistanceMatrix(
          {
            origins: [{ lat: driversData[0].lat, lng: driversData[0].lng }],
            destinations: [pickup],
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (res: any, status: any) => {
            if (
              status === "OK" &&
              res &&
              res.rows &&
              res.rows[0] &&
              res.rows[0].elements &&
              res.rows[0].elements[0] &&
              res.rows[0].elements[0].duration
            ) {
              const duration = res.rows[0].elements[0].duration.value;
              setEta(Math.round(duration / 60));
            }
          }
        );
      }

    } catch (err) {
      console.error("Tracking error:", err);
    }

  }, 3000);

  return () => clearInterval(interval);

}, [pickup, isLoaded]);
  const trackingLink = "https://private-rides.vercel.app/tracking";

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      libraries={libraries}
      onLoad={handleLoad}
    >
      <div style={{ height: "100vh", position: "relative" }}>

        <GoogleMap
          center={
  drivers.length && !isNaN(drivers[0].lat) && !isNaN(drivers[0].lng)
    ? { lat: drivers[0].lat, lng: drivers[0].lng }
    : { lat: 36.1699, lng: -115.1398 }
}
          zoom={14}
          mapContainerStyle={{ width: "100%", height: "100%" }}
        >
          {directions && <DirectionsRenderer directions={directions} />}

          {drivers
  .filter(d => !isNaN(d.lat) && !isNaN(d.lng))
  .map((d, i) => (
    <Marker
      key={i}
      position={{ lat: d.lat, lng: d.lng }}
      icon={{
        url: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
        scaledSize: isLoaded
          ? new window.google.maps.Size(40, 40)
          : undefined,
      }}
    />
))}
        </GoogleMap>

        {eta && (
          <div style={{ position: "absolute", top: 20, left: 20, background: "black", color: "white", padding: 10, borderRadius: 10 }}>
            ⏱️ {eta} min
          </div>
        )}

        <div style={panel}>

          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} style={input} />
          <input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
          <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} style={input} />

          <div style={row}>
            <input ref={pickupRef} placeholder="Origen" value={pickup} onChange={(e) => setPickup(e.target.value)} style={{ ...input, flex: 1 }} />
            <button onClick={getCurrentLocation}>📍</button>
          </div>

          <input ref={dropoffRef} placeholder="Destino" value={dropoff} onChange={(e) => setDropoff(e.target.value)} style={input} />

          <button onClick={calculateRoute} style={btn}>Calcular</button>

          {price && (
            <>
              <h3>💰 ${price} | 📏 {distance} mi</h3>

              <div style={row}>
                <button onClick={() => alert("Zelle: 725-287-6197")} style={btnPay}>Zelle</button>
                <button onClick={() => window.open("https://www.paypal.com/paypalme/ernestogongorasaco", "_blank")} style={btnPay}>PayPal</button>
                <button onClick={() => window.open("https://venmo.com/code?user_id=4536118275999433880&created=1776057522", "_blank")} style={btnPay}>Venmo</button>
              </div>

              <button
                onClick={async () => {
                  if (!name || !phone) return alert("Completa datos");

                  await saveBooking();

                  const msg = `🚗 Reserva confirmada
👤 ${name}
📞 ${phone}
📍 ${pickup}
🏁 ${dropoff}
💰 $${price}
📍 Tracking: ${trackingLink}`;

                  window.open(`https://wa.me/17252876197?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                style={btnMain}
              >
                🚗 Confirmar viaje
              </button>
            </>
          )}
        </div>
      </div>
    </LoadScript>
  );
}

const panel = { position: "absolute" as const, bottom: 0, width: "100%", background: "white", padding: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 };
const input = { width: "100%", padding: 10, marginBottom: 6, borderRadius: 10, border: "1px solid #ddd" };
const row = { display: "flex", gap: 6 };
const btn = { width: "100%", padding: 10, background: "black", color: "white", borderRadius: 10 };
const btnMain = { width: "100%", padding: 14, background: "black", color: "white", borderRadius: 12 };
const btnPay = { flex: 1, padding: 8, borderRadius: 8, color: "white", background: "#333" };