"use client";
import { useState, useRef, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, set, onValue, } from "firebase/database";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { update } from "firebase/database";

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
  const [openConfig, setOpenConfig] = useState(false);
  const [mostrarCardModal, setMostrarCardModal] = useState(false);
  const [metodoPago, setMetodoPago] = useState<"stripe" | "cash">("stripe");
const router = useRouter();
const [email, setEmail] = useState("");
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
const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
const [cardGuardada, setCardGuardada] = useState(false);
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

const MIN_FARE = 12;        // mínimo

  const origenRef = useRef<HTMLInputElement | null>(null);
  const destinoRef = useRef<HTMLInputElement | null>(null);
   // ... (tus estados y otros useEffect)

  // 🔥 UBICACIÓN DE LAS FUNCIONES DE HUNDIMIENTO
  const press3D = (e: any) => { // 👈 Añadido : any
    e.currentTarget.style.transform = "translateY(4px)";
    e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.5)";
  };

  const release3D = (e: any, colorShadow = "#000") => { // 👈 Añadido : any
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = `0 6px 0 ${colorShadow}, 0 12px 20px rgba(0,0,0,0.4)`;
  };
 
useEffect(() => {
  if (user) {
    // Referencia a la ubicación del perfil usando el UID del usuario logueado
    const userProfileRef = ref(db, `usuarios/${user.uid}/perfil`);
    
    // onValue escucha cambios en tiempo real
    const unsub = onValue(userProfileRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Rellenamos los estados con la info de la base de datos
        if (data.nombre) setNombre(data.nombre);
        if (data.telefono) setTelefono(data.telefono);
      }
    });

    return () => unsub(); // Limpiamos la conexión al desmontar
  }
}, [user]); // Se ejecuta cada vez que el estado del usuario cambia
useEffect(() => {
  if (!loading && !user) {
    router.push("/login-user");
  }
}, [user, loading]);

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
        distanciaMillas * PRICE_PER_MILE 
       

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



  // ///////////////////////////////////////////////////////////////📤 PEDIR VIAJE////////////////////////////////////////
