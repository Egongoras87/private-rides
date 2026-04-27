"use client";

import { useState, useRef, useEffect } from "react";
import {
  GoogleMap,
  LoadScript,
  DirectionsRenderer,
  Autocomplete,
  Marker
} from "@react-google-maps/api";

export default function Home() {
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
const [disponible, setDisponible] = useState(true);
  const [distancia, setDistancia] = useState<number>(0);
  const [precio, setPrecio] = useState<number>(0);
  const [mensaje, setMensaje] = useState<string>("");
const [latDestino, setLatDestino] = useState(0);
const [lngDestino, setLngDestino] = useState(0);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
const telefonoDriver = "17252876197"; // formato internacional sin +
  const [miUbicacion, setMiUbicacion] =
    useState<{ lat: number; lng: number } | null>(null);
const [latOrigen, setLatOrigen] = useState(0);
const [lngOrigen, setLngOrigen] = useState(0);
  const [driverUbicacion, setDriverUbicacion] =
    useState<{ lat: number; lng: number } | null>(null);
const [mostrarZelle, setMostrarZelle] = useState(false);
  const origenRef = useRef<HTMLInputElement | null>(null);
  const destinoRef = useRef<HTMLInputElement | null>(null);
  const estiloBoton = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "none",
  fontSize: 16,
  cursor: "pointer",
  transition: "all 0.15s ease",
  boxShadow: "0 4px 0 rgba(0,0,0,0.2)"
};

const presionarBoton = (e: any) => {
  e.currentTarget.style.transform = "scale(0.96)";
  e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.2)";
};

const soltarBoton = (e: any) => {
  e.currentTarget.style.transform = "scale(1)";
  e.currentTarget.style.boxShadow = "0 4px 0 rgba(0,0,0,0.2)";
};

  // 📍 Calcular ruta
  const calcularRuta = () => {
    if (!origenRef.current || !destinoRef.current) return;

    const origen = origenRef.current.value;
    const destino = destinoRef.current.value;

    if (!origen || !destino) {
      alert("Completa origen y destino");
      return;
    }

    if (!window.google) {
      alert("Google Maps no cargó");
      return;
    }

    const service = new window.google.maps.DirectionsService();

    service.route(
      {
        origin: origen,
        destination: destino,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === "OK" && result) {
          setDirections(result);
          const leg = result.routes[0].legs[0];
          const latOrigen = leg.start_location.lat();
const lngOrigen = leg.start_location.lng();

setLatOrigen(latOrigen);
setLngOrigen(lngOrigen);

const latDestino = leg.end_location.lat();
const lngDestino = leg.end_location.lng();

setLatDestino(latDestino);
setLngDestino(lngDestino);

          // 🔥 MILLAS
          const distanciaMillas =
            result.routes[0].legs[0].distance?.value
              ? result.routes[0].legs[0].distance.value / 1609
              : 0;

          setDistancia(distanciaMillas);
          setPrecio(distanciaMillas * 2.5);
        }
      }
    );
  };
