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

  const [distancia, setDistancia] = useState<number>(0);
  const [precio, setPrecio] = useState<number>(0);
  const [mensaje, setMensaje] = useState<string>("");
const [latDestino, setLatDestino] = useState(0);
const [lngDestino, setLngDestino] = useState(0);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
const telefonoDriver = "17252876197"; // formato internacional sin +
const [fechaHora, setFechaHora] = useState("");
  const [miUbicacion, setMiUbicacion] =
    useState<{ lat: number; lng: number } | null>(null);
    const [modoOscuroMapa, setModoOscuroMapa] = useState(true);
const [latOrigen, setLatOrigen] = useState(0);
const [lngOrigen, setLngOrigen] = useState(0);
  const [driverUbicacion, setDriverUbicacion] =
    useState<{ lat: number; lng: number } | null>(null);
    const BASE_FARE = 8;        // tarifa base
const PRICE_PER_MILE = 2.0; // por milla
const PRICE_PER_MIN = 0.3;  // por minuto
const MIN_FARE = 12;        // mínimo
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
          const duracionMin =
  result.routes[0].legs[0].duration?.value
    ? result.routes[0].legs[0].duration.value / 60
    : 0;

const precioCalculado =
  BASE_FARE +
  distanciaMillas * PRICE_PER_MILE +
  duracionMin * PRICE_PER_MIN;

// 🔥 aplicar mínimo
const precioFinal = Math.max(precioCalculado, MIN_FARE);

setPrecio(precioFinal);
        }
      }
    );
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

  if (!fechaHora) {
    setMensaje("⛔ Select date and time");
    return;
  }

  const fechaISO = new Date(fechaHora).toISOString();

  const origen = origenRef.current.value;
  const destino = destinoRef.current.value;

  try {
    // 🔥 1. GENERAR ID
    const id = Date.now();

    // 🔥 2. GUARDAR LOCAL
    localStorage.setItem("viajeId", String(id));

    localStorage.setItem(
      "viajeData",
      JSON.stringify({
        id,
        nombre,
        telefono,
        origen,
        destino,
        precio: Number(precio),
        distancia: Number(distancia)
      })
    );

    // 🔥 3. CREAR TRACKING
    const trackingUrl = `${window.location.origin}/tracking?id=${id}`;

    // 🔥 4. WHATSAPP DRIVER (INMEDIATO)
    const mensajeWhatsApp =
      "🚗 NEW RIDE\n\n" +
      "👤 " + nombre + "\n" +
      "📞 " + telefono + "\n" +
      "📍 " + origen + "\n" +
      "🏁 " + destino + "\n" +
      "💰 $" + Number(precio).toFixed(2) + "\n\n" +
      "📡 Track:\n" + trackingUrl;

    window.open(
      `https://wa.me/${telefonoDriver}?text=${encodeURIComponent(mensajeWhatsApp)}`,
      "_blank"
    );

    // 🔥 5. REDIRECCIÓN INMEDIATA
    window.location.href = `/tracking?id=${id}`;

    // 🔥 6. BACKEND EN SEGUNDO PLANO (NO BLOQUEA)
    fetch("/api/reservar", {
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
        precio,
        fechaHora: fechaISO
      })
    }).catch((err) => {
      console.error("Error enviando a backend:", err);
    });

  } catch (error) {
    console.error("ERROR:", error);
    setMensaje("❌ Error de conexión");
  }
};
  // 📡 Leer ubicación del driver (simulación)
  const obtenerDriver = async () => {
  try {
    const res = await fetch("/api/viajes");

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


// 🔁 GUARDAR FORM DATA
useEffect(() => {
  localStorage.setItem(
    "formData",
    JSON.stringify({
      nombre,
      telefono,
      origen: origenRef.current?.value || "",
      destino: destinoRef.current?.value || "",
      fechaHora
    })
  );
}, [nombre, telefono, fechaHora]);


// 🔁 CARGAR FORM DATA
useEffect(() => {
  const saved = localStorage.getItem("formData");

  if (saved) {
    const data = JSON.parse(saved);

    setNombre(data.nombre || "");
    setTelefono(data.telefono || "");
    setFechaHora(data.fechaHora || "");

    setTimeout(() => {
      if (origenRef.current) origenRef.current.value = data.origen || "";
      if (destinoRef.current) destinoRef.current.value = data.destino || "";
    }, 300);
  }
}, []);


// 🔥 VALIDAR VIAJE (EL MÁS IMPORTANTE)
useEffect(() => {

  const limpiarStorage = () => {
    localStorage.removeItem("viajeId");
    localStorage.removeItem("viajeData");
  };

  const validarViaje = async () => {
    const id = localStorage.getItem("viajeId");
    if (!id) return;

    try {
      const res = await fetch(`/api/viajes?id=${id}`);
      const viaje = await res.json();

      // ❌ NO BORRAR SI FALLA RESPUESTA
      if (!viaje || viaje.length < 12) {
        console.warn("Viaje no encontrado, pero NO borrar aún");
        return;
      }

      const estado = viaje[11];

      // 🔥 VALIDAR EXPIRACIÓN
      const fechaViaje = new Date(viaje[12]).getTime();
      const ahora = Date.now();

      const expirado = ahora > fechaViaje + 2 * 60 * 60 * 1000;

      if (expirado) {
        console.log("Viaje expirado");
        limpiarStorage();
        return;
      }

      // 🔥 SOLO ENTRA SI ACTIVO
      if (estado === "Pendiente" || estado === "En camino") {
        window.location.href = `/tracking?id=${id}`;
      } else {
        limpiarStorage();
      }

    } catch (error) {
      console.error("Error validando viaje:", error);

      // 🔥 NO BORRAR EN ERROR
      const id = localStorage.getItem("viajeId");

      if (id) {
        window.location.href = `/tracking?id=${id}`;
      }
    }
  };

  validarViaje();

}, []);


// 🔁 DEBUG (opcional)
useEffect(() => {
  const id = localStorage.getItem("viajeId");

  if (id) {
    console.log("Viaje activo detectado:", id);
  }
}, []);


// 🔁 LIMPIEZA FUTURA (placeholder)
useEffect(() => {
  const limpiarViejo = () => {
    const id = localStorage.getItem("viajeId");
    if (!id) return;

    // puedes usarlo después si quieres TTL real
  };

  limpiarViejo();
}, []);

const darkMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#0f0f0f" }] // 🔥 negro profundo
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#cfcfcf" }] // texto claro
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0f0f0f" }]
  },

  // 🛣️ calles normales
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2b2b2b" }]
  },

  // 🚗 autopistas (más visibles)
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#088b4a" }] // azul moderno 🔥
  },

  // 🧭 bordes de carretera
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#aaaaaa" }]
  },

  // 🌊 agua
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0a1a2f" }]
  },

  // 🏙️ puntos de interés
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#1a1a1a" }]
  },

  // 🚉 transporte
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1a1a1a" }]
  }
];

