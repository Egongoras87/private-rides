"use client";
import { useState, useRef, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, set, onValue, } from "firebase/database";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";


import {
  GoogleMap,
  DirectionsRenderer,
  Autocomplete,
  Marker,
  useJsApiLoader
} from "@react-google-maps/api";

import { googleMapsConfig } from "@/lib/googleMaps";

const stripePromise = loadStripe("pk_test_51TSmPACMPktsmWMArlXTC4cnMCo7kSs93TdVklce4NmrIJkTdCEGfZsgbMCtvt1gFCnGPUDavnr8sTPpaGZtOBky00H4rQMTKl");
// ✅ SOLUCIÓN TYPE
declare global {
  interface Window {
    google: any;
  }
}

export default function Home() {
  

  return (
    <Elements stripe={stripePromise}>
      <CheckoutContent />
    </Elements>
  );
}
 function CheckoutContent() {
  const [metodoPago, setMetodoPago] = useState<"stripe" | "cash">("stripe");
const router = useRouter();
  const [directions, setDirections] = useState<any>(null);
  const { isLoaded } = useJsApiLoader(googleMapsConfig);
  const [distancia, setDistancia] = useState<number>(0);
  const origenAutoRef = useRef<any>(null);
  const destinoAutoRef = useRef<any>(null);
  const [precio, setPrecio] = useState<number>(0);
  const [loadingPago, setLoadingPago] = useState(false);
const [latDestino, setLatDestino] = useState(0);
const [lngDestino, setLngDestino] = useState(0);
  const [nombre, setNombre] = useState("");
 const [telefono, setTelefono] = useState("");
const stripe = useStripe();
const elements = useElements();
 const { user, loading } = useAuth();
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

  const origenRef = useRef<HTMLInputElement | null>(null);
  const destinoRef = useRef<HTMLInputElement | null>(null);
  const estiloBoton = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "none",
  fontSize: 16,
  cursor: "pointer",
  transition: "all 0.15s ease",
  boxShadow: "0 4px 0 rgba(0,0,0,0.2)"
};
useEffect(() => {
  if (!loading && !user) {
    router.push("/login-user");
  }
}, [user, loading]);

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

  if (!window.google?.maps) {
    console.warn("Google aún no está listo");
    return;
  }
if (!window.google?.maps?.DirectionsService) return;
  const service = new window.google.maps.DirectionsService();

  service.route(
    {
      origin: origen,
      destination: destino,
      travelMode: window.google.maps.TravelMode.DRIVING
    },
    (result: any, status: any) => {
  if (status !== "OK" || !result || !result.routes?.length) {
    console.error("❌ Directions error:", status);
    return;
  }

      setDirections(result);

      const leg = result.routes[0].legs[0];

      const latOrigen = leg.start_location.lat();
      const lngOrigen = leg.start_location.lng();

      const latDestino = leg.end_location.lat();
      const lngDestino = leg.end_location.lng();

      setLatOrigen(latOrigen);
      setLngOrigen(lngOrigen);
      setLatDestino(latDestino);
      setLngDestino(lngDestino);

      const distanciaMillas = leg.distance?.value
        ? leg.distance.value / 1609
        : 0;

      const duracionMin = leg.duration?.value
        ? leg.duration.value / 60
        : 0;

      const precioCalculado =
        BASE_FARE +
        distanciaMillas * PRICE_PER_MILE +
        duracionMin * PRICE_PER_MIN;

      const precioFinal = Math.max(precioCalculado, MIN_FARE);

      setDistancia(distanciaMillas);
      setPrecio(precioFinal);
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

    if (
      typeof window === "undefined" ||
      !window.google ||
      !window.google.maps ||
      !window.google.maps.Geocoder
    ) return;

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode(
      { location: { lat, lng } },
      (results: any, status: any) => {
        if (status === "OK" && results && results[0]) {
          if (origenRef.current) {
            origenRef.current.value = results[0].formatted_address;
          }
        } else {
          console.warn("Geocoder error:", status);
        }
      }
    );
  });
};

///////////////////////////////////////////FUNCION PAGAR////////////////////////////////////////////////////////////////////////
const pagar = async () => {
  try {
    setLoadingPago(true);

    if (!stripe || !elements) {
      alert("Stripe no cargó");
      return false;
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      alert("Ingresa la tarjeta");
      return false;
    }

    // 🔥 crear intent
    const res = await fetch("/api/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: Math.round(precio * 100)
      })
    });

    if (!res.ok) {
  alert("Error creando pago");
  return false;
}