const reservar = async () => {
  if (loadingPago) return;

  // --- VALIDACIONES PREVIAS ---
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

  const user = auth.currentUser;

  if (!user) {
    alert("Debes iniciar sesión");
    return;
  }

  // =========================================================
  // 🔥 PASO 1: GUARDAR PERFIL AL PEDIR EL VIAJE
  // =========================================================
  try {
    const userProfileRef = ref(db, `usuarios/${user.uid}/perfil`);
   await update(userProfileRef, {
  nombre,
  telefono,
  email,          // 🔥 NUEVO
  metodoPago,     // 🔥 NUEVO
  ultimaActualizacion: Date.now()
});
    console.log("✅ Perfil sincronizado con Firebase");
  } catch (profileError) {
    console.error("Error guardando el perfil:", profileError);
  }

  setLoadingPago(true);

  try {
    // 🔒 VALIDAR TARJETA ANTES DE PAGAR
    if (metodoPago === "stripe" && !paymentMethodId) {
      alert("Ingresa los datos de la tarjeta");
      setLoadingPago(false);
      return;
    }

    const fechaISO = new Date(fechaHora).getTime();
    const ahora = Date.now();
    const esProgramado = fechaISO > ahora + 10 * 60 * 1000;

    const origen = origenRef.current.value;
    const destino = destinoRef.current.value;

    const token = await user.getIdToken();

    // 🔥 CREAR VIAJE EN BACKEND
    const res = await fetch("/api/create-viaje", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        nombre,
        telefono,
        origen,
        destino,
        origenLat: latOrigen,
        origenLng: lngOrigen,
        destinoLat: latDestino,
        destinoLng: lngDestino,
        distancia: distancia,
        precio,
        fecha: fechaISO,
        esProgramado,
        metodoPago,
        pagado: metodoPago === "stripe",
        estadoPago: metodoPago === "stripe" ? "pagado" : "pendiente",
        paymentMethodId: metodoPago === "stripe" ? paymentMethodId : null
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error creando viaje");
      setLoadingPago(false);
      return;
    }

    // 🔥 ID SOLO VIENE DEL BACKEND
    const viajeId = data.id;

    // 🔥 LOCAL STORAGE
    localStorage.setItem("viajeId", viajeId);
    localStorage.setItem(
      "viajeData",
      JSON.stringify({
        id: viajeId,
        nombre,
        telefono,
        origen,
        destino,
        precio,
        distancia
      })
    );

    const trackingUrl = `${window.location.origin}/tracking?id=${viajeId}`;
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

    // Abrimos WhatsApp
    window.open(url, "_blank");

    // 🚀 REDIRECCIÓN FLUIDA (Next.js Way)
    // Usamos router.push en lugar de window.location.href para no recargar la app
    setTimeout(() => {
      router.push(`/tracking?id=${viajeId}`);
    }, 800);

  } catch (error) {
    console.error("ERROR:", error);
    alert("❌ Error de conexión");
  } finally {
    setLoadingPago(false);
  }
};
  // 📡 Leer ubicación del driver (simulación)
 useEffect(() => {
  const id = localStorage.getItem("viajeId");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  const unsubscribe = onValue(viajeRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) return; // 🔥 IMPORTANTE

    if (!data.driverLat || !data.driverLng) {
      setDriverUbicacion(null);
      return;
    }

    const lat = Number(data.driverLat);
    const lng = Number(data.driverLng);

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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <h1 style={{ color: "#b19e36" }}>App Private Rides</h1>
 
  <button
    onClick={() => setOpenConfig(true)}
    style={{
      background: "transparent",
      border: "none",
      fontSize: 22,
      cursor: "pointer",
      color: "#fff"
    }}
  >
    ⚙️
  </button>
</div>
  
        
       {/* 👤 INPUT PARA NOMBRE */}
<input
  placeholder="Name"
  value={nombre} // 👈 Crucial: Esto muestra el nombre cargado de Firebase
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

{/* 👤 INPUT PARA TELÉFONO */}
<input
  placeholder="Phone number"
  value={telefono} // 👈 Crucial: Esto muestra el teléfono cargado de Firebase
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
  style={btnGPS}
  onMouseDown={press3D}
  onMouseUp={(e) => release3D(e, "#000")}
  onMouseLeave={(e) => release3D(e, "#000")}
  onClick={obtenerUbicacion} // Asegúrate de que el nombre coincida con tu función (obtenerUbicacionActual)
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24" // Aumentado un poco para mejor visibilidad
    height="24"
    fill="currentColor" // Usará el color definido en el estilo (azul por defecto)
    viewBox="0 0 24 24"
  >
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
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
  style={btnGetPrice}
  onMouseDown={press3D}
  onMouseUp={(e) => release3D(e, "#004494")} // Sombra azul oscura
  onMouseLeave={(e) => release3D(e, "#004494")}
  onClick={calcularRuta}
>
  Get Price
</button>

 <button
  onClick={reservar}
  disabled={loadingPago} // Evita doble clic mientras procesa
  onMouseDown={press3D}
  onMouseUp={(e) => release3D(e, "#145524")}
  onMouseLeave={(e) => release3D(e, "#145524")}
  // Soporte para móviles
  onTouchStart={press3D}
  onTouchEnd={(e) => release3D(e, "#145524")}
  style={{
    ...btnRequest,
    flex: 1, // Para que ocupe el ancho disponible si está en un contenedor flex
    opacity: loadingPago ? 0.7 : 1, // Se vuelve opaco al cargar
    cursor: loadingPago ? "not-allowed" : "pointer", // Cambia el cursor si está bloqueado
    filter: loadingPago ? "grayscale(0.3)" : "none" // Opcional: un toque más oscuro al procesar
  }}
>
  {loadingPago ? "Processing payment..." : "Request the Ride"}
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
  <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
  {/* 💳 BOTÓN CARD */}
  <button 
      style={{
        ...btnPayment, 
        background: metodoPago === "stripe" ? "linear-gradient(145deg, #007bff, #0056b3)" : "#1e1e1e",
        border: metodoPago === "stripe" ? "1px solid #00c6ff" : "1px solid #333",
      }}
      onMouseDown={press3D}
      onMouseUp={(e) => release3D(e, "#000")}
      onMouseLeave={(e) => release3D(e, "#000")}
      onClick={() => {
        setMetodoPago("stripe");
        setMostrarCardModal(true);
      }}
    >
      💳 Card
    </button>

    <button 
      style={{
        ...btnPayment, 
        background: metodoPago === "cash" ? "linear-gradient(145deg, #f39c12, #d35400)" : "#1e1e1e",
        border: metodoPago === "cash" ? "1px solid #f1c40f" : "1px solid #333",
      }}
      onMouseDown={press3D}
      onMouseUp={(e) => release3D(e, "#000")}
      onMouseLeave={(e) => release3D(e, "#000")}
      onClick={() => setMetodoPago("cash")}
    >
      💵 Cash
    </button>
  </div>
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
<div
  style={{
    marginTop: 20,
    marginBottom: 20,
    display: "flex",
    justifyContent: "center",
    gap: 16,
    fontSize: 14,
  }}
>
  <a
    href="/privacy"
    style={{
      color: "#fff",
      textDecoration: "none"
    }}
  >
    Privacy Policy
  </a>

  <a
    href="/terms"
    style={{
      color: "#fff",
      textDecoration: "none"
    }}
  >
    Terms of Service
  </a>
</div>
{openConfig && (
  <div style={{
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.9)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  }}>
    <div style={{
      width: "90%",
      maxWidth: 400,
      background: "#111",
      borderRadius: 12,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      color: "#fff"
    }}>
      
      <h3>⚙️ Settings</h3>

      {/* 👤 Nombre */}
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Name"
        style={inputConfig}
      />

      {/* 📞 Teléfono */}
      <input
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Phone"
        style={inputConfig}
      />
      {/* 📧 EMAIL */}
<input
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="Email"
  style={inputConfig}
/>

      {/* 💳 Método de pago */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
  onMouseDown={press3D}
  onMouseUp={(e) => release3D(e, "#004494")}
  onMouseLeave={(e) => release3D(e, "#004494")}
  onTouchStart={press3D}
  onTouchEnd={(e) => release3D(e, "#004494")}
  onClick={() => {
    setMetodoPago("stripe");
    setMostrarCardModal(true); // 🔥 ESTO FALTABA
  }}
  style={{
    ...btnPayment,
    background: metodoPago === "stripe"
      ? "linear-gradient(145deg, #007bff, #0056b3)"
      : "#1e1e1e",
  }}
>
  💳 Card
</button>
      </div>

      {/* 💾 Guardar */}
      <button
      onMouseDown={press3D}
  onMouseUp={(e) => release3D(e, "#004494")}
  onMouseLeave={(e) => release3D(e, "#004494")}
  onTouchStart={press3D}
  onTouchEnd={(e) => release3D(e, "#004494")}
        onClick={async () => {
          const user = auth.currentUser;
          if (!user) return;

         await set(ref(db, `usuarios/${user.uid}/perfil`), {
  nombre,
  telefono,
  email, // 🔥 NUEVO
  metodoPago,
  updatedAt: Date.now()
});
          alert("✅ Saved");
          setOpenConfig(false);
        }}
        style={{
          padding: 12,
          borderRadius: 8,
          border: "none",
          background: "#2ecc71",
          color: "#fff"
        }}
      >
        Save
      </button>

      {/* Cerrar */}
      <button
      onMouseDown={press3D}
  onMouseUp={(e) => release3D(e, "#004494")}
  onMouseLeave={(e) => release3D(e, "#004494")}
  onTouchStart={press3D}
  onTouchEnd={(e) => release3D(e, "#004494")}
        onClick={() => setOpenConfig(false)}
        style={{
          padding: 10,
          borderRadius: 8,
          border: "none",
          background: "#333",
          color: "#fff"
        }}
      >
        Close
      </button>

    </div>
  </div>
)}
{mostrarCardModal && (
    <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.85)",
      zIndex: 9999,
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}
  >
    <div
      style={{
        width: "90%",
        maxWidth: 400,
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 15
      }}
    >
      <h3 style={{ textAlign: "center" }}>💳 Enter Card</h3>

      <div
        style={{
          padding: 14,
          border: "1px solid #ccc",
          borderRadius: 8
        }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "20px",
                letterSpacing: "2px"
              }
            }
          }}
        />
      </div>

      <button
  onClick={async () => {
    if (!stripe || !elements) {
      alert("Stripe no cargado");
      return;
    }

    const card = elements.getElement(CardElement);

    if (!card) {
      alert("Ingrese la tarjeta");
      return;
    }

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card
    });

    if (error) {
      alert(error.message);
      return;
    }

    // ✅ GUARDAR
    setPaymentMethodId(paymentMethod.id);
    setCardGuardada(true);

    console.log("💳 Guardada:", paymentMethod.id);

    setMostrarCardModal(false);
  }}
  style={{
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#2ecc71",
    color: "#fff"
  }}
