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

  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);

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
    if (!isLoaded || !isGoogleReady()) return;
    const auto1 = new window.google.maps.places.Autocomplete(pickupRef.current!);
    const auto2 = new window.google.maps.places.Autocomplete(dropoffRef.current!);

    auto1.addListener("place_changed", () => {
      const p = auto1.getPlace();
      if (p.formatted_address) setPickup(p.formatted_address);
    });
    auto2.addListener("place_changed", () => {
      const p = auto2.getPlace();
      if (p.formatted_address) setDropoff(p.formatted_address);
    });
  }, [isLoaded]);

  // --- LÓGICA DE RUTA Y COSTO ---
  const calculateRoute = async () => {
    if (!pickup || !dropoff || !isGoogleReady()) return;
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
      return alert("Por favor completa todos los campos.");
    }
    if (!isValidPhone(phone)) {
      return alert("El teléfono debe tener 10 dígitos.");
    }

    // Generamos el ID único (Llave para el Tracking)
    const tripId = "TRIP-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    const rideData = {
      tripId,
      name,
      phone: cleanPhone(phone),
      pickup,
      dropoff,
      price,
      distance,
      dateTime: new Date(dateTime).toISOString(),
      status: "Pendiente"
    };

    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rideData),
      });

      const result = await res.json();

      if (result.success) {
        // Notificación vía WhatsApp para el Admin
        const adminMsg = `🚗 NUEVA RESERVA\n👤 Cliente: ${name}\n📞 Tel: ${phone}\n📍 Recogida: ${pickup}\n🏁 Destino: ${dropoff}\n📅 Hora: ${dateTime}\n🆔 ID: ${tripId}`;
        window.open(`https://wa.me/17252876197?text=${encodeURIComponent(adminMsg)}`);

        // Limpieza y Redirección al Tracking
        clearData();
        window.location.href = `/tracking?tripId=${tripId}`;
      } else {
        alert("Error al procesar la reserva en el servidor.");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión con la API.");
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