const data = await res.json();

    // 🔥 confirmar pago REAL
    const result = await stripe.confirmCardPayment(data.clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: nombre,
          phone: telefono
        }
      }
    });

    if (result.error) {
      console.error(result.error);
      alert("❌ " + result.error.message);
      return false;
    }

    if (result.paymentIntent?.status === "succeeded") {
  return result.paymentIntent.id; // 🔥 devuelve el ID real
}

    return false;

  } catch (err) {
    console.error(err);
    alert("Error en pago");
    return false;
  } finally {
    setLoadingPago(false);
  }
};

  // ///////////////////////////////////////////////////////////////📤 PEDIR VIAJE////////////////////////////////////////
const reservar = async () => {
   if (loadingPago) return;
  if (!precio || precio <= 0) {
    alert("Calcula el precio primero");
    return;
  }

  if (!origenRef.current || !destinoRef.current) return;

  if (!fechaHora) {
    alert("⛔ Select date and time");
    return;
  }

  if (!latOrigen || !latDestino) {
    alert("Primero calcula la ruta");
    return;
  }

  if (!telefono || telefono.length < 8) {
    alert("Número inválido");
    return;
  }

  const uid = auth.currentUser?.uid;

  if (!user) {
  alert("Debes iniciar sesión");
  return;
}

  try {
   let paymentIntentId: string | null = null;

// 💳 STRIPE
if (metodoPago === "stripe") {
  const result = await pagar();

  if (!result) {
    alert("❌ Pago fallido");
    return;
  }

  paymentIntentId = result; // 🔥 guardas el ID aquí
}

    const fechaISO = new Date(fechaHora).getTime();
    const ahora = Date.now();

// 🔥 si es más de 10 min en el futuro → programado
const esProgramado = fechaISO > ahora + 10 * 60 * 1000;
    const origen = origenRef.current.value;
    const destino = destinoRef.current.value;

    const id = Date.now().toString();

  
    // 🔥 GUARDAR EN FIREBASE
    await set(ref(db, "viajes/" + id), {
  id,
  userId: uid,

  nombre,
  telefono,
  origen,
  destino,

  origenLat: latOrigen,
  origenLng: lngOrigen,
  destinoLat: latDestino,
  destinoLng: lngDestino,

  distancia,
  precio,
  fecha: fechaISO,

  estado: "Pendiente",   // 🔥 CLAVE
  driverId: null,        // 🔥 CLAVE
  esProgramado,

  metodoPago,
  pagado: metodoPago === "stripe",
  estadoPago: metodoPago === "stripe" ? "pagado" : "pendiente",
  paymentIntentId: metodoPago === "stripe" ? paymentIntentId : null,

  driverLat: null,
  driverLng: null,
  timestamp: Date.now()
});
if (esProgramado) {
  console.log("🕓 Viaje programado");
} else {
  console.log("🚗 Viaje inmediato");
}   

    // 🔥 LOCAL STORAGE
    localStorage.setItem("viajeId", id);
    localStorage.setItem(
      "viajeData",
      JSON.stringify({
        id,
        nombre,
        telefono,
        origen,
        destino,
        precio,
        distancia
      })
    );

    const trackingUrl = `${window.location.origin}/tracking?id=${id}`;

          const telefonoFinal = "1" + telefono.replace(/\D/g, "");

      const mensajeWhatsApp =
        "🚗 NEW RIDE\n\n" +
        "👤 " + nombre + "\n" +
        "📞 " + telefono + "\n" +
        "📍 " + origen + "\n" +
        "🏁 " + destino + "\n" +
        "💰 $" + precio.toFixed(2) + "\n\n" +
        "📡 Track:\n" + trackingUrl;

      const url = `https://wa.me/${telefonoFinal}?text=${encodeURIComponent(mensajeWhatsApp)}`;

      window.open(url, "_blank");
    

    // 🚀 REDIRECCIÓN
    setTimeout(() => {
      window.location.href = `/tracking?id=${id}`;
    }, 800);

  } catch (error) {
    console.error("ERROR:", error);
    alert("❌ Error de conexión");
  }
};

  // 📡 Leer ubicación del driver (simulación)
  useEffect(() => {
  const id = localStorage.getItem("viajeId");
  if (!id) return;
  

  const viajeRef = ref(db, "viajes/" + id);

  const unsubscribe = onValue(viajeRef, (snapshot) => {
  const data = snapshot.val();


if (!data.driverLat || !data.driverLng) {
  setDriverUbicacion(null);
  return;
}

const lat = Number(data.driverLat);
const lng = Number(data.driverLng);

  // 🔥 AQUÍ VA LA VALIDACIÓN
  

  if (!isNaN(lat) && !isNaN(lng)) {
    setDriverUbicacion({ lat, lng });
  }
});

  return () => unsubscribe();
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
    setFechaHora(data.fechaHora || "");

    setTimeout(() => {
      if (origenRef.current) origenRef.current.value = data.origen || "";
      if (destinoRef.current) destinoRef.current.value = data.destino || "";
    }, 300);
  }
}, []);
useEffect(() => {
  const id = localStorage.getItem("viajeId");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  const unsubscribe = onValue(viajeRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      localStorage.removeItem("viajeId");
      return;
    }

    const estado = data.estado;

   if (estado === "Pendiente" || estado === "Asignado" || estado === "En camino" || estado === "En viaje") {
  window.location.href = `/tracking?id=${id}`;
}

if (estado === "Finalizado" || estado === "Cancelado") {
  localStorage.removeItem("viajeId");
  localStorage.removeItem("viajeData");
}
  });

  return () => unsubscribe();
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
if (loading) {
  return (
    <div style={{
      color: "#fff",
      display: "flex",
      height: "100vh",
      justifyContent: "center",
      alignItems: "center",
      fontSize: 18
    }}>
      🔐 Verificando sesión...
    </div>
  );
}