>
  💾 Save Card
</button>

      <button
        onClick={() => setMostrarCardModal(false)}
        style={{
          padding: 10,
          borderRadius: 8,
          border: "none",
          background: "#ccc",
          color: "#000"
        }}
      >
        ⬅ Back
      </button>
    </div>
  </div>
)}
 </div>
</div>

);
}
// 🎨 ESTILOS DE LUJO 3D
const btn3D = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 60px",
  borderRadius: "16px",
  border: "none",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "all 0.1s ease",
  color: "#fff",
  fontSize: "15px",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

// Estilo específico para "Get Price"
const btnGetPrice = {
  ...btn3D,
  background: "linear-gradient(145deg, #007bff, #0056b3)",
  boxShadow: "0 6px 0 #004494, 0 12px 20px rgba(0,0,0,0.4)",
};

// Estilo específico para "Request Rider"
const btnRequest = {
  ...btn3D,
  background: "linear-gradient(145deg, #28a745, #1e7e34)",
  boxShadow: "0 6px 0 #145524, 0 12px 20px rgba(0,0,0,0.4)",
};

// Estilo para los botones de Pago (Cash/Card) y Saved Card
const btnPayment = {
  ...btn3D,
  background: "#1e1e1e",
  color: "#ccc",
  boxShadow: "0 5px 0 #000, 0 10px 15px rgba(0,0,0,0.5)",
  flex: 1,
  margin: "0 5px",
};

// Estilo para el botón Circular de GPS
const btnGPS = {
  width: "30px",
  height: "30px",
  borderRadius: "30%",
  border: "none",
  background: "#1e1e1e",
  color: "#007bff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "20px",
  cursor: "pointer",
  boxShadow: "0 5px 0 #000, 0 8px 15px rgba(0,0,0,0.4)",
  transition: "all 0.1s ease",
};
const inputConfig = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #333",
  background: "#1e1e1e",
  color: "#fff"
};
// fix permissions.