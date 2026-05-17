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
  const [
  distanciaPickup,
  setDistanciaPickup
] = useState(0);

const [
  distanciaDestino,
  setDistanciaDestino
] = useState(0);

  const [loadingCancel, setLoadingCancel] = useState(false);


  const [viajeFinalizado, setViajeFinalizado] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);

  const watchRef = useRef<any>(null);

  const directionsRef = useRef<google.maps.DirectionsService | null>(null);
const [rutasAlternativas, setRutasAlternativas] = useState<any[][]>([]);
  const fullPathRef = useRef<any[]>([]);
const lastRouteIndexRef =
  useRef(0);
  const lastPathUpdateRef =
  useRef(0);
  const lastInstructionRef = useRef("");
const [steps, setSteps] =
  useState<any[]>([]);

const currentStepIndexRef =
  useRef(0);
const lastEtaUpdateRef =
  useRef(0);
const reroutingRef =
  useRef(false);

const lastVoiceTimeRef =
  useRef(0);
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

  const speak = useCallback((
  text: string
) => {

  if (
    !window.speechSynthesis
  ) return;

  if (
    window.speechSynthesis.speaking
  ) return;

  const msg =
    new SpeechSynthesisUtterance(
      text
    );

  msg.lang = "es-ES";

  msg.rate = 0.95;

  msg.pitch = 1;

  window.speechSynthesis.speak(
    msg
  );

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
const calcularEtaLocal =
(
  distanciaMetros: number
) => {

  // velocidad promedio urbana
  const velocidad =
    11.11;

  return Math.round(
    distanciaMetros /
    velocidad
  );
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
// DISPLEY ON//
useEffect(() => {

  let wakeLock: any = null;

  const activarWakeLock = async () => {

    try {

      if (
        "wakeLock" in navigator
      ) {

        wakeLock =
          await navigator.wakeLock.request(
            "screen"
          );

        console.log(
          "Wake Lock activo"
        );

        // 🔥 Si la pantalla vuelve
        // a estar visible
        document.addEventListener(
          "visibilitychange",
          async () => {

            if (
              wakeLock !== null &&
              document.visibilityState ===
                "visible"
            ) {

              wakeLock =
                await navigator.wakeLock.request(
                  "screen"
                );
            }
          }
        );
      }

    } catch (err) {

      console.error(
        "Wake Lock error",
        err
      );
    }
  };

  activarWakeLock();

  return () => {

    if (wakeLock) {

      wakeLock.release();
    }
  };

}, []);

  // ---------------------------------------------------
  // FIREBASE
  // ---------------------------------------------------

 useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return;

  const viajeRef = ref(db, "viajes/" + id);

  const unsub = onValue(viajeRef, (snap) => {
    const d = snap.val();
    if (!d) return;

    // 1. Sincronizar datos del viaje
    setViajeData({ ...d }); 

    // 2. Sincronizar Fase (Importante para la ruta)
    // Si el estado en Firebase cambia a "En viaje", la fase DEBE ser "viaje"
    const nuevaFase = d.estado === "En viaje" ? "viaje" : "pickup";
    
    setFase((prevFase) => {
      // Solo actualizamos si realmente cambió para evitar re-renders infinitos
      if (prevFase !== nuevaFase) {
        // Al cambiar de fase desde Firebase, reseteamos la ruta para que el GPS pida la nueva
        fullPathRef.current = []; 
        return nuevaFase;
      }
      return prevFase;
    });

    // 3. Manejo de fin de viaje
    if (
  d.estado === "Finalizado" ||
  d.estado === "Cancelado"
) {

  setViajeFinalizado(true);

  if (watchRef.current) {

    navigator.geolocation.clearWatch(
      watchRef.current
    );
  }

  const uid = auth.currentUser?.uid;

  if (uid) {

    update(
      ref(db, "drivers/" + uid),
      {
        viajeActivo: null
      }
    ).catch(console.error);
  }

  if (d.estado === "Cancelado") {

    alert("Viaje cancelado");

    window.location.replace(
      "/driver"
    );
  }
}
  });

  return () => unsub();
}, []); // Se mantiene [] porque el ID viene de la URL y no cambiará durante la sesión
  

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
  force = false,
  faseActualOverride?: "pickup" | "viaje" // Añadimos este parámetro opcional
) => {
  if (!directionsRef.current) return;
  const now = Date.now();

 if (!force && now - lastRouteTimeRef.current < 60000) return;
  lastRouteTimeRef.current = now;

  directionsRef.current.route(
    {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      },
    },
    (res, status) => {
      if (status !== "OK" || !res) return;

      // --- RUTA PRINCIPAL (Índice 0) ---
      const leg = res.routes[0].legs[0];
      setSteps(leg.steps || []);

      if (
  JSON.stringify(
    leg.steps
  ) ===
  JSON.stringify(steps)
) return;

currentStepIndexRef.current = 0;
     const points =
  res.routes[0]
    .overview_path
    .filter(
      (_: any, i: number) =>
        i % 4 === 0
    )
    .map((p) => ({
      lat: p.lat(),
      lng: p.lng()
    }));

      fullPathRef.current = points;
      lastRouteIndexRef.current = 0;
      setRemainingPath(points);
      setCompletedPath([]);

      // 🔥 SINCRONIZAR RUTA AL CLIENTE
if (viajeData?.id) {

  update(
    ref(
      db,
      "viajes/" + viajeData.id
    ),
    {

      remainingPath: points,

      completedPath: []
    }
  ).catch(console.error);
}

      // --- RUTAS ALTERNATIVAS (Las demás) ---
      const alternativas = res.routes.slice(1).map(ruta => 
        ruta.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }))
      );
      setRutasAlternativas(alternativas);

      // --- CÁLCULO DE ETA (Siempre basado en la principal) ---
      const durationValue = leg.duration_in_traffic?.value || leg.duration?.value || 0;
      const durationText = leg.duration_in_traffic?.text || leg.duration?.text || "Arriving...";
      const distanceValue =
       leg.distance?.value || 0;
     if (fase === "pickup") {

  setEtaPickup(
    durationValue
  );

  setDistanciaPickup(
    distanceValue
  );

} else {

  setEtaDestino(
    durationValue
  );

  setDistanciaDestino(
    distanceValue
  );
}

      // 🔥 Escribir ETA en Firebase para el usuario
      if (viajeData?.id) {
        update(ref(db, "viajes/" + viajeData.id), {
          driverEta: durationText,
          updatedAt: Date.now()
        }).catch(console.error);
      }
} // ← cierre callback route

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

