"use client";
export const dynamic = "force-dynamic";

import { auth, db } from "@/lib/firebase";
import { googleMapsConfig } from "@/lib/googleMaps";

import {
  GoogleMap,
  Marker,
  Polyline,
  TrafficLayer,
  useJsApiLoader
} from "@react-google-maps/api";

import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref, update } from "firebase/database";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
} from "react";

const DEFAULT_CENTER = {
  lat: 36.1147,
  lng: -115.1728
};

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "greedy",
  clickableIcons: false,
  fullscreenControl: false,
  streetViewControl: false,
  mapTypeControl: false,
  rotateControl: true,
  tilt: 0,
  heading: 0,
  mapTypeId: "roadmap",
  mapId: "c7f305f9e66d61eb57ab057d",
  styles: [

  // ocultar negocios
  {
    featureType: "poi.business",
    stylers: [
      { visibility: "off" }
    ]
  },

  // ocultar restaurantes
  {
    featureType: "poi.attraction",
    stylers: [
      { visibility: "off" }
    ]
  },

  // ocultar tiendas
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [
      { visibility: "off" }
    ]
  },

  // ocultar transit innecesario
  {
    featureType: "transit",
    stylers: [
      { visibility: "off" }
    ]
  },

  // mantener carreteras limpias
  {
    featureType: "road",
    elementType: "labels",
    stylers: [
      { visibility: "simplified" }
    ]
  }
]
};

export default function DriverTrackingPage() {

  const { isLoaded } = useJsApiLoader(googleMapsConfig);

  const [viajeData, setViajeData] = useState<any>(null);

  const [driverPos, setDriverPos] = useState<any>(null);

 const [remainingPath, setRemainingPath] =
  useState<any[]>([]);

const [completedPath, setCompletedPath] =
  useState<any[]>([]);

  const [fase, setFase] = useState<"pickup" | "viaje">("pickup");

  const [etaPickup, setEtaPickup] = useState(0);

  const [etaDestino, setEtaDestino] = useState(0);

  const [loadingCancel, setLoadingCancel] = useState(false);


  const [viajeFinalizado, setViajeFinalizado] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);

  const watchRef = useRef<any>(null);

  const directionsRef = useRef<google.maps.DirectionsService | null>(null);
const [rutasAlternativas, setRutasAlternativas] = useState<any[][]>([]);
  const fullPathRef = useRef<any[]>([]);

  const lastInstructionRef = useRef("");

  const lastRouteTimeRef = useRef(0);
const lastFirebaseUpdateRef =
  useRef(0);
  const lastHeadingRef = useRef(0);
const lastCameraMoveRef =
  useRef(0);
const lastPositionRef =
  useRef<any>(null);
  const [mapReady, setMapReady] =
  useState(false);

  // ---------------------------------------------------
  // UTILIDADES
  // ---------------------------------------------------

  const speak = useCallback((text: string) => {

    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const msg = new SpeechSynthesisUtterance(text);

    msg.lang = "es-US";

    msg.rate = 1;

    window.speechSynthesis.speak(msg);

  }, []);

  const toRad = (x: number) => x * Math.PI / 180;

  const calcularDistancia = (a: any, b: any) => {

    const R = 6371000;

    const dLat = toRad(b.lat - a.lat);

    const dLng = toRad(b.lng - a.lng);

    const aa =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  };

  const limpiarTexto = (html: string) => {
    return html.replace(/<[^>]+>/g, "").trim();
  };
  const calcularHeading = (
  from: any,
  to: any
) => {

  const dLon =
    (to.lng - from.lng) *
    Math.PI / 180;

  const lat1 =
    from.lat * Math.PI / 180;

  const lat2 =
    to.lat * Math.PI / 180;

  const y =
    Math.sin(dLon) *
    Math.cos(lat2);

  const x =
    Math.cos(lat1) *
    Math.sin(lat2) -

    Math.sin(lat1) *
    Math.cos(lat2) *
    Math.cos(dLon);

  let brng =
    Math.atan2(y, x);

  brng =
    brng * 180 / Math.PI;

  return (brng + 360) % 360;
};

  // ---------------------------------------------------