if (!user) {
  window.location.href = "/login-user";
  return null;
}
if (!isLoaded) {
  return (
    <div style={{
      color: "#fff",
      display: "flex",
      height: "100vh",
      justifyContent: "center",
      alignItems: "center"
    }}>
      🗺️ Cargando mapa...
    </div>
  );
}
////////////////////////////////RETURN////////////////////////////////
return (

  <div>
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

     
        {/* 👤 DATOS USUARIO */}
       <input
  placeholder="Name"
  onChange={(e) => setNombre(e.target.value)}
  style={{
    width: "100%",
    padding: 8,
    background: "transparent",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 16,
    color: "#fff"
  }}
/>
<input
  placeholder="Phone number"
  onChange={(e) => setTelefono(e.target.value)}
  style={{
    width: "100%",
    padding: 8,
    background: "transparent",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 16,
    color: "#fff",
    marginTop: 8
  }}
/>
      
        
        <label style={{ color: "#fff" }}>Date & Time</label>

<input
  type="datetime-local"
  value={fechaHora}
  onChange={(e) => setFechaHora(e.target.value)}
  style={{
    width: "100%",
    padding: 8,
    background: "transparent",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 16,
    color: "#fff"
  }}
/>

        {/* 📍 ORIGEN */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <Autocomplete
  onLoad={(ref) => (origenAutoRef.current = ref)}
  onPlaceChanged={() => {
    const place = origenAutoRef.current.getPlace();
    if (!place.geometry) return;

    setLatOrigen(place.geometry.location.lat());
    setLngOrigen(place.geometry.location.lng());
  }}
>
  <input
    ref={origenRef}
    placeholder="Pickup location"
    style={{
      width: "100%",
      padding: 8,
      borderRadius: 10,
      border: "1px solid #ccc",
      background: "transparent",
      color: "#fff"
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
       <Autocomplete
  onLoad={(ref) => (destinoAutoRef.current = ref)}
  onPlaceChanged={() => {
    const place = destinoAutoRef.current.getPlace();
    if (!place.geometry) return;

    setLatDestino(place.geometry.location.lat());
    setLngDestino(place.geometry.location.lng());
  }}
>
  <input
    ref={destinoRef}
    placeholder="Drop-off location"
    style={{
      width: "100%",
      padding: 8,
      borderRadius: 10,
      border: "1px solid #ccc",
      background: "transparent",
      marginTop: 6,
      color: "#fff"
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
  disabled={loadingPago}
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
    {loadingPago ? "Procesando pago..." : "Request the Ride"}
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
<div style={{ marginTop: 10 }}>
  <p style={{ color: "#fff" }}>Choose a Payment Method.</p>

  <div style={{ display: "flex", gap: 10 }}>
  
  {/* 💳 CARD (MAS GRANDE) */}
  <div style={{ flex: 2 }}>
    <button
      onClick={() => setMetodoPago("stripe")}
      style={{
        width: "100%",
        padding: 10,
        borderRadius: 6,
        border: "none",
        background: metodoPago === "stripe" ? "#2ecc71" : "#333",
        color: "#fff",
        fontSize: 16
      }}
    >
      💳 Card
    </button>

    {metodoPago === "stripe" && (
      <div
        style={{
          marginTop: 6,
          padding: 12,
          background: "#fff",
          borderRadius: 8
        }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "18px", // 🔥 más grande para escribir cómodo
              },
            },
          }}
        />
      </div>
    )}
  </div>

  {/* 💵 CASH (MAS PEQUEÑO) */}
  <button
    onClick={() => setMetodoPago("cash")}
    style={{
      flex: 1,
      padding: 8,
      borderRadius:12,
      border: "none",
      background: metodoPago === "cash" ? "#f39c12" : "#333",
      color: "#fff",
      fontSize: 16
    }}
  >
    💵 Cash
  </button>

</div>
        </div>
<button
  onClick={() => setModoOscuroMapa(!modoOscuroMapa)}
  style={{
    marginTop: 4,
    padding: 4,
    borderRadius: 6,
    border: "none",
    background: "transparent",
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

 </div>
</div>

);
}