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
  const [gpsActive, setGpsActive] = useState(false);
  const [driverPos, setDriverPos] = useState<any>(null);
  const [directions, setDirections] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);

  const handleLoad = () => setIsLoaded(true);

  // 🔵 CARGAR
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
    }
  }, []);

  // 🟢 GUARDAR
  useEffect(() => {
    localStorage.setItem(
      "rideData",
      JSON.stringify({ name, phone, pickup, dropoff, price, distance })
    );
  }, [name, phone, pickup, dropoff, price, distance]);

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

  // 🔥 TRACKING
  const startTracking = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setDriverPos({ lat, lng });
      setDriverLocation(`https://www.google.com/maps?q=${lat},${lng}`);
      setGpsActive(true);

      navigator.geolocation.watchPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setDriverPos({ lat, lng });
        setDriverLocation(`https://www.google.com/maps?q=${lat},${lng}`);
      });
    });
  };

  // 🚗 CALCULAR
  const calculateRoute = async () => {
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

          <button onClick={calculateRoute} style={btnMain}>Calcular tarifa</button>

          <button onClick={startTracking} style={btnMain}>📍 Activar GPS</button>

          {price && (
            <>
              <h3>💰 ${price}</h3>

              <div style={{ display: "flex", gap: 5 }}>
                <button style={{ ...btnSmall, background: "#6f42c1" }}>Zelle</button>
                <button style={{ ...btnSmall, background: "#0070ba" }}>PayPal</button>
                <button style={{ ...btnSmall, background: "#3d95ce" }}>Venmo</button>
              </div>
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
  zIndex: 10
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 6,
  borderRadius: 10,
  border: "1px solid #ccc"
};

const btnMain = {
  width: "100%",
  padding: 10,
  background: "black",
  color: "white",
  borderRadius: 10,
  marginTop: 5,
  border: "none"
};

const btnSmall = {
  flex: 1,
  padding: 8,
  color: "white",
  borderRadius: 10,
  border: "none"
};