// AUTH
// ---------------------------------------------------

useEffect(() => {

  const unsub = onAuthStateChanged(
    auth,
    (user) => {

      if (!user) {
        window.location.href = "/login";
      }
    }
  );

  return () => {
    unsub();
  };

}, []);
  // ---------------------------------------------------
  // FIREBASE
  // ---------------------------------------------------

  useEffect(() => {

    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) return;

    const viajeRef = ref(db, "viajes/" + id);

    const unsub = onValue(viajeRef, (snap) => {

      const d = snap.val();

      if (!d) return;

      setViajeData(d);

      const nuevaFase =
        d.estado === "En viaje"
          ? "viaje"
          : "pickup";

      setFase(nuevaFase);

      if (
        d.estado === "Finalizado" ||
        d.estado === "Cancelado"
      ) {

        setViajeFinalizado(true);

        if (watchRef.current) {
          navigator.geolocation.clearWatch(watchRef.current);
        }

        if (d.estado === "Cancelado") {
          alert("Viaje cancelado");
          window.location.replace("/driver");
        }
      }
    });

    return () => unsub();

  }, []);

  // ---------------------------------------------------
  // ENCONTRAR PUNTO MÁS CERCANO
  // ---------------------------------------------------

  const getClosestPointIndex = useCallback((
    currentPos: any,
    route: any[]
  ) => {

    let min = Infinity;

    let index = 0;

    for (let i = 0; i < route.length; i++) {

      const dist = calcularDistancia(currentPos, route[i]);

      if (dist < min) {
        min = dist;
        index = i;
      }
    }

    return index;

  }, []);

  // ---------------------------------------------------
// SOLICITAR RUTA (Con Alternativas)
// ---------------------------------------------------