// ---------------------------------------------------
// IGNORAR MICRO MOVIMIENTOS GPS
// ---------------------------------------------------

let gpsNoise = false;

if (lastPositionRef.current) {

  const movement =
    calcularDistancia(
      lastPositionRef.current,
      nuevaPos
    );

  // 🔥 ignorar ruido GPS
  gpsNoise =
    movement < 25;
}

// ---------------------------------------------------
// ACTUALIZAR POSICIÓN SUAVE
// ---------------------------------------------------

setDriverPos((prev: any) => {

  if (!prev) {
    return nuevaPos;
  }

  return {

    lat:
      prev.lat +
      (
        nuevaPos.lat -
        prev.lat
      ) * 0.22,

    lng:
      prev.lng +
      (
        nuevaPos.lng -
        prev.lng
      ) * 0.22
  };
});
// ---------------------------------------------------
// FIREBASE THROTTLE
// ---------------------------------------------------

const uid = auth.currentUser?.uid;

const now = Date.now();

if (
  uid &&
  now - lastFirebaseUpdateRef.current > 20000
) {

  lastFirebaseUpdateRef.current =
    now;

  Promise.all([

    // 🔥 DRIVER STATUS
   update(
  ref(db, "drivers/" + uid),
  {

    ...nuevaPos,

    lastSeen: now,

    activo: true,

    online: true,

    tracking: true
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

if (
  mapRef.current &&
  mapReady
) {

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
    lastCameraMoveRef.current > 5000
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
// 🔥 TURN BY TURN VOICE
// ---------------------------------------------------

const currentStep =

  steps[
    currentStepIndexRef.current
  ];

if (currentStep) {

  const start = {

    lat:
      currentStep
        .start_location.lat(),

    lng:
      currentStep
        .start_location.lng()
  };

  const distanceToStep =

    calcularDistancia(
      nuevaPos,
      start
    );

  const instruction =

    limpiarTexto(
      currentStep.instructions
    );

  const nowVoice =
    Date.now();

  // ---------------------------------------------------
  // 🔥 AVISO PREVIO
  // ---------------------------------------------------

  if (

    distanceToStep < 120 &&

    distanceToStep > 40 &&

    nowVoice -
      lastVoiceTimeRef.current >
      8000 &&

    instruction !==
      lastInstructionRef.current

  ) {

    lastVoiceTimeRef.current =
      nowVoice;

    lastInstructionRef.current =
      instruction;

    speak(
      "En breve, " +
      instruction
    );
  }

  // ---------------------------------------------------
  // 🔥 GIRO INMEDIATO
  // ---------------------------------------------------

  if (

    distanceToStep <= 40 &&

    nowVoice -
      lastVoiceTimeRef.current >
      4000

  ) {

    lastVoiceTimeRef.current =
      nowVoice;

    speak(instruction);

    // 🔥 avanzar step
    currentStepIndexRef.current += 1;
  }
}
// ---------------------------------------------------
// PRIMERA RUTA
// ---------------------------------------------------
// 🔥 evitar rerender pesado
if (gpsNoise) {

  // PERO sí actualizar Firebase
  // y presencia online

} else {

if (!fullPathRef.current.length) {

 
  // 🔥 ruta completa
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

  // ---------------------------------------------------
  // AVANCE REAL SOBRE LA RUTA
  // ---------------------------------------------------

  const closestIndex =
    getClosestPointIndex(
      nuevaPos,
      fullPathRef.current
    );

  // 🔥 NUNCA RETROCEDER
  const index = Math.max(
    lastRouteIndexRef.current,
    closestIndex
  );

  lastRouteIndexRef.current =
    index;

  // ---------------------------------------------------
  // RUTA RESTANTE
  // ---------------------------------------------------

  const remaining =
    fullPathRef.current.slice(index);

  // ---------------------------------------------------
  // RUTA COMPLETADA
  // ---------------------------------------------------

  const completed =
    fullPathRef.current.slice(
      0,
      Math.max(0, index)
    );

  setRemainingPath(remaining);

  setCompletedPath(completed);

  // ---------------------------------------------------
  // ETA LOCAL GRATIS
  // ---------------------------------------------------

  const distanciaRestante =
    remaining.reduce(
      (
        total,
        point,
        i
      ) => {

        if (i === 0)
          return 0;

        return (
          total +
          calcularDistancia(
            remaining[i - 1],
            point
          )
        );
      },
      0
    );

  const etaLocal =
    calcularEtaLocal(
      distanciaRestante
    );

  if (fase === "pickup") {

    setEtaPickup(
      etaLocal
    );

  } else {

    setEtaDestino(
      etaLocal
    );
  }

  // ---------------------------------------------------
  // FIREBASE THROTTLE PATH
  // ---------------------------------------------------

  if (viajeData?.id) {

    const nowPath =
      Date.now();

    if (

      nowPath -
      lastPathUpdateRef.current >

      30000

    ) {

      lastPathUpdateRef.current =
        nowPath;

      update(
        ref(
          db,
          "viajes/" +
          viajeData.id
        ),
        {

          remainingPath:
            remaining,

          completedPath:
            completed
        }
      ).catch(
        (err: any) =>
          console.error(err)
      );
    }
  }

  // ---------------------------------------------------
  // DESVIACIÓN REAL
  // ---------------------------------------------------

  const desviacion =
    calcularDistancia(
      nuevaPos,
      fullPathRef.current[index]
    );

  // ---------------------------------------------------
  // REROUTE INTELIGENTE
  // ---------------------------------------------------

  const nowReroute =
    Date.now();

  if (

    desviacion > 450 &&

    nowReroute -
      lastRouteTimeRef.current >

      60000

  ) {

    if (!reroutingRef.current) {

      reroutingRef.current =
        true;

      speak(
        "Recalculando ruta"
      );
    }

    solicitarRuta(
      nuevaPos,
      target,
      true
    );

    setTimeout(() => {

      reroutingRef.current =
        false;

    }, 10000);
  }
}}
        },

        (err) => console.error(err),

        {
           enableHighAccuracy:
            fase === "viaje",
          maximumAge: 15000,
          timeout: 15000
        }
      );

     

    return () => {

      const uid =
  auth.currentUser?.uid;

if (uid) {

  update(
    ref(db, "drivers/" + uid),
    {

      tracking: false,

      lastSeen: Date.now()
    }
  ).catch(console.error);
}

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
        speak(
  "Has llegado al destino"
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

  const uid = auth.currentUser?.uid;

  if (uid) {

    await update(
      ref(db, "drivers/" + uid),
      {
        viajeActivo: null
      }
    );
  }

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

  const uid = auth.currentUser?.uid;

  if (uid) {

    await update(
      ref(db, "drivers/" + uid),
      {
        viajeActivo: null
      }
    );
  }

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
  const distanciaActual = useMemo(() => {

  return fase === "pickup"

    ? distanciaPickup

    : distanciaDestino;

}, [
  fase,
  distanciaPickup,
  distanciaDestino
]);

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
    <div style={{ height: "100vh", position: "relative", background: "#000", fontFamily: "sans-serif" }}>
      {/* --------------------------------------------------- */}
      {/* MAPA DE GOOGLE */}
      {/* --------------------------------------------------- */}
      <GoogleMap
        onLoad={handleLoad}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={driverPos || DEFAULT_CENTER}
        zoom={18}
        options={{
          ...MAP_OPTIONS,
          rotateControl: false,
          tilt: 45, // Un poco de inclinación da un look más moderno
          heading: lastHeadingRef.current,
          disableDefaultUI: true,
        }}
      >
        {/* RUTAS ALTERNATIVAS */}
        {rutasAlternativas.map((ruta, index) => (
          <Polyline
            key={`alt-${index}`}
            path={ruta}
            options={{ strokeColor: "#D3D3D3", strokeOpacity: 0.4, strokeWeight: 4, zIndex: 5 }}
          />
        ))}

        {/* RUTA COMPLETADA */}
        {completedPath.length > 0 && (
          <Polyline
            path={completedPath}
            options={{ strokeColor: "#888", strokeOpacity: 0.5, strokeWeight: 5, zIndex: 1 }}
          />
        )}

        {/* RUTA PRINCIPAL (AZUL LUXURY) */}
        {remainingPath.length > 0 && (
          <Polyline
            path={remainingPath}
            options={{ strokeColor: "#1976FF", strokeOpacity: 0.9, strokeWeight: 6, zIndex: 10 }}
          />
        )}

       {
  mapReady &&
  fase === "viaje" && (
    <TrafficLayer />
  )
}

        {/* MARCADOR DEL CONDUCTOR (Círculo Blanco + Flecha) */}
        {driverPos && (
          <>
            <Marker
              position={driverPos}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 15,
                fillColor: "#fff",
                fillOpacity: 1,
                strokeColor: "#000",
                strokeWeight: 2
              }}
            />
            <Marker
              position={driverPos}
              icon={{
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4,
                fillColor: "#090a0a",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 1,
                rotation: lastHeadingRef.current,
                anchor: new google.maps.Point(0, 2)
              }}
            />
          </>
        )}

        {/* MARCADOR DESTINO/PICKUP */}
        {(fase === "pickup" || fase === "viaje") && (
          <Marker
            position={{
              lat: Number(fase === "pickup" ? viajeData?.origenLat : viajeData?.destinoLat),
              lng: Number(fase === "pickup" ? viajeData?.origenLng : viajeData?.destinoLng)
            }}
          />
        )}
      </GoogleMap>

      {/* --------------------------------------------------- */}
      {/* PANEL INFERIOR COMPACTO (ESTILO PREMIUM) */}
      {/* --------------------------------------------------- */}
      <div style={{ 
        position: "absolute", 
        bottom: 0, 
        width: "100%", 
        background: "#1a1a1a", 
        padding: "20px", 
        borderTopLeftRadius: "24px", 
        borderTopRightRadius: "24px", 
        boxShadow: "0 -8px 30px rgba(0,0,0,0.6)",
        color: "#fff",
        zIndex: 100
      }}>
        
        {/* FILA 1: INFO PASAJERO Y LLAMADA */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#888", fontSize: "11px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              {fase === "pickup" ? "Pickup Passenger" : "On the way to Destination"}
            </p>
            <h2 style={{ fontSize: "22px", margin: "2px 0", fontWeight: "bold", textTransform: "capitalize" }}>
              {viajeData?.nombre || "Loading..." }
            </h2>
           <div
  style={{
    fontSize: "15px",
    color: "#1976FF",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: 8
  }}
>

  <span>
    ⏱️
    {" "}
    {etaActual > 0

      ? `${Math.ceil(
          etaActual / 60
        )} min`

      : "Calculating..."}
  </span>

  <span
    style={{
      opacity: 0.7
    }}
  >
    •
  </span>

  <span>
    🚗
    {" "}

    {(
      distanciaActual /
      1609.34
    ).toFixed(1)}

    {" "}mi
  </span>

</div>
          </div>
          
          {viajeData?.telefono && (
  viajeData?.fase === "asignado" ||
  viajeData?.fase === "en_camino"
) && (
           <a
  href={`tel:${viajeData.telefono}`}

  onMouseDown={(e) => {

    e.currentTarget.style.transform =
      "scale(0.92)";
  }}

  onMouseUp={(e) => {

    e.currentTarget.style.transform =
      "scale(1)";
  }}

  onMouseLeave={(e) => {

    e.currentTarget.style.transform =
      "scale(1)";
  }}

  style={{

    background:
      "linear-gradient(135deg,#1f1f1f,#2d2d2d)",

    width: "52px",

    height: "52px",

    borderRadius: "50%",

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    textDecoration: "none",

    boxShadow:
      "0 4px 14px rgba(0,0,0,0.35)",

    border:
      "1px solid rgba(255,255,255,0.08)",

    fontSize: "22px",

    transition:
      "all 0.2s ease"
  }}
>
  📞
</a>
          )}
        </div>

        {/* FILA 2: ALERTAS DE PAGO */}
        {viajeData?.metodoPago === "cash" && !viajeData?.pagado && (
          <div style={{ 
            background: "rgba(255, 77, 77, 0.15)", color: "#ff4d4d", padding: "6px", 
            borderRadius: "10px", marginBottom: 15, textAlign: "center", fontSize: "15px", 
            fontWeight: "bold", border: "1px solid #ff4d4d" 
          }}>
            💵 COLLECT CASH: ${viajeData?.precio}
          </div>
        )}

        {/* FILA 3: BOTONES PRINCIPALES (ACCIONES DE ESTADO) */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {fase === "pickup" && (
            <>
              <button style={{ ...btn("#dc3545"), flex: 1, padding: "14px",fontSize: "15px" }} onClick={cancelar}>❌ Cancel</button>
              <button 
  style={{ ...btn("#1976FF"), flex: 2, padding: "14px",fontSize: "15px" }} 
  onClick={async () => {
   try {
      // 1. Validación de distancia
      if (driverPos && viajeData?.origenLat) {
        const dist = calcularDistancia(driverPos, { 
          lat: Number(viajeData.origenLat), 
          lng: Number(viajeData.origenLng) 
        });
        if (dist > 120 && !window.confirm("⚠️ Pareces lejos. ¿Continuar?")) return;
      }

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/en-viaje", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ viajeId: viajeData.id }),
      });

      if (!res.ok) return alert("Error en el servidor");

      
      speak(
  "Pasajero recogido. Iniciando viaje."
);
      // A. Cambiamos la fase inmediatamente
      setFase("viaje");

      // B. Limpiamos TODAS las referencias de ruta
      fullPathRef.current = []; // Esto gatilla la lógica de "PRIMERA RUTA" en tu useEffect
      lastRouteIndexRef.current = 0;
      setRemainingPath([]);
      setCompletedPath([]);
      setRutasAlternativas([]);
if (viajeData?.id) {

  update(
    ref(
      db,
      "viajes/" + viajeData.id
    ),
    {

      remainingPath: [],

      completedPath: []
    }
  ).catch(console.error);
}


      lastRouteTimeRef.current = 0; // Reseteamos el tiempo para que solicitarRuta no ignore la llamada

      // C. Pedimos la nueva ruta al DESTINO de inmediato
     if (driverPos && viajeData?.destinoLat) {

  
  
  solicitarRuta(
    driverPos,
    {
      lat: Number(
        viajeData.destinoLat
      ),

      lng: Number(
        viajeData.destinoLng
      )
    },
    true
  );
}

    } catch (err) {
      console.error(err);
      alert("Error de conexión");
    }
  }}
>
  📍 Recoger/Pickup
</button>
            </>
          )}

          {fase === "viaje" && (
            <button style={{ ...btn("#28a745"), width: "100%", padding: "10px", fontSize: "15px" }} 
                    onClick={() => finalizar(viajeData.id)}>
              ✅ Drop Off / Finish
            </button>
          )}
        </div>

        {/* FILA 4: BOTONES AUXILIARES (NAVEGACIÓN Y WHATSAPP) */}
        <div style={{ display: "flex", gap: 10 }}>
          <button 
            style={{ ...btn("#25D366"), flex: 1, fontSize: "13px", padding: "10px", opacity: 0.9 }}
            onClick={() => {
              const tel = "1" + String(viajeData.telefono).replace(/\D/g, "");
              window.open(`https://wa.me/${tel}?text=I'm outside`, "_blank");
            }}
          >💬 WhatsApp</button>

          <button 
            style={{ ...btn("#4285F4"), flex: 1, fontSize: "13px", padding: "10px", opacity: 0.9 }}
            onClick={() => {
              const destino = fase === "pickup" 
                ? `${viajeData.origenLat},${viajeData.origenLng}` 
                : `${viajeData.destinoLat},${viajeData.destinoLng}`;
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`, "_blank");
            }}
          >🧭 GPS Navigation</button>
        </div>

      </div>
    </div>
  );
  }