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
  const [isLoaded, setIsLoaded] = useState(false);

  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);

  // 🔥 cuando carga google
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

  // 🚗 CALCULAR RUTA REAL
  const calculateRoute = async () => {
    if (!pickup || !dropoff || !window.google) {
      alert("Selecciona direcciones válidas");
      return;
    }

    const service = new window.google.maps.DirectionsService();

    try {
      const results = await service.route({
        origin: pickup,
        destination: dropoff,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      if (!results.routes?.[0]?.legs?.[0]) {
        alert("No se pudo calcular la ruta");
        return;
      }

      setDirections(results);

      const route = results.routes[0].legs[0];

      const miles = route.distance.value / 1609;
      const minutes = route.duration.value / 60;

      const total = 10 + miles * 2.5 + minutes * 0.5;

      setPrice(Number(total.toFixed(2)));
    } catch (e) {
      alert("Error calculando ruta");
    }
  };

  // 📲 WHATSAPP
  const sendWhatsApp = () => {
    const message = `
🚗 NUEVA RESERVA

👤 ${name}
📞 ${phone}

📍 ${pickup}
🏁 ${dropoff}

💰 $${price}

📡 Tracking:
${trackingLink || "Se enviará luego"}
`;

    const url = `https://wa.me/17252876197?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      libraries={libraries}
      onLoad={handleLoad}
    >
      <div style={{ position: "relative", height: "100vh" }}>

        {/* MAPA */}
        <GoogleMap
          center={{ lat: 36.1699, lng: -115.1398 }}
          zoom={12}
          mapContainerStyle={{ width: "100%", height: "100%" }}
        >
          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>

        {/* PANEL */}
        <div style={panel}>

          <input placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />

          <input placeholder="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={input}
          />

          <input ref={pickupRef}
            placeholder="Origen"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            style={input}
          />

          <input ref={dropoffRef}
            placeholder="Destino"
            value={dropoff}
            onChange={(e) => setDropoff(e.target.value)}
            style={input}
          />

          <button onClick={calculateRoute} style={btn}>
            Calcular tarifa
          </button>

          {price && (
            <>
              <h2>💰 ${price}</h2>

              <p>Métodos de pago:</p>

              <button onClick={() => alert("Zelle: 725-287-6197")} style={btnPurple}>
                Zelle
              </button>

              <a href="https://www.paypal.com/paypalme/ernestogongorasaco" target="_blank">
                <button style={btnBlue}>PayPal</button>
              </a>

              <a href="https://venmo.com/code?user_id=4536118275999433880&created=1776057522" target="_blank">
                <button style={btnSky}>Venmo</button>
              </a>

              <input
                placeholder="(Conductor) link de tracking"
                value={trackingLink}
                onChange={(e) => setTrackingLink(e.target.value)}
                style={input}
              />

              <button onClick={sendWhatsApp} style={btn}>
                Reservar por WhatsApp
              </button>
            </>
          )}
        </div>
      </div>
    </LoadScript>
  );
}

// 🎨 estilos
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