const solicitarRuta = useCallback((
  origin: any,
  destination: any,
  force = false
) => {
  if (!directionsRef.current) return;
  const now = Date.now();

  if (!force && now - lastRouteTimeRef.current < 15000) return;
  lastRouteTimeRef.current = now;

  directionsRef.current.route(
    {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true, // 🔥 Activado para ver otras rutas
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      },
    },
    (res, status) => {
      if (status !== "OK" || !res) return;

      // --- RUTA PRINCIPAL (Índice 0) ---
      const leg = res.routes[0].legs[0];
      const points = res.routes[0].overview_path.map((p) => ({ 
        lat: p.lat(), 
        lng: p.lng() 
      }));

      fullPathRef.current = points;
      setRemainingPath(points);
      setCompletedPath([]);

      // --- RUTAS ALTERNATIVAS (Las demás) ---
      const alternativas = res.routes.slice(1).map(ruta => 
        ruta.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }))
      );
      setRutasAlternativas(alternativas);

      // --- CÁLCULO DE ETA (Siempre basado en la principal) ---
      const durationValue = leg.duration_in_traffic?.value || leg.duration?.value || 0;
      const durationText = leg.duration_in_traffic?.text || leg.duration?.text || "Arriving...";

      if (fase === "pickup") setEtaPickup(durationValue);
      else setEtaDestino(durationValue);

      // 🔥 Escribir ETA en Firebase para el usuario
      if (viajeData?.id) {
        update(ref(db, "viajes/" + viajeData.id), {
          driverEta: durationText,
          updatedAt: Date.now()
        }).catch(console.error);
      }

      // --- VOZ INTELIGENTE (Solo para la principal) ---
      const nextStep = leg.steps.find((step) => {
        const start = {
          lat: step.start_location.lat(),
          lng: step.start_location.lng()
        };
        const dist = calcularDistancia(origin, start);
        return dist < 120;
      }) || leg.steps[0];

      if (!nextStep) return;

      const instruction = limpiarTexto(nextStep.instructions);
      const important =
        instruction.includes("derecha") ||
        instruction.includes("izquierda") ||
        instruction.includes("carril") ||
        instruction.includes("sal") ||
        instruction.includes("rotonda");

      if (
        important &&
        instruction !== lastInstructionRef.current &&
        (nextStep.distance?.value || 0) < 140
      ) {
        lastInstructionRef.current = instruction;
        speak(instruction);
      }
    }
  );
}, [fase, speak, viajeData?.id]);

  // ---------------------------------------------------
  // GPS PRINCIPAL
  // ---------------------------------------------------

  useEffect(() => {

    if (!isLoaded || !viajeData) return;

    if (!directionsRef.current) {
      directionsRef.current =
        new google.maps.DirectionsService();
    }

    const target =
      fase === "pickup"
        ? {
            lat: Number(viajeData.origenLat),
            lng: Number(viajeData.origenLng)
          }
        : {
            lat: Number(viajeData.destinoLat),
            lng: Number(viajeData.destinoLng)
          };

    watchRef.current =
      navigator.geolocation.watchPosition(

        async (position) => {

         const nuevaPos = {
  lat: position.coords.latitude,
  lng: position.coords.longitude
};

/// ---------------------------------------------------
// IGNORAR MICRO MOVIMIENTOS GPS
// ---------------------------------------------------

if (lastPositionRef.current) {

  const movement =
    calcularDistancia(
      lastPositionRef.current,
      nuevaPos
    );

  // 🔥 ignorar ruido GPS
  if (movement < 8) {
    return;
  }
}

// ---------------------------------------------------
// ACTUALIZAR POSICIÓN
// ---------------------------------------------------

setDriverPos(nuevaPos);

// ---------------------------------------------------
// FIREBASE THROTTLE
// ---------------------------------------------------

const uid = auth.currentUser?.uid;

const now = Date.now();

if (
  uid &&
  now - lastFirebaseUpdateRef.current > 8000
) {

  lastFirebaseUpdateRef.current =
    now;

  Promise.all([

    // 🔥 DRIVER STATUS
    update(
      ref(db, "drivers/" + uid),
      {
        ...nuevaPos,
        lastSeen: now
      }
    ),

    // 🔥 VIAJE TRACKING
    viajeData?.id
      ? update(
          ref(
            db,
            "viajes/" +
              viajeData.id
          ),
          {
            driverLat:
              nuevaPos.lat,

            driverLng:
              nuevaPos.lng,

            updatedAt: now
          }
        )
      : Promise.resolve()

  ]).catch(console.error);
}

// ---------------------------------------------------
// CÁMARA SUAVE UBER STYLE
// ---------------------------------------------------

if (mapRef.current) {

  let heading =
    lastHeadingRef.current;

  // 🔥 CALCULAR DIRECCIÓN REAL
  // usando posición ANTERIOR
  if (lastPositionRef.current) {

    heading =
      calcularHeading(
        lastPositionRef.current,
        nuevaPos
      );
  }

  // 🔥 EVITAR VIBRACIÓN
  // CUANDO EL AUTO ESTÁ CASI PARADO
  if (
    position.coords.speed &&
    position.coords.speed > 1
  ) {

    lastHeadingRef.current =
      heading;
  }

  // ---------------------------------------------------
  // THROTTLE CÁMARA
  // ---------------------------------------------------

  const nowCamera =
    Date.now();

  if (
    nowCamera -
    lastCameraMoveRef.current > 1200
  ) {

    lastCameraMoveRef.current =
      nowCamera;

    mapRef.current.moveCamera({

      center: nuevaPos,

      heading:
        lastHeadingRef.current,

      zoom: 17,

      tilt: 0
    });
  }
}

// ---------------------------------------------------
// GUARDAR POSICIÓN ACTUAL
// ---------------------------------------------------

lastPositionRef.current =
  nuevaPos;
// ---------------------------------------------------
// PRIMERA RUTA
// ---------------------------------------------------

if (!fullPathRef.current.length) {

  solicitarRuta(
    nuevaPos,
    target,
    true
  );
}

// ---------------------------------------------------
// BORRAR RUTA RECORRIDA
// ---------------------------------------------------

if (fullPathRef.current.length > 0) {

  const index =
    getClosestPointIndex(
      nuevaPos,
      fullPathRef.current
    );

  // 🔥 ruta restante
const remaining =
  fullPathRef.current.slice(index);

// 🔥 ruta completada
const completed =
  fullPathRef.current.slice(0, index);

setRemainingPath(remaining);

setCompletedPath(completed);
// 🔥 SINCRONIZAR RUTA USER
if (viajeData?.id) {

  update(
    ref(
      db,
      "viajes/" + viajeData.id
    ),
    {

      remainingPath: remaining,

      completedPath: completed
    }
  ).catch(console.error);
}
  // ---------------------------------------------------
  // DESVIACIÓN REAL
  // ---------------------------------------------------

  const desviacion =
    calcularDistancia(
      nuevaPos,
      fullPathRef.current[index]
    );

  // 🔥 SOLO RECALCULAR SI REALMENTE
  // SE DESVIÓ DE LA RUTA
  if (desviacion > 180) {

    solicitarRuta(
      nuevaPos,
      target,
      true
    );
  }
}

        },

        (err) => console.error(err),

        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 15000
        }
      );

    return () => {

  // detener GPS
  if (watchRef.current) {

    navigator.geolocation.clearWatch(
      watchRef.current
    );
  }

  // limpiar rutas
  fullPathRef.current = [];

  setRemainingPath([]);

setCompletedPath([]);

  // detener voz
  window.speechSynthesis.cancel();
};

  }, [
    isLoaded,
    viajeData,
    fase,
    solicitarRuta,
    getClosestPointIndex
  ]);

  // ---------------------------------------------------
  // BOTONES
  // ---------------------------------------------------

  const btn = (bg: string) => ({
    padding: 9,
    borderRadius: 9,
    fontSize: 10,
    fontWeight: "bold",
    border: "none",
    background: bg,
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.12s ease",
    boxShadow: "0 4px 0 rgba(0,0,0,0.2)"
  });

  const press = (e: any) => {
   e.currentTarget.style.transform =
  "translateY(3px) scale(0.96)";
  };

  const release = (e: any) => {
    e.currentTarget.style.transform =
  "translateY(0px) scale(1)";
  };

  // ---------------------------------------------------
  // FINALIZAR
  // ---------------------------------------------------

  const finalizar = async (id: string) => {

    try {

      if (
        driverPos &&
        viajeData.destinoLat
      ) {

        const dist = calcularDistancia(
          driverPos,
          {
            lat: Number(viajeData.destinoLat),
            lng: Number(viajeData.destinoLng)
          }
        );

        if (
          dist > 200 &&
          !window.confirm(
            "⚠️ No pareces estar en el destino todavía. ¿Finalizar?"
          )
        ) {
          return;
        }
      }

      const token =
        await auth.currentUser?.getIdToken();

      const res = await fetch(
        "/api/finalizar-viaje",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({
            viajeId: id
          })
        }
      );

      if (res.ok) {
        window.location.href = "/driver";
      }

    } catch (err) {
      console.error(err);
      alert("Error al finalizar");
    }
  };

  // ---------------------------------------------------
  // CANCELAR
  // ---------------------------------------------------

  const cancelar = async () => {

    if (loadingCancel) return;

    setLoadingCancel(true);

    try {

      const id =
        new URLSearchParams(
          window.location.search
        ).get("id");

      const token =
        await auth.currentUser?.getIdToken();

      const res = await fetch(
        "/api/cancelar-viaje-driver",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            viajeId: id
          })
        }
      );

      if (res.ok) {
        window.location.replace("/driver");
      }

    } finally {
      setLoadingCancel(false);
    }
  };

  // ---------------------------------------------------
  // ETA
  // ---------------------------------------------------

  const etaActual = useMemo(() => {

    return fase === "pickup"
      ? etaPickup
      : etaDestino;

  }, [fase, etaPickup, etaDestino]);

  // ---------------------------------------------------
  // LOAD
  // ---------------------------------------------------

 const handleLoad = useCallback((
  map: google.maps.Map
) => {

  mapRef.current = map;

  setTimeout(() => {
    setMapReady(true);
  }, 1200);

}, []);

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  if (!isLoaded) {
    return <div>Cargando mapa...</div>;
  }

  if (viajeFinalizado) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#111",
          color: "#fff"
        }}
      >
        <h1>Viaje Terminado</h1>
      </div>
    );
  }

  return (

    <div
      style={{
        height: "100vh",
        position: "relative"
      }}
    >

     <GoogleMap
  onLoad={handleLoad}

  mapContainerStyle={{
    width: "100%",
    height: "100%"
  }}

  center={driverPos || DEFAULT_CENTER}

  zoom={18}

  options={{
    ...MAP_OPTIONS,

    rotateControl: true,

    tilt: 0,

    heading:
      lastHeadingRef.current
  }}
>
  {/* 1. RUTAS ALTERNATIVAS (Gris Claro) */}
  {rutasAlternativas.map((ruta, index) => (
    <Polyline
      key={`alt-${index}`}
      path={ruta}
      options={{
        strokeColor: "#D3D3D3", // Gris claro
        strokeOpacity: 0.6,
        strokeWeight: 4,
        zIndex: 5, // Menor que la principal
      }}
    />
  ))}

  {/* 2. RUTA COMPLETADA (Gris oscuro/medio) */}
  {completedPath.length > 0 && (
    <Polyline
      path={completedPath}
      options={{ strokeColor: "#888", strokeOpacity: 0.5, strokeWeight: 5, zIndex: 1 }}
    />
  )}

  {/* 3. RUTA RESTANTE PRINCIPAL (Azul) */}
  {remainingPath.length > 0 && (
    <Polyline
      path={remainingPath}
      options={{
        strokeColor: "#1976FF",
        strokeOpacity: 0.95,
        strokeWeight: 6,
        zIndex: 10, // Encima de todas
      }}
    />
  )}

  {/* --------------------------------------------------- */}
  {/* TRÁFICO EN TIEMPO REAL */}
  {/* --------------------------------------------------- */}

  {mapReady && <TrafficLayer />}

  {/* --------------------------------------------------- */}
{/* RUTA RECORRIDA */}
{/* --------------------------------------------------- */}

{completedPath.length > 0 && (

  <Polyline
    path={completedPath}

    options={{

      strokeColor: "#d9d9d9",

      strokeOpacity: 0.7,

      strokeWeight: 5,

      zIndex: 1
    }}
  />
)}

{/* --------------------------------------------------- */}
{/* RUTA RESTANTE */}
{/* --------------------------------------------------- */}

{remainingPath.length > 0 && (

  <Polyline
    path={remainingPath}

    options={{

      strokeColor: "#1976FF",

      strokeOpacity: 0.95,

      strokeWeight: 6,

      geodesic: true,

      zIndex: 10
    }}
  />
)}

  {/* --------------------------------------------------- */}
  {/* DRIVER */}
  {/* --------------------------------------------------- */}

  {driverPos && (

  <>
    {/* aro blanco */}

    <Marker
      position={driverPos}

      icon={{

        path:
          google.maps.SymbolPath.CIRCLE,

        scale: 13,

        fillColor: "#fff",

        fillOpacity: 1,

        strokeColor: "#000",

        strokeWeight: 3
      }}
    />

    {/* flecha interna */}

   <Marker
  position={driverPos}

  icon={{

    path:
      google.maps.SymbolPath
        .FORWARD_CLOSED_ARROW,

    scale: 3,

    fillColor: "#0a0a0a",

    fillOpacity: 1,

    strokeColor: "#0a0a0a",

    strokeWeight: 1,

    rotation:
      lastHeadingRef.current,

    anchor:
      new google.maps.Point(0, 2)
  }}
/>
  </>
)}

  {/* --------------------------------------------------- */}
  {/* PICKUP */}
  {/* --------------------------------------------------- */}

  {fase === "pickup" &&
    viajeData?.origenLat && (

      <Marker
        position={{
          lat: Number(
            viajeData.origenLat
          ),

          lng: Number(
            viajeData.origenLng
          )
        }}
      />
  )}

  {/* --------------------------------------------------- */}
  {/* DESTINO */}
  {/* --------------------------------------------------- */}

  {fase === "viaje" &&
    viajeData?.destinoLat && (

      <Marker
        position={{
          lat: Number(
            viajeData.destinoLat
          ),

          lng: Number(
            viajeData.destinoLng
          )
        }}
      />
  )}

</GoogleMap>

      {/* PANEL */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          background: "#fff",
          padding: 16,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow:
            "0 -2px 10px rgba(0,0,0,0.1)"
        }}
      >

        {viajeData?.metodoPago === "cash" &&
          !viajeData?.pagado && (
            <div
              style={{
                background: "#ff0000",
                color: "#fff",
                padding: 10,
                borderRadius: 10,
                marginBottom: 10,
                textAlign: "center",
                fontWeight: "bold"
              }}
            >
              💵 COBRAR EN EFECTIVO
            </div>
          )}

        <h3>
          {fase === "pickup"
            ? "🚗 En camino al cliente"
            : "🚗 En viaje al destino"}
        </h3>

        <p
          style={{
            fontSize: "1.2rem",
            fontWeight: "bold"
          }}
        >
          {etaActual > 0
            ? `${Math.ceil(
                etaActual / 60
              )} min`
            : "Calculando..."}
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap"
          }}
        >

         {fase === "viaje" && (
  <button
    style={btn("#007bff")}
    onMouseDown={press}
    onMouseUp={release}
    onClick={() =>
      finalizar(viajeData.id)
    }
  >
    ✅ Finalizar
  </button>
)}

          {fase === "pickup" && (
  <button
    style={btn("#dc3545")}
    onMouseDown={press}
    onMouseUp={release}
    onClick={cancelar}
  >
    ❌ Cancelar
  </button>
)}

        {fase === "pickup" && (
  <button
    style={btn("#ffc107")}
    onMouseDown={press}
    onMouseUp={release}
    onClick={async () => {
      try {
        // 1. 📍 VALIDAR DISTANCIA PICKUP
        if (driverPos && viajeData?.origenLat && viajeData?.origenLng) {
          const distancia = calcularDistancia(driverPos, {
            lat: Number(viajeData.origenLat),
            lng: Number(viajeData.origenLng),
          });

          // ⚠️ ADVERTENCIA si está lejos
          if (distancia > 120) {
            const ok = window.confirm(
              "⚠️ Pareces lejos del punto de recogida.\n\n¿Deseas continuar?"
            );
            if (!ok) return;
          }
        }

        // 2. 🔐 OBTENER TOKEN
        const token = await auth.currentUser?.getIdToken();

        // 3. 🚗 API: CAMBIAR ESTADO A "EN VIAJE"
        const res = await fetch("/api/en-viaje", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            viajeId: viajeData.id,
          }),
        });

        // ❌ MANEJO DE ERROR API
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Error iniciando trayecto");
          return;
        }

        // 🔥 CORRECCIÓN: ACTUALIZACIÓN INMEDIATA SIN REFRESCAR 🔥

        // A. Cambiamos la fase local para que el render reaccione
        setFase("viaje");

        // B. Limpiamos rutas viejas (de pickup)
        fullPathRef.current = [];
        setRemainingPath([]);
        setCompletedPath([]);

        // C. Forzamos la solicitud de la nueva ruta al DESTINO
        if (driverPos && viajeData?.destinoLat) {
          const nuevoDestino = {
            lat: Number(viajeData.destinoLat),
            lng: Number(viajeData.destinoLng),
          };

          // Llamamos con 'true' para ignorar el límite de tiempo (throttle)
          solicitarRuta(driverPos, nuevoDestino, true);
        }

      } catch (err) {
        console.error(err);
        alert("Error iniciando viaje");
      }
    }}
  >
    📍 Recoger
  </button>
)}

          <button
            style={btn("#25D366")}
            onClick={() => {

              const tel =
                "1" +
                String(
                  viajeData.telefono
                ).replace(/\D/g, "");

              window.open(
                `https://wa.me/${tel}?text=Estoy fuera`,
                "_blank"
              );
            }}
          >
            💬 WhatsApp
          </button>

          <button
            style={btn("#4285F4")}
            onClick={() => {

              const destino =
                fase === "pickup"
                  ? `${viajeData.origenLat},${viajeData.origenLng}`
                  : `${viajeData.destinoLat},${viajeData.destinoLng}`;

              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`,
                "_blank"
              );

            }}
          >
            🧭 Google Maps
          </button>

        </div>

      </div>

    </div>
  );
}