"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsConfig } from "@/lib/googleMaps";
const watchRef = useRef<any>(null);
const lastPosRef = useRef<any>(null);

export default function DriverTrackingPage() {

  const [pos, setPos] = useState<any>(null);
  const [ruta, setRuta] = useState<any>(null);
  const [fase, setFase] = useState("pickup");

  const mapRef = useRef<any>(null);
  const animRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader(googleMapsConfig);


  // 🔥 TRACKING
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    const viajeRef = ref(db, "viajes/" + id);

    return onValue(viajeRef, (snap) => {
      const d = snap.val();
      if (!d || !d.driverLat) return;

      const nueva = {
        lat: Number(d.driverLat),
        lng: Number(d.driverLng)
      };

      // 🚀 ANIMACIÓN SUAVE
      setPos((prev: any) => {
        if (!prev) return nueva;

        return {
          lat: prev.lat + (nueva.lat - prev.lat) * 0.2,
          lng: prev.lng + (nueva.lng - prev.lng) * 0.2
        };
      });

      // 🔥 MOVER MAPA
      if (mapRef.current) {
        mapRef.current.panTo(nueva);
      }

      // 🔥 RUTA CORRECTA
      if (window.google?.maps?.DirectionsService) {
        const service = new window.google.maps.DirectionsService();

        const origen = {
          lat: Number(d.origenLat),
          lng: Number(d.origenLng)
        };

        const destino = {
          lat: Number(d.destinoLat),
          lng: Number(d.destinoLng)
        };

        const dist = Math.hypot(
          nueva.lat - origen.lat,
          nueva.lng - origen.lng
        );

        if (dist > 0.02) {
          setFase("pickup");

          service.route(
            {
              origin: nueva,
              destination: origen,
              travelMode: window.google.maps.TravelMode.DRIVING
            },
            (res: any, status: any) => {
              if (status === "OK") setRuta(res);
            }
          );

        } else {
          setFase("viaje");

          service.route(
            {
              origin: origen,
              destination: destino,
              travelMode: window.google.maps.TravelMode.DRIVING
            },
            (res: any, status: any) => {
              if (status === "OK") setRuta(res);
            }
          );
        }
      }
    });
  }, []);
  useEffect(() => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
  }

  let lastSendTime = 0;

  watchRef.current = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      console.log("DRIVER GPS:", lat, lng);

      if (lastPosRef.current) {
        const dist = Math.hypot(
          lat - lastPosRef.current.lat,
          lng - lastPosRef.current.lng
        );

        if (dist < 0.00002 && Date.now() - lastSendTime < 2000) return;
      }

      lastSendTime = Date.now();
      lastPosRef.current = { lat, lng };

      update(ref(db, "viajes/" + id), {
        driverLat: lat,
        driverLng: lng,
        timestamp: Date.now()
      });
    },
    (err) => console.log("GPS ERROR:", err),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  );

  return () => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
  };
}, []);

  // 🔴 FUNCIONES DRIVER
  const finalizar = async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    await update(ref(db, "viajes/" + id), {
      estado: "Finalizado"
    });
  };

  const cancelar = async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    await update(ref(db, "viajes/" + id), {
      estado: "Cancelado"
    });
  };

  // 🎯 BOTONES 3D (IGUAL QUE TU TRACKING)
  const btn = (bg: string) => ({
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: bg,
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 4px 0 rgba(0,0,0,0.2)",
    transition: "0.15s"
  });

  const press = (e: any) => {
    e.target.style.transform = "scale(0.95)";
    e.target.style.boxShadow = "0 2px 0 rgba(0,0,0,0.2)";
  };

  const release = (e: any) => {
    e.target.style.transform = "scale(1)";
    e.target.style.boxShadow = "0 4px 0 rgba(0,0,0,0.2)";
  };

  if (!isLoaded) return <div>Loading...</div>;

const handleLoad = (map: any) => {
  mapRef.current = map;
};
  return (
    <div style={{ height: "100vh", position: "relative" }}>
     <GoogleMap
  onLoad={handleLoad}
  mapContainerStyle={{ width: "100%", height: "100%" }}
  center={{ lat: 36.1699, lng: -115.1398 }}
  zoom={16}
>

        {ruta && <DirectionsRenderer directions={ruta} />}

        {pos && (
          <Marker
            position={pos}
            icon={{
              url: "https://maps.google.com/mapfiles/kml/shapes/cabs.png",
              scaledSize: new window.google.maps.Size(50, 50)
            }}
          />
        )}

      </GoogleMap>

      {/* PANEL DRIVER */}
      <div style={{
        position: "absolute",
        bottom: 0,
        width: "100%",
        background: "#fff",
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20
      }}>

        <h3>
          {fase === "pickup"
            ? "🚗 En camino al cliente"
            : "🚗 En viaje"}
        </h3>

        <div style={{ display: "flex", gap: 10 }}>

          <button
            style={btn("#007bff")}
            onMouseDown={press}
            onMouseUp={release}
            onMouseLeave={release}
            onClick={finalizar}
          >
            ✅ Finalizar
          </button>

          <button
            style={btn("#dc3545")}
            onMouseDown={press}
            onMouseUp={release}
            onMouseLeave={release}
            onClick={cancelar}
          >
            ❌ Cancelar
          </button>

        </div>

      </div>
    </div>
  );
}