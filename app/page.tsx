"use client";
import { useState, useRef, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, set, onValue, get, } from "firebase/database";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement
} from "@stripe/react-stripe-js";
import { update } from "firebase/database";


import {
  GoogleMap,
  DirectionsRenderer,
  Autocomplete,
  Marker,
  useJsApiLoader
} from "@react-google-maps/api";

import { googleMapsConfig } from "@/lib/googleMaps";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);
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
const [cardLast4, setCardLast4] =
  useState("");

const [cardBrand, setCardBrand] =
  useState("");
const [wakeLock, setWakeLock] =
  useState<any>(null);

const [cardGuardada, setCardGuardada] = useState(false);
const [zipCode, setZipCode] =
  useState("");
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
    const [installPrompt, setInstallPrompt] =
  useState<any>(null);

const [appInstalada, setAppInstalada] =
  useState(false);

const [iosDevice, setIosDevice] =
  useState(false);

const [cerrarInstall, setCerrarInstall] =
  useState(false);
    const BASE_FARE = 8;        // tarifa base
const PRICE_PER_MILE = 2.5; // por milla

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

  if (!user) return;

  const cargarPerfil = async () => {

    try {

      const snap = await get(
        ref(db, "usuarios/" + user.uid)
      );

      if (!snap.exists()) return;

      const data = snap.val();

      setNombre(data.nombre || "");

      setTelefono(data.telefono || "");

      // 🔥 tarjeta guardada
      if (data.paymentMethodId) {

        setPaymentMethodId(
          data.paymentMethodId
        );
      }

      if (data.cardLast4) {

        setCardLast4(
          data.cardLast4
        );
      }

      if (data.cardBrand) {

        setCardBrand(
          data.cardBrand
        );
      }

    } catch (err) {

      console.error(
        "LOAD PROFILE ERROR:",
        err
      );
    }
  };

  cargarPerfil();

}, [user]);
useEffect(() => {

  if (loading) return;

  const verificarSesion = async () => {

    try {

      // 🔥 NO LOGIN
      if (!user) {

        router.replace("/login-user");

        return;
      }

      // 🔥 SOLO validar sesión
      // NO redirigir automáticamente
      console.log(
        "Usuario autenticado:",
        user.uid
      );

    } catch (err) {

      console.error(
        "SESSION ERROR:",
        err
      );
    }
  };

  verificarSesion();

}, [user, loading, router]);
/////////////////////////////////////////// DETECTAR PWA INSTALADA/////////////////////////
useEffect(() => {

  // 📱 Detectar iPhone
  const isIos =
    /iphone|ipad|ipod/i.test(
      window.navigator.userAgent
    );

  setIosDevice(isIos);
// 🔥 MANTENER PANTALLA ENCENDIDA
activarWakeLock();

  // ✅ Detectar instalada
 const standalone =

  window.matchMedia(
    "(display-mode: standalone)"
  ).matches ||

  window.matchMedia(
    "(display-mode: fullscreen)"
  ).matches ||

  (window.navigator as any)
    .standalone;

  const instaladaGuardada =
  localStorage.getItem(
    "pwa_installed"
  ) === "true";

if (
  standalone ||
  instaladaGuardada
) {

  setAppInstalada(true);

  return;
}

  // 📲 Capturar prompt
  const handler = (e: any) => {

    e.preventDefault();

    setInstallPrompt(e);
  };

  window.addEventListener(
    "beforeinstallprompt",
    handler
  );

  // ✅ Detectar instalación
  window.addEventListener(
  "appinstalled",
  () => {

    setAppInstalada(true);

    localStorage.setItem(
      "pwa_installed",
      "true"
    );
  }
);

  return () => {

    window.removeEventListener(
      "beforeinstallprompt",
      handler
    );
  };

}, []);
//////////// DETECTAR VISIBILIDAD PARA REACTIVAR WAKE LOCK SI SE DESACTIVA POR IRSE A OTRA PESTAÑA O BLOQUEAR PANTALLA
useEffect(() => {

  const handleVisibility =
    async () => {

      if (
        document.visibilityState ===
        "visible"
      ) {

        activarWakeLock();
      }
    };

  document.addEventListener(
    "visibilitychange",
    handleVisibility
  );

  return () => {

    document.removeEventListener(
      "visibilitychange",
      handleVisibility
    );
  };

}, []);