// VERIFICAR DISPONIBILIDAD
  const verificarDisponibilidad = async () => {
  try {
    const res = await fetch("/api/disponibilidad");
    const data = await res.json();

    setDisponible(data.disponible);

    if (!data.disponible) {
      setMensaje("⛔ Driver not available right now");
    }

  } catch (error) {
    console.error("Error disponibilidad:", error);
  }
};

  // 📍 Obtener ubicación real + dirección
  const obtenerUbicacion = () => {
    if (!navigator.geolocation) {
      alert("Geolocalización no soportada");
      return;
    }

    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setMiUbicacion({ lat, lng });

      if (!window.google) return;

      const geocoder = new window.google.maps.Geocoder();

      geocoder.geocode(
        { location: { lat, lng } },
        (results, status) => {
          if (status === "OK" && results && results[0]) {
            if (origenRef.current) {
              origenRef.current.value =
                results[0].formatted_address;
            }
          }
        }
      );
    });
  };

  // 📤 Reservar viaje
 const reservar = async () => {
  if (!origenRef.current || !destinoRef.current) return;

  const origen = origenRef.current.value;
  const destino = destinoRef.current.value;

  try {
    const id = Date.now();

    const res = await fetch("/api/reservar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id,
        nombre,
        telefono,
        origen,
        destino,
        latOrigen,
        lngOrigen,
        latDestino,
        lngDestino,
        distancia,
        precio
      })
    });

    const data = await res.json();
    console.log("RESPUESTA BACKEND:", data);

    // ❌ SI FALLA → SALIR
    if (!data.success) {
      setMensaje("❌ " + (data.message || "Not available"));
      return;
    }

    // ✅ OK
    setMensaje("✅ Ride booked");

    // 🔥 guardar ID
    localStorage.setItem("viajeId", id.toString());

    // 🔥 guardar datos
    localStorage.setItem(
      "viajeData",
      JSON.stringify({
        nombre,
        telefono,
        origen,
        destino,
        precio: Number(precio),
        distancia: Number(distancia)
      })
    );

    // 📲 WhatsApp driver
    const mensajeWhatsApp =
      "🚗 NUEVO VIAJE\n\n" +
      "👤 Nombre: " + nombre + "\n" +
      "📞 Tel: " + telefono + "\n" +
      "📍 Origen: " + origen + "\n" +
      "🏁 Destino: " + destino + "\n" +
      "💰 Precio: $" + Number(precio).toFixed(2) + "\n" +
      "📏 Distancia: " + Number(distancia).toFixed(2) + " millas";

    const urlWhatsApp =
      "https://wa.me/" +
      telefonoDriver +
      "?text=" +
      encodeURIComponent(mensajeWhatsApp);

    window.open(urlWhatsApp, "_blank");

    // 💳 Mensaje pago
    const mensajePago =
      "💳 PAGO DEL VIAJE\n\n" +
      "Monto: $" + Number(precio).toFixed(2) + "\n\n" +
      "Zelle: 7252876197\n" +
      "PayPal: ernestogongorasaco@gmail.com\n" +
      "Venmo: https://venmo.com/code?user_id=4536118275999433880&created=1777321277";

    const urlPagoWhatsApp =
      "https://wa.me/" +
      telefono +
      "?text=" +
      encodeURIComponent(mensajePago);

    window.open(urlPagoWhatsApp, "_blank");

    // 🚀 redirigir
    setTimeout(() => {
      window.location.href = "/tracking";
    }, 1000);

  } catch (error) {
    console.error("ERROR FETCH:", error);
    setMensaje("❌ Error de conexión");
  }
};
  // 📡 Leer ubicación del driver (simulación)
  const obtenerDriver = async () => {
  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbyaLJPd6q1iipDqwytovCyoG0wJWesWQ_93_0tPS_9L6-RaGCR0Q53HpUfWJvKYf3XnWw/exec"
    );

    const data = await res.json();

    if (!Array.isArray(data) || data.length < 2) return;

    const viaje = data[data.length - 1];

    const lat = parseFloat(viaje[13]);
    const lng = parseFloat(viaje[14]);

    if (!isNaN(lat) && !isNaN(lng)) {
      setDriverUbicacion({ lat, lng });
    }

  } catch (error) {
    console.error("ERROR OBTENER DRIVER:", error);
  }
};

  // 🔁 actualización automática
  useEffect(() => {
    const interval = setInterval(() => {
      obtenerDriver();
    }, 5000);

    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
  verificarDisponibilidad();

  const interval = setInterval(() => {
    verificarDisponibilidad();
  }, 10000);

  return () => clearInterval(interval);
}, []);

  return (
    <div
  style={{
    padding: 20,
    maxWidth: 500,
    margin: "auto",
    fontFamily: "Arial",
    background: "#f9f9f9"
  }}
>
      <h1>App Viajes</h1>

      <LoadScript
        googleMapsApiKey={
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
        }
        libraries={["places"]}
      >
        {/* 👤 DATOS USUARIO */}
        <input
          placeholder="Nombre"
          onChange={(e) => setNombre(e.target.value)}
        />

        <br /><br />

        <input
          placeholder="Teléfono"
          onChange={(e) => setTelefono(e.target.value)}
        />

        <br /><br />

        {/* 📍 ORIGEN */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <Autocomplete>
    <input
      ref={origenRef}
      placeholder="Origen"
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 10,
        border: "1px solid #ccc"
      }}
    />
  </Autocomplete>

  <button
  onClick={obtenerUbicacion}
  onMouseDown={presionarBoton}
  onMouseUp={soltarBoton}
  onMouseLeave={soltarBoton}
  style={{
    width: 30,
    height: 40,
    borderRadius: "30%",
    background: "#999b9a",
    color: "#ffffff",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 0 rgba(0,0,0,0.2)"
  }}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    fill="white"
    viewBox="0 0 24 24"
  >
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 
    0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 
    2.5 2.5S13.38 11.5 12 11.5z"/>
  </svg>
