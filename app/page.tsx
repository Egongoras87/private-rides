"use client";

import { useState, useRef, useEffect } from "react";
import {
  
  GoogleMap,
  LoadScript,
  DirectionsRenderer,
  Marker
} from "@react-google-maps/api";
declare global {
  interface Window {
    google: any;
  }
}

const libraries: ("places")[] = ["places"];
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFNqIxvd-BENxjUOAz0uApP17pkd2RDdjcnBZFf3yaW8zf18YC4C1AviRjT1lbEaGlOg/exec";

export default function Page() {
  // --- PERSISTENCIA DE DATOS ---
  const getSaved = () => {
    if (typeof window === "undefined") return null;
    const data = localStorage.getItem("rideData");
    return data ? JSON.parse(data) : null;
  };

  const saved = getSaved();

  const [name, setName] = useState(saved?.name || "");
  const [phone, setPhone] = useState(saved?.phone || "");
  const [pickup, setPickup] = useState(saved?.pickup || "");
  const [dropoff, setDropoff] = useState(saved?.dropoff || "");
  const [price, setPrice] = useState<number | null>(saved?.price || null);
  const [directions, setDirections] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(saved?.distance || null);
  const [dateTime, setDateTime] = useState(saved?.dateTime || "");
  const [isLoaded, setIsLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [pickupCoords, setPickupCoords] = useState<any>(null);
const [dropoffCoords, setDropoffCoords] = useState<any>(null);

  const pickupRef = useRef<HTMLInputElement | null>(null);
const dropoffRef = useRef<HTMLInputElement | null>(null);

  // --- EFECTOS VISUALES (UX/UI) ---
  const pressIn = (e: any) => {
    e.currentTarget.style.transform = "scale(0.96)";
    e.currentTarget.style.filter = "brightness(0.9)";
  };
  const pressOut = (e: any) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.filter = "brightness(1)";
  };

  const handleLoad = () => setIsLoaded(true);
  const isGoogleReady = () => typeof window !== "undefined" && window.google?.maps;
  const cleanPhone = (p: string) => p.replace(/\D/g, "");
  const isValidPhone = (p: string) => cleanPhone(p).length === 10;

  // --- GUARDADO AUTOMÁTICO ---
  useEffect(() => {
    if (!name && !phone && !pickup && !dropoff) return;
    localStorage.setItem("rideData", JSON.stringify({
      name, phone, pickup, dropoff, price, distance, dateTime
    }));
  }, [name, phone, pickup, dropoff, price, distance, dateTime]);

  const clearData = () => {
    localStorage.removeItem("rideData");
    setName(""); setPhone(""); setPickup(""); setDropoff(""); setPrice(null); setDistance(null); setDateTime("");
  };

  // --- AUTOCOMPLETE (UBER STYLE) ---
  useEffect(() => {
  if (!isLoaded) return;

  if (
    typeof window === "undefined" ||
    !window.google ||
    !pickupRef.current ||
    !dropoffRef.current
  ) return;

  const auto1 = new window.google.maps.places.Autocomplete(pickupRef.current);
  const auto2 = new window.google.maps.places.Autocomplete(dropoffRef.current);

  const listener1 = auto1.addListener("place_changed", () => {
    const p = auto1.getPlace();

    if (!p.geometry || !p.geometry.location) return;

    setPickup(p.formatted_address || "");

    setPickupCoords({
      lat: p.geometry.location.lat(),
      lng: p.geometry.location.lng()
    });
  });

  const listener2 = auto2.addListener("place_changed", () => {
    const p = auto2.getPlace();

    if (!p.geometry || !p.geometry.location) return;

    setDropoff(p.formatted_address || "");

    setDropoffCoords({
      lat: p.geometry.location.lat(),
      lng: p.geometry.location.lng()
    });
  });

  return () => {
    listener1.remove();
    listener2.remove();
  };

}, [isLoaded]);

  // --- LÓGICA DE RUTA Y COSTO ---
  const calculateRoute = () => {
  if (!pickup || !dropoff || !isGoogleReady()) return;

  const service = new window.google.maps.DirectionsService();

  service.route(
    {
      origin: pickup,
      destination: dropoff,
      travelMode: window.google.maps.TravelMode.DRIVING
    },
    (res: any, status: string) => {

      if (status !== "OK" || !res) {
        console.error("Error en ruta:", status);
        return;
      }

      const route = res.routes?.[0];
      const leg = route?.legs?.[0];

      if (!leg || !leg.distance || !leg.duration) {
        console.error("Datos de ruta incompletos");
        return;
      }

      const miles = leg.distance.value / 1609;
      const minutes = leg.duration.value / 60;

      setDistance(Number(miles.toFixed(2)));
      setPrice(Number((10 + miles * 1.5 + minutes * 0.5).toFixed(2)));
      setDirections(res);
    }
  );
};
  // --- LOCALIZACIÓN GPS ---
  const getCurrentLocation = () => {
    if (!navigator.geolocation) return alert("GPS no disponible");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const geocoder = new window.google.maps.Geocoder();
      const res = await geocoder.geocode({
        location: { lat: pos.coords.latitude, lng: pos.coords.longitude }
      });
      if (res.results?.[0]) setPickup(res.results[0].formatted_address);
    }, () => alert("Activa los permisos de ubicación"));
  };

  // 🔥 ARREGLO 1: FUNCIÓN DE CONFIRMACIÓN MAESTRA
  const confirmRide = async () => {

  if (!name || !phone || !pickup || !dropoff || !dateTime) {
    return alert("Completa todos los campos");
  }

  if (!isValidPhone(phone)) {
    return alert("Teléfono inválido");
  }

  if (!pickupCoords || !dropoffCoords) {
    return alert("Selecciona direcciones del autocompletado");
  }

  const tripId = "TRIP-" + Date.now();

  try {

    const formData = new FormData();

    formData.append("tripId", tripId);
    formData.append("name", name);
    formData.append("phone", cleanPhone(phone));
    formData.append("pickup", pickup);
    formData.append("dropoff", dropoff);
    formData.append("price", String(price || 0));
    formData.append("distance", String(distance || 0));
    formData.append("dateTime", dateTime);

    // 🔥 AQUÍ VA (ANTES ESTABA MAL UBICADO)
    formData.append("pickupLat", pickupCoords.lat);
    formData.append("pickupLng", pickupCoords.lng);
    formData.append("dropoffLat", dropoffCoords.lat);
    formData.append("dropoffLng", dropoffCoords.lng);

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: formData,
    });

    const text = await res.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { status: "ok" };
    }

    if (result.success) {

      const message = `
🚗 NUEVA RESERVA
👤 ${name}
📞 ${phone}
📍 ${pickup}
🏁 ${dropoff}
💰 $${price}
📏 ${distance} mi
🆔 ${tripId}
`;

      window.open(
        `https://wa.me/17252876197?text=${encodeURIComponent(message)}`
      );

      clearData();
      window.location.href = `/tracking?tripId=${tripId}`;

    } else {
      alert(result.message || "Error en reserva");
    }

  } catch (err) {
    console.error(err);
    alert("Error de conexión");
  }
};

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""} libraries={libraries} onLoad={handleLoad}>
      <div style={{ height: "100vh", position: "relative", background: "#000", overflow: "hidden" }}>
        
        <GoogleMap
          center={{ lat: 36.1699, lng: -115.1398 }}
          zoom={13}
          onLoad={(m) => setMap(m)}
          options={{ disableDefaultUI: true, zoomControl: false, styles: mapStyle }}
          mapContainerStyle={{ width: "100%", height: "100%" }}
        >
          {directions && <DirectionsRenderer directions={directions} options={{ polylineOptions: { strokeColor: "#000", strokeWeight: 5 } }} />}
        </GoogleMap>

        {/* PANEL DE RESERVA */}
        <div style={panel}>
          <div style={dragHandle}></div>
          
          <input placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} style={input} />
          <input placeholder="Teléfono de contacto" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
          <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} style={input} />

          <div style={{ display: "flex", gap: 6 }}>
            <input ref={pickupRef} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="¿Dónde te recogemos?" style={{ ...input, flex: 1 }} />
            <button style={btnIcon} onClick={getCurrentLocation} onMouseDown={pressIn} onMouseUp={pressOut}>📍</button>
          </div>

          <input ref={dropoffRef} value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="¿A dónde vas?" style={input} />

          <button style={btnCalc} onClick={calculateRoute} onMouseDown={pressIn} onMouseUp={pressOut}>
            Calcular Tarifa
          </button>

          {price && (
            <div style={resultArea}>
              <h3 style={priceText}>💰 Total: ${price} <span style={{fontSize: 12, fontWeight: 400}}>({distance} mi)</span></h3>

              <p style={sectionTitle}>Método de Pago</p>
              <div style={row}>
                <button style={btnZelle} onClick={() => alert("Zelle: 725-287-6197")} onMouseDown={pressIn} onMouseUp={pressOut}>Zelle</button>
                <button style={btnPaypal} onClick={() => window.open("https://www.paypal.com/paypalme/ernestogongorasaco")} onMouseDown={pressIn} onMouseUp={pressOut}>PayPal</button>
                <button style={btnVenmo} onClick={() => window.open("https://venmo.com/code?user_id=4536118275999433880")} onMouseDown={pressIn} onMouseUp={pressOut}>Venmo</button>
              </div>

              <div style={row}>
                <button
                  style={btnMain}
                  onMouseDown={pressIn} onMouseUp={pressOut}
                  onClick={confirmRide}
                >
                  Confirmar Viaje
                </button>

                <button
                  style={btnCancel}
                  onMouseDown={pressIn} onMouseUp={pressOut}
                  onClick={() => {
                    if(confirm("¿Seguro que deseas limpiar los datos?")) {
                      clearData();
                      window.location.reload();
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </LoadScript>
  );
}

// --- ESTILOS VISUALES ---
const panel = { 
  position: "absolute" as const, bottom: 0, width: "100%", 
  background: "#f8f9fa", padding: "10px 20px 30px 20px", 
  borderTopLeftRadius: 28, borderTopRightRadius: 28,
  boxShadow: "0 -10px 30px rgba(0,0,0,0.2)", color: "#000"
};

const dragHandle = { width: 40, height: 5, background: "#ccc", borderRadius: 10, margin: "0 auto 15px auto" };
const input = { width: "100%", padding: 14, marginBottom: 10, borderRadius: 12, border: "1px solid #e2e2e2", background: "#eee", color: "#000", fontSize: 15 };
const btnCalc = { width: "100%", padding: 14, background: "#000", color: "#fff", borderRadius: 12, border: "none", fontWeight: "bold", cursor: "pointer" };
const resultArea = { marginTop: 15 };
const priceText = { textAlign: "center" as const, fontSize: 22, marginBottom: 15, fontWeight: 700 };
const sectionTitle = { fontSize: 13, color: "#666", marginBottom: 8, fontWeight: 600 };
const row = { display: "flex", gap: 10, marginBottom: 10 };
const btnMain = { flex: 4, padding: 16, background: "#27ae60", color: "#fff", borderRadius: 14, border: "none", fontWeight: "bold", fontSize: 16, cursor: "pointer" };
const btnCancel = { flex: 1, padding: 16, background: "#ebedef", color: "#333", borderRadius: 14, border: "none", fontWeight: "bold", cursor: "pointer" };
const btnZelle = { flex: 1, padding: 10, background: "#6d1ed1", color: "#fff", borderRadius: 10, border: "none", fontSize: 12, fontWeight: "bold" };
const btnPaypal = { flex: 1, padding: 10, background: "#003087", color: "#fff", borderRadius: 10, border: "none", fontSize: 12, fontWeight: "bold" };
const btnVenmo = { flex: 1, padding: 10, background: "#3d95ce", color: "#fff", borderRadius: 10, border: "none", fontSize: 12, fontWeight: "bold" };
const btnIcon = { padding: "0 15px", borderRadius: 12, border: "1px solid #e2e2e2", background: "#eee", color: "#000", cursor: "pointer" };

const mapStyle = [
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
];