const instalarApp = async () => {

  // ANDROID
  if (installPrompt) {

    installPrompt.prompt();

    const choice =
      await installPrompt.userChoice;

    if (
      choice.outcome === "accepted"
    ) {

      setAppInstalada(true);
    }

    return;
  }

  // IOS fallback
  alert(
    "On iPhone tap Share then Add to Home Screen"
  );
};


//////////////////////////////////////////////////////📍 Calcular ruta
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
/////////////////////////////////////////////////ACTIVAR WAKE LOCK PARA NO SUSPENDER DURANTE EL VIAJE///////
const activarWakeLock = async () => {

  try {

    // 🔥 Compatible Android Chrome
    if (
      "wakeLock" in navigator
    ) {

      const lock =
        await (navigator as any)
          .wakeLock
          .request("screen");

      setWakeLock(lock);

      console.log(
        "Wake Lock ACTIVATED"
      );

      // 🔥 Si se libera
      lock.addEventListener(
        "release",
        () => {

          console.log(
            "Wake Lock RELEASED"
          );
        }
      );
    }

  } catch (err) {

    console.error(
      "Wake Lock ERROR:",
      err
    );
  }
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
   const userProfileRef = ref(
  db,
  `usuarios/${user.uid}`
);
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
       
        paymentMethodId: metodoPago === "stripe" ? paymentMethodId : null
      })
    });

  const data = await res.json();

if (!res.ok) {

  alert(data.error || "Error creando viaje");

  setLoadingPago(false);

  return;
}

// ✅ ID DEL VIAJE
const viajeId = data.id;

// 💳 SOLO SI ES TARJETA
if (metodoPago === "stripe") {

  if (!stripe) {

    alert("Stripe aún no está listo");

    setLoadingPago(false);

    return;
  }

  const { error, paymentIntent } =
    await stripe.confirmCardPayment(
      data.clientSecret,
      {
        payment_method: paymentMethodId!
      }
    );

  if (error) {

    console.error(error);

    alert(error.message);

    setLoadingPago(false);

    return;
  }
   // ✅ ACTUALIZAR FIREBASE
  await update(
    ref(db, "viajes/" + viajeId),
    {
      pagado: true,
      estadoPago: "pagado",
      paymentIntentId: paymentIntent.id
    }
  );

  if (!paymentIntent) {

    alert("No se pudo procesar el pago");

    setLoadingPago(false);

    return;
  }

  if (paymentIntent.status !== "succeeded") {

    alert("Pago no completado");

    setLoadingPago(false);

    return;
  }

 
}
  
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

   const adminPhone =
  "17252876197";

const url =
  `https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(mensajeWhatsApp)}`;

// 📲 OPEN ADMIN CHAT
window.open(
  url,
  "_blank"
);

  
    // 🚀 REDIRECCIÓN FLUIDA (Next.js Way)
    // Usamos router.push en lugar de window.location.href para no recargar la app
   router.push(
  `/tracking?id=${viajeId}`
);

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

//////////////////////////////// RETURN ////////////////////////////////
return (



<div>
{/* INSTALL APP */}

{!appInstalada &&
 !cerrarInstall && (

  <div
    style={{
      width: "100%",

      padding: 16,

      borderRadius: 22,

      marginBottom: 18,

      background:
        "linear-gradient(145deg,#ffffff,#f5f5f5)",

      boxShadow:
        "0 10px 30px rgba(0,0,0,0.12)",

      border:
        "1px solid rgba(0,0,0,0.06)"
    }}
  >

    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",

        alignItems: "center"
      }}
    >

      <div>

        <div
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: "#111"
          }}
        >
          📲 Install App
        </div>

        <div
          style={{
            fontSize: 13,
            color: "#666",
            marginTop: 4
          }}
        >
          One tap future access to
          Private Rides
        </div>

      </div>

      <button
        onClick={() =>
          setCerrarInstall(true)
        }
        style={{
          border: "none",
          background: "transparent",
          fontSize: 14,
          cursor: "pointer",
          color: "#999"
        }}
      >
        ×
      </button>

    </div>

    <button
      onClick={instalarApp}
      style={{
        width: "100%",

        marginTop: 16,

        padding: 14,

        borderRadius: 16,

        border: "none",

        background:
          "linear-gradient(145deg,#b19e36,#8f7d2d)",

        color: "#fff",

        fontWeight: "bold",

        fontSize: 15,

        cursor: "pointer"
      }}
    >

      Install Private Rides

    </button>

    {iosDevice && (

      <div
        style={{
          marginTop: 10,
          fontSize: 12,
          color: "#777",
          lineHeight: 1.5
        }}
      >

        iPhone:
        tap Share →
        Add to Home Screen

      </div>
    )}

  </div>
)}