</button>
</div>

        <br /><br />

        {/* 📍 DESTINO */}
        <Autocomplete>
          <input ref={destinoRef} placeholder="Destino" />
        </Autocomplete>

        <br /><br />

        <button
  onClick={calcularRuta}
  onMouseDown={presionarBoton}
  onMouseUp={soltarBoton}
  onMouseLeave={soltarBoton}
  style={{
    ...estiloBoton,
    background: "#000",
    color: "#fff"
  }}
>
  Calculate Fare
</button>

        <p>Distancia: {distancia.toFixed(2)} millas</p>
        <p>Precio: ${precio.toFixed(2)}</p>

        <button
  onClick={reservar}
  disabled={!disponible}
  onMouseDown={(e) => disponible && presionarBoton(e)}
  onMouseUp={(e) => disponible && soltarBoton(e)}
  onMouseLeave={(e) => disponible && soltarBoton(e)}
  style={{
    ...estiloBoton,
    background: disponible ? "#2ecc71" : "#999",
    color: "#fff",
    opacity: disponible ? 1 : 0.6,
    cursor: disponible ? "pointer" : "not-allowed",
    boxShadow: disponible
      ? "0 4px 0 rgba(0,0,0,0.2)"
      : "0 2px 0 rgba(0,0,0,0.1)"
  }}
>
  {disponible ? "Book Ride" : "Not Available"}
</button>

        <p>{mensaje}</p>
        {mensaje.includes("✅") && (
  <div style={{ marginTop: 20 }}>
    <h3 style={{ marginBottom: 10 }}>💳 Métodos de pago</h3>

    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      
      <button
  onClick={() => setMostrarZelle(!mostrarZelle)}
  style={{
    flex: 1,
    padding: 10,
    background: "#6f42c1",
    color: "#fff",
    borderRadius: 10,
    border: "none"
  }}
>
  Zelle
</button>

      <button
        onClick={() =>
          window.open(
            "https://www.paypal.com/paypalme/ernestogongorasaco"
          )
        }
        style={{
          flex: 1,
          padding: 12,
          background: "#0070ba",
          color: "#fff",
          border: "none",
          borderRadius: 10
        }}
      >
        PayPal
      </button>

      <button
        onClick={() =>
          window.open(
            "https://venmo.com/code?user_id=4536118275999433880&created=1777321277"
          )
        }
        style={{
          flex: 1,
          padding: 12,
          background: "#3d95ce",
          color: "#fff",
          border: "none",
          borderRadius: 10
        }}
      >
        Venmo
      </button>

    </div>
  </div>
)}

        {/* 🗺️ MAPA */}
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "400px" }}
          center={miUbicacion || { lat: 36.1699, lng: -115.1398 }}
          zoom={14}
        >
          {directions && (
            <DirectionsRenderer directions={directions} />
          )}

          {miUbicacion && <Marker position={miUbicacion} />}

          {driverUbicacion && (
            <Marker position={driverUbicacion} />
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}