const lightMapStyle = [];
////////////////////////////////RETURN////////////////////////////////
  return (
  <>
  {/* FONDO */}
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundImage: "url('/bg.png?v=2')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      zIndex: -2
    }}
  />
  {/* CAPA OSCURA */}
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(12, 3, 3, 0.5)",
      zIndex: -1
    }}
  />
    <div style={{ position: "relative", zIndex: 1, padding: 20 }}>
    
  
      <h1 style={{ color: "#b19e36" }}>App Private Rides</h1>

      <LoadScript
        googleMapsApiKey={
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
        }
        libraries={["places"]}
      >
        {/* 👤 DATOS USUARIO */}
       <input
  placeholder="Name"
  onChange={(e) => setNombre(e.target.value)}
  style={{
    width: "100%",
    padding: 14,
    background: "transparent",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 16,
    color: "#fff"
  }}
/>

<input
  placeholder="Phone"
  onChange={(e) => setTelefono(e.target.value)}
  style={{
    width: "100%",
    padding: 14,
    borderRadius: 10,
    background: "transparent",
    border: "1px solid #ccc",
    fontSize: 16,
    color: "#fff"
  }}
/>
       
        
        <label style={{ color: "#fff" }}>Date & Time</label>

<input
  type="datetime-local"
  value={fechaHora}
  onChange={(e) => setFechaHora(e.target.value)}
  style={{
    width: "100%",
    padding: 14,
    background: "transparent",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 16,
    color: "#fff"
  }}
/>

        {/* 📍 ORIGEN */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <Autocomplete>
    <input
  ref={origenRef}
  placeholder="Pickup location"
  style={{
    width: "100%",
    padding: 14,
    background: "transparent",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 16,
    color: "#fff" // 👈 AQUÍ
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
    background: "transparent",
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

        

        {/* 📍 DESTINO */}
        <Autocomplete>
         <input
  ref={destinoRef}
  placeholder="Drop-off location"
  style={{
    width: "100%",
    padding: 14,
    background: "transparent",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 16,
    marginTop: 8,
    color: "#fff" // 👈 AQUÍ
  }}
/>
        </Autocomplete>

        

       <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
  
  <button
    onClick={calcularRuta}
    onMouseDown={presionarBoton}
    onMouseUp={soltarBoton}
    onMouseLeave={soltarBoton}
    style={{
      flex: 1,
      ...estiloBoton,
      background: "#000",
      color: "#fff"
    }}
  >
    Calculate
  </button>

  <button
    onClick={reservar}
    onMouseDown={presionarBoton}
onMouseUp={soltarBoton}
onMouseLeave={soltarBoton}
    style={{
      flex: 1,
      ...estiloBoton,
      background: "#2ecc71",
      color: "#fff"
    }}
  >
    Book
  </button>

</div>
<div style={{ marginTop: 8 }}>
  <p style={{ color: "#00ff99" }}>
  Distance: {distancia.toFixed(2)} miles
</p>

<p style={{ color: "#00ff99", fontWeight: "bold" }}>
  Price: ${precio.toFixed(2)}
</p>
</div>

        {false && mensaje.includes("✅") && (
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
<button
  onClick={() => setModoOscuroMapa(!modoOscuroMapa)}
  style={{
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    border: "none",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    backdropFilter: "blur(5px)"
  }}
>
  {modoOscuroMapa ? "☀️ Light Map" : "🌙 Dark Map"}
</button>

        {/* 🗺️ MAPA */}
       <div
  style={{
    marginTop: 15,
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
  }}
>
  <GoogleMap
  mapContainerStyle={{
    width: "100%",
    height: "50vh"
  }}
  center={miUbicacion || { lat: 36.1699, lng: -115.1398 }}
  zoom={14}
   options={{
    styles: modoOscuroMapa ? darkMapStyle : []
  }}
>
    {directions && <DirectionsRenderer directions={directions} />}
    {miUbicacion && <Marker position={miUbicacion} />}
    {driverUbicacion && <Marker position={driverUbicacion} />}
    
  </GoogleMap>
</div>
</LoadScript>
</div>
    </>
  );
}