///////////////////////////////////////////////panel de arriba 
  {/* BACKGROUND */}
  <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", backgroundImage:"url('/bg.png?v=2')", backgroundSize:"cover", backgroundPosition:"center", zIndex:-2 }} />

  {/* DARK OVERLAY */}
  <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(12,3,3,0.5)", zIndex:-1 }} />

  {/* MAIN */}
  <div style={{ position:"relative", zIndex:1, padding:20 }}>

    {/* HEADER */}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <h1 style={{ color:"#b19e36" }}>App Private Rides</h1>

      <button onClick={() => setOpenConfig(true)} style={{ background:"transparent", border:"none", fontSize:22, cursor:"pointer", color:"#fff" }}>
        ⚙️
      </button>
    </div>

    {/* NAME */}
    <input
      placeholder="Name"
      value={nombre}
      onChange={(e) => setNombre(e.target.value)}
      style={{ width:"100%", padding:8, background:"transparent", borderRadius:10, border:"1px solid #ccc", fontSize:16, color:"#fff" }}
    />

    {/* PHONE */}
    <input
      placeholder="Phone number"
      value={telefono}
      onChange={(e) => setTelefono(e.target.value)}
      style={{ width:"100%", padding:8, background:"transparent", borderRadius:10, border:"1px solid #ccc", fontSize:16, color:"#fff", marginTop:8 }}
    />

    {/* DATE */}
    <label style={{ color:"#fff" }}>Date & Time</label>

    <input
      type="datetime-local"
      value={fechaHora}
      onChange={(e) => setFechaHora(e.target.value)}
      style={{ width:"100%", padding:8, background:"transparent", borderRadius:10, border:"1px solid #ccc", fontSize:16, color:"#fff" }}
    />

    {/* PICKUP */}
    <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:8 }}>

      <Autocomplete
        onLoad={(ref) => (origenAutoRef.current = ref)}
        onPlaceChanged={() => {

          const place = origenAutoRef.current.getPlace();

          if (!place.geometry) return;

          setLatOrigen(place.geometry.location.lat());
          setLngOrigen(place.geometry.location.lng());

          setTimeout(() => {

            if (origenRef.current?.value && destinoRef.current?.value) {
              calcularRuta();
            }

          }, 300);
        }}
      >

        <input
          ref={origenRef}
          placeholder="Pickup location"
          style={{ width:"100%", padding:8, borderRadius:10, border:"1px solid #ccc", background:"transparent", color:"#fff" }}
        />

      </Autocomplete>

      <button
        style={btnGPS}
        onMouseDown={press3D}
        onMouseUp={(e) => release3D(e, "#000")}
        onMouseLeave={(e) => release3D(e, "#000")}
        onClick={obtenerUbicacion}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
        </svg>
      </button>

    </div>

    {/* DESTINATION */}
    <Autocomplete
      onLoad={(ref) => (destinoAutoRef.current = ref)}
      onPlaceChanged={() => {

        const place = destinoAutoRef.current.getPlace();

        if (!place.geometry) return;

        setLatDestino(place.geometry.location.lat());
        setLngDestino(place.geometry.location.lng());

        setTimeout(() => {

          if (origenRef.current?.value && destinoRef.current?.value) {
            calcularRuta();
          }

        }, 300);
      }}
    >

      <input
        ref={destinoRef}
        placeholder="Drop-off location"
        style={{ width:"100%", padding:8, borderRadius:10, border:"1px solid #ccc", background:"transparent", marginTop:6, color:"#fff" }}
      />

    </Autocomplete>

    {/* PRICE */}
    <div style={{ marginTop:10 }}>
      <p style={{ color:"#00ff99", margin:0 }}>Distance: {distancia.toFixed(2)} miles</p>
      <p style={{ color:"#00ff99", fontWeight:"bold", marginTop:4 }}>Price: ${precio.toFixed(2)}</p>
    </div>

    {/* ACTION BUTTONS */}
    <div style={{ display:"flex", gap:8, marginTop:12 }}>

    {/* CARD */}
