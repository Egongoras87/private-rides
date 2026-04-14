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
  const [driverPos, setDriverPos] = useState<any>(null);
  const [directions, setDirections] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);

  const handleLoad = () => setIsLoaded(true);

  // 🔥 AUTOCOMPLETE
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    const auto1 = new window.google.maps.places.Autocomplete(pickupRef.current!);
    auto1.addListener("place_changed", () => {
      const place = auto1.getPlace();
      if (place.formatted_address) setPickup(place.formatted_address);
    });

    const auto2 = new window.google.maps.places.Autocomplete(dropoffRef.current!);
    auto2.addListener("place_changed", () => {
      const place = auto2.getPlace();
      if (place.formatted_address) setDropoff(place.formatted_address);
    });

  }, [isLoaded]);

  // 📍 UBICACIÓN
  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const geocoder = new window.google.maps.Geocoder();
      const res = await geocoder.geocode({ location: { lat, lng } });

      if (res?.results?.length > 0) {
        setPickup(res.results[0].formatted_address);
      }
    });
  };

  // 🚗 GPS
  const startTracking = () => {
    navigator.geolocation.watchPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setDriverPos({ lat, lng });
    });

    alert("GPS activado 🚗");
  };

  // 🚗 CALCULAR
  const calculateRoute = async () => {
    if (!pickup || !dropoff || !window.google) {
      alert("Completa direcciones");
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

    const route = results.routes[0].legs[0];

    const miles = route.distance.value / 1609;
    const minutes = route.duration.value / 60;

    setDistance(Number(miles.toFixed(2)));
    setPrice(Number((10 + miles * 2 + minutes * 0.5).toFixed(2)));
    setDirections(results);
  };

  // 💾 GUARDAR RESERVA (ORDEN CORRECTO)
  const saveBooking = async () => {
    await fetch("https://script.google.com/macros/s/AKfycbx0_jDiY4iNsDMJnSvNkFWce60-X7op_TIgyWos-cQx12gdsQsRnq0Ovx6F8jrjL1zbSg/exec", {
      method: "POST",
      body: JSON.stringify({
        name,
        phone,
        pickup,
        dropoff,
        price,
        distance,
        dateTime,
        status: "Pendiente"
      }),
    });
  };

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      libraries={libraries}
      onLoad={handleLoad}
    >
      <div style={{ height: "100vh", position: "relative" }}>

        <GoogleMap
          center={driverPos || { lat: 36.1699, lng: -115.1398 }}
          zoom={14}
          mapContainerStyle={{ width: "100%", height: "100%" }}
        >
          {directions && <DirectionsRenderer directions={directions} />}
          {driverPos && (
            <Marker
              position={driverPos}
              icon={{ url: "https://maps.google.com/mapfiles/kml/shapes/cabs.png" }}
            />
          )}
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

          {/* BOTONES COMPACTOS */}
          <div style={row}>
            <button onClick={calculateRoute} style={btn}>Calcular</button>
            <button onClick={startTracking} style={btn}>GPS</button>
          </div>

          {price && (
            <>
              <h3>💰 ${price} | 📏 {distance} mi</h3>

              {/* 💳 PAGOS */}
              <div style={row}>
  {/* ZELLE */}
  <button
    onClick={() => alert("Zelle: 725-287-6197")}
    style={btnPay}
  >
    Zelle
  </button>

  {/* PAYPAL */}
  <button
    onClick={() => window.open("https://www.paypal.com/paypalme/ernestogongorasaco", "_blank")}
    style={btnPay}
  >
    PayPal
  </button>

  {/* VENMO */}
  <button
    onClick={() => window.open("https://venmo.com/code?user_id=4536118275999433880&created=1776057522", "_blank")}
    style={btnPay}
  >
    Venmo
  </button>
</div>

              {/* 🚗 RESERVAR */}
              <button
                onClick={async () => {
                  if (!name || !phone) return alert("Completa datos");

                  await saveBooking();

                  const msg = `
🚗 NUEVA RESERVA

👤 ${name}
📞 ${phone}
📍 ${pickup}
🏁 ${dropoff}
💰 $${price}
📏 ${distance} mi
`;

                  window.open(`https://wa.me/17252876197?text=${encodeURIComponent(msg)}`);
                }}
                style={btnMain}
              >
                Confirmar 🚗
              </button>
            </>
          )}

        </div>
      </div>
    </LoadScript>
  );
}

// 🎨 ESTILOS PRO
const panel = {
  position: "absolute" as const,
  bottom: 0,
  width: "100%",
  background: "white",
  padding: 10,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20
};

const input = {
  width: "100%",
  padding: 8,
  marginBottom: 6,
  borderRadius: 10,
  border: "1px solid #ccc",
  fontSize: 12
};

const row = {
  display: "flex",
  gap: 5,
  marginBottom: 6
};

const btn = {
  flex: 1,
  padding: 8,
  background: "black",
  color: "white",
  borderRadius: 10,
  fontSize: 12
};

const btnMain = {
  width: "100%",
  padding: 10,
  background: "#000",
  color: "white",
  borderRadius: 10,
  marginTop: 5
};
const btnPay = {
  flex: 1,
  padding: 6,
  borderRadius: 8,
  border: "none",
  fontSize: 11,
  fontWeight: "bold",
  color: "white",
  cursor: "pointer",
  background: "linear-gradient(135deg, #000, #333)"
};

const btnPurple = { ...btn, background: "#6f42c1" };
const btnBlue = { ...btn, background: "#0070ba" };
const btnSky = { ...btn, background: "#3d95ce" };