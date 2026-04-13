"use client";

import { useState, useRef, useEffect } from "react";
import {
  GoogleMap,
  LoadScript,
  DirectionsRenderer,
} from "@react-google-maps/api";

const libraries: ("places")[] = ["places"];

export default function Page() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [directions, setDirections] = useState<any>(null);
  const [trackingLink, setTrackingLink] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);

  const handleLoad = () => setIsLoaded(true);

  // 🔥 AUTOCOMPLETE
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    if (pickupRef.current) {
      const auto1 = new window.google.maps.places.Autocomplete(pickupRef.current);
      auto1.addListener("place_changed", () => {
        const place = auto1.getPlace();
        if (place.formatted_address) setPickup(place.formatted_address);
      });
    }

    if (dropoffRef.current) {
      const auto2 = new window.google.maps.places.Autocomplete(dropoffRef.current);
      auto2.addListener("place_changed", () => {
        const place = auto2.getPlace();
        if (place.formatted_address) setDropoff(place.formatted_address);
      });
    }
  }, [isLoaded]);

  // 📍 UBICACIÓN
  const getCurrentLocation = () => {
    if (!navigator.geolocation || !window.google) {
      alert("Ubicación no disponible");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const geocoder = new window.google.maps.Geocoder();

        const res = await geocoder.geocode({
          location: { lat, lng },
        });

        if (res?.results?.length > 0) {
          setPickup(res.results[0].formatted_address);
        }
      } catch (err) {
        alert("Error obteniendo ubicación");
      }
    });
  };

  // 🔥 GUARDAR RESERVA (CORRECTO)
  const saveBooking = async () => {
  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbw9W1SOCuelG7M1I5cLfBzkUMXZdGj78csPYM8Bjr9-WT0dwlUEbdTUA0rislOEVFkX6A/exec",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          pickup,
          dropoff,
          price,
          distance,
          dateTime,
        }),
      }
    );

    const text = await res.text();

    console.log("RESPUESTA SHEETS:", text);

    if (!res.ok) {
      throw new Error("Error al guardar");
    }

  } catch (error) {
    console.error("ERROR GUARDANDO:", error);
    alert("Error guardando la reserva");
    throw error;
  }
};

  // 🚗 CALCULAR RUTA
  const calculateRoute = async () => {
    try {
      if (!pickup || !dropoff || !window.google) {
        alert("Selecciona direcciones válidas");
        return;
      }

      const service = new window.google.maps.DirectionsService();

      const results: any = await new Promise((resolve, reject) => {
        service.route(
          {
            origin: pickup,
            destination: dropoff,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === "OK") resolve(result);
            else reject(status);
          }
        );
      });

      const route = results.routes?.[0]?.legs?.[0];
      if (!route) return;

      setDirections(results);

      const miles = route.distance.value / 1609;
      const minutes = route.duration.value / 60;

      setDistance(Number(miles.toFixed(2)));

      const total = 10 + miles * 2.0 + minutes * 0.5;
      setPrice(Number(total.toFixed(2)));

    } catch (err) {
      alert("Error calculando ruta");
    }
  };

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      libraries={libraries}
      onLoad={handleLoad}
    >
      <div style={{ position: "relative", height: "100vh" }}>

        <GoogleMap
          center={{ lat: 36.1699, lng: -115.1398 }}
          zoom={12}
          mapContainerStyle={{ width: "100%", height: "100%" }}
        >
          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>

        <div style={panel}>

          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} style={input} />
          <input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />

          <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} style={input} />

          <div style={{ display: "flex", gap: 5 }}>
            <input ref={pickupRef} placeholder="Origen" value={pickup} onChange={(e) => setPickup(e.target.value)} style={{ ...input, flex: 1 }} />
            <button onClick={getCurrentLocation}>📍</button>
          </div>

          <input ref={dropoffRef} placeholder="Destino" value={dropoff} onChange={(e) => setDropoff(e.target.value)} style={input} />

          <button onClick={calculateRoute} style={btn}>Calcular tarifa</button>

          {price && (
            <>
              <h2>💰 ${price}</h2>
              <p>📏 {distance} millas</p>

              <button onClick={() => alert("Zelle: 725-287-6197")} style={btnPurple}>Zelle</button>

              <a href="https://www.paypal.com/paypalme/ernestogongorasaco" target="_blank">
                <button style={btnBlue}>PayPal</button>
              </a>

              <a href="https://venmo.com/code?user_id=4536118275999433880&created=1776057522" target="_blank">
                <button style={btnSky}>Venmo</button>
              </a>

              <input placeholder="Tracking link" value={trackingLink} onChange={(e) => setTrackingLink(e.target.value)} style={input} />

              {/* ✅ BOTÓN FINAL CORREGIDO */}
              <button
                onClick={async () => {
  if (!price) {
    alert("Calcula tarifa");
    return;
  }

  if (!name || !phone) {
    alert("Completa datos");
    return;
  }

  try {
    await saveBooking(); // 🔥 guarda en Sheets
  } catch (e) {
    return; // 🔥 evita seguir si falla
  }

  const message = `
🚗 RESERVA CONFIRMADA

👤 ${name}
📞 ${phone}

📅 ${dateTime || "No especificada"}

📍 ${pickup}
🏁 ${dropoff}

📏 ${distance} millas
💰 $${price}
`;

  window.open(
    `https://wa.me/17252876197?text=${encodeURIComponent(message)}`,
    "_blank"
  );
}}
                style={btn}
              >
                Confirmar reserva ✅
              </button>
            </>
          )}
        </div>
      </div>
    </LoadScript>
  );
}

const panel = {
  position: "absolute" as const,
  bottom: 0,
  width: "100%",
  background: "white",
  padding: 15,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
};

const input = {
  width: "100%",
  padding: 12,
  marginBottom: 8,
  borderRadius: 10,
  border: "1px solid #ccc"
};

const btn = {
  width: "100%",
  padding: 12,
  background: "black",
  color: "white",
  borderRadius: 10,
  marginTop: 5
};

const btnPurple = { ...btn, background: "#6f42c1" };
const btnBlue = { ...btn, background: "#0070ba" };
const btnSky = { ...btn, background: "#3d95ce" };