<button

  onClick={() => {

    // 🔥 PRIMER TOQUE
    if (metodoPago !== "stripe") {

      setMetodoPago("stripe");

      return;
    }

    // 🔥 SEGUNDO TOQUE
    setMostrarCardModal(true);
  }}

  onMouseDown={press3D}

  onMouseUp={(e) =>
    release3D(e, "#000")
  }

  onMouseLeave={(e) =>
    release3D(e, "#000")
  }

  style={{
    ...btnPayment,

    flex: 1,

    margin: 0,

    padding: "10px 12px",

    background:
      metodoPago === "stripe"
        ? "linear-gradient(145deg,#007bff,#0056b3)"
        : "#1e1e1e",

    border:
      metodoPago === "stripe"
        ? "2px solid #00c6ff"
        : "1px solid #333",

    boxShadow:
      metodoPago === "stripe"
        ? "0 0 15px rgba(0,198,255,0.5)"
        : "0 5px 0 #000"
  }}
>

  {cardLast4
    ? `Card •••• ${cardLast4}`
    : "Card"}

</button>
      {/* CASH */}
      <button
        onClick={() => setMetodoPago("cash")}

        onMouseDown={press3D}
        onMouseUp={(e) => release3D(e, "#000")}
        onMouseLeave={(e) => release3D(e, "#000")}

        style={{
          ...btnPayment,
          flex:1,
          margin:0,
          padding:"10px 12px",
          background: metodoPago === "cash"
            ? "linear-gradient(145deg,#f39c12,#d35400)"
            : "#1e1e1e",
          border: metodoPago === "cash"
            ? "1px solid #f1c40f"
            : "1px solid #333"
        }}
      >
        Cash
      </button>

      {/* REQUEST */}
      <button
        onClick={reservar}
        disabled={loadingPago}

        onMouseDown={press3D}
        onMouseUp={(e) => release3D(e, "#145524")}
        onMouseLeave={(e) => release3D(e, "#145524")}
        onTouchStart={press3D}
        onTouchEnd={(e) => release3D(e, "#145524")}

        style={{
          ...btnRequest,
          flex:2,
          margin:0,
          padding:"10px 16px",
          opacity: loadingPago ? 0.7 : 1,
          cursor: loadingPago ? "not-allowed" : "pointer"
        }}
      >
        {loadingPago ? "Processing..." : "Request Ride"}
      </button>

    </div>

    {/* MAP MODE */}
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

    {/* MAP */}
    <div style={{ marginTop:15, borderRadius:20, overflow:"hidden", boxShadow:"0 10px 30px rgba(0,0,0,0.5)" }}>

      <GoogleMap
        mapContainerStyle={{ width:"100%", height:"50vh" }}
        center={miUbicacion || { lat:36.1699, lng:-115.1398 }}
        zoom={14}
        options={{ styles: modoOscuroMapa ? darkMapStyle : [] }}
      >

        {directions && <DirectionsRenderer directions={directions} />}
        {miUbicacion && <Marker position={miUbicacion} />}
        {driverUbicacion && <Marker position={driverUbicacion} />}

      </GoogleMap>

    </div>

    {/* FOOTER */}
    <div style={{ marginTop:20, marginBottom:20, display:"flex", justifyContent:"center", gap:16, fontSize:14 }}>

      <a href="/privacy" style={{ color:"#fff", textDecoration:"none" }}>
        Privacy Policy
      </a>

      <a href="/terms" style={{ color:"#fff", textDecoration:"none" }}>
        Terms of Service
      </a>

    </div>
{/* CARD MODAL */}
{mostrarCardModal && (

  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999
    }}
  >

    <div
      style={{
        width: "90%",
        maxWidth: 400,
        background: "#111",
        borderRadius: 20,
        padding: 20,
        color: "#fff"
      }}
    >

      <h2 style={{ marginTop: 0 }}>
        Payment Method
      </h2>

      {/* CARD NUMBER */}
      <div style={{ marginBottom: 14 }}>
        <label style={cardLabel}>
          Card Number
        </label>

        <div style={cardBox}>
          <CardNumberElement />
        </div>
      </div>

      {/* EXPIRATION */}
      <div style={{ marginBottom: 14 }}>
        <label style={cardLabel}>
          Expiration
        </label>

        <div style={cardBox}>
          <CardExpiryElement />
        </div>
      </div>

      {/* CVC */}
      <div style={{ marginBottom: 14 }}>
        <label style={cardLabel}>
          CVC
        </label>

        <div style={cardBox}>
          <CardCvcElement />
        </div>
      </div>

      {/* ZIP */}
      <input
        value={zipCode}

        onChange={(e) =>
          setZipCode(e.target.value)
        }

        placeholder="ZIP Code"

        style={{
          ...inputConfig,
          marginBottom: 16
        }}
      />

      {/* SAVE BUTTON */}
      <button

        onClick={async () => {

          try {

            if (!stripe || !elements) {
              return;
            }

            const cardNumber =
              elements.getElement(
                CardNumberElement
              );

            if (!cardNumber) {
              return;
            }

            const result =
              await stripe.createPaymentMethod({
                type: "card",

                card: cardNumber,

                billing_details: {
                  name: nombre,
                  phone: telefono,
                  email
                }
              });

            if (result.error) {

              alert(
                result.error.message
              );

              return;
            }

            if (!result.paymentMethod) {
              return;
            }

            // 🔥 SAVE STATES
            setPaymentMethodId(
              result.paymentMethod.id
            );

            setCardLast4(
              result.paymentMethod.card?.last4 || ""
            );

            setCardBrand(
              result.paymentMethod.card?.brand || ""
            );

            // 🔥 SAVE FIREBASE
            if (user) {

              await update(
                ref(
                  db,
                  "usuarios/" + user.uid
                ),
                {
                  paymentMethodId:
                    result.paymentMethod.id,

                  cardLast4:
                    result.paymentMethod.card?.last4 || "",

                  cardBrand:
                    result.paymentMethod.card?.brand || "",

                  updatedAt:
                    Date.now()
                }
              );
            }

            setMostrarCardModal(false);

            setCardGuardada(true);

            alert("Card saved");

          } catch (err) {

            console.error(err);

            alert(
              "Error saving card"
            );
          }
        }}

        style={{
          width: "100%",
          padding: 14,
          borderRadius: 14,
          border: "none",
          background:
            "linear-gradient(145deg,#007bff,#0056b3)",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >

        Save Card

      </button>

      {/* CLOSE */}
      <button

        onClick={() =>
          setMostrarCardModal(false)
        }

        style={{
          width: "100%",
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          border: "none",
          background: "#222",
          color: "#fff",
          cursor: "pointer"
        }}
      >

        Close

      </button>

    </div>

  </div>
)}
{/* CONFIG MODAL */}
{openConfig && (

  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999
    }}
  >

    <div
      style={{
        width: "90%",
        maxWidth: 400,
        background: "#111",
        borderRadius: 20,
        padding: 20,
        color: "#fff"
      }}
    >

      <h2>Profile Settings</h2>

      <input
        value={nombre}
        onChange={(e) =>
          setNombre(e.target.value)
        }
        placeholder="Name"
        style={{
          ...inputConfig,
          marginBottom: 12
        }}
      />

      <input
        value={telefono}
        onChange={(e) =>
          setTelefono(e.target.value)
        }
        placeholder="Phone"
        style={{
          ...inputConfig,
          marginBottom: 12
        }}
      />

      <input
        value={email}
        onChange={(e) =>
          setEmail(e.target.value)
        }
        placeholder="Email"
        style={{
          ...inputConfig,
          marginBottom: 16
        }}
      />

      <button

        onClick={async () => {

          try {

            if (!user) return;

            await update(
              ref(
                db,
                "usuarios/" + user.uid
              ),
              {
                nombre,
                telefono,
                email,
                updatedAt:
                  Date.now()
              }
            );

            setOpenConfig(false);

            alert(
              "Profile saved"
            );

          } catch (err) {

            console.error(err);

            alert(
              "Error saving profile"
            );
          }
        }}

        style={{
          width: "100%",
          padding: 14,
          borderRadius: 14,
          border: "none",
          background:
            "linear-gradient(145deg,#28a745,#1e7e34)",
          color: "#fff",
          fontWeight: "bold"
        }}
      >

        Save Profile

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
const cardBox = {

  padding: 14,

  border: "1px solid #ccc",

  borderRadius: 10,

  background: "#fff"
};

const cardLabel = {

  display: "block",

  fontSize: 13,

  marginBottom: 8,

  color: "#555",

  fontWeight: "bold"
};
// fix permissions.