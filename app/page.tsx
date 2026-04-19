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

  // 🔥 FIX PERSISTENCIA
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
  const [driverPos, setDriverPos] = useState<any>(null);
  const [directions, setDirections] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(saved?.distance || null);
  const [dateTime, setDateTime] = useState(saved?.dateTime || "");
  const [isLoaded, setIsLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [userPos, setUserPos] = useState<any>(null);
  
  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);
  const watchRef = useRef<any>(null);
  const prevPosRef = useRef<any>(null);
  const handleLoad = () => setIsLoaded(true);
  const isGoogleReady = () =>
    typeof window !== "undefined" && window.google?.maps;

  const cleanPhone = (p: string) => p.replace(/\D/g, "");
  const isValidPhone = (p: string) => cleanPhone(p).length === 10;

  // 🔥 GUARDADO PROTEGIDO
  useEffect(() => {
    if (!name && !phone && !pickup && !dropoff) return;

    localStorage.setItem("rideData", JSON.stringify({
      name,
      phone,
      pickup,
      dropoff,
      price,
      distance,
      dateTime
    }));
  }, [name, phone, pickup, dropoff, price, distance, dateTime]);

  const clearData = () => {
    localStorage.removeItem("rideData");
  };

  const parseDate = (str: string) =>
    new Date(str.replace(" ", "T")).getTime();
  useEffect(() => {
  return () => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
  };
}, []);

  // 📍 ubicación
  const getCurrentLocation = () => {
  if (!isGoogleReady()) {
  alert("Mapa no listo, intenta de nuevo");
  return;
}  
  if (!navigator.geolocation) {
    alert("GPS no disponible");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const geocoder = new window.google.maps.Geocoder();

        const res = await geocoder.geocode({
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
        });

        if (res.results?.[0]) {
          setPickup(res.results[0].formatted_address);
        } else {
          alert("No se pudo obtener dirección");
        }
      } catch (err) {
        alert("Error obteniendo dirección");
      }
    },
    (error) => {
      alert("Debes permitir ubicación en tu teléfono");
      console.log(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000
    }
  );
};

  // 🚗 GPS
  const startTracking = () => {
  if (!navigator.geolocation) {
    alert("GPS no disponible");
    return;
  }

  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
  }

  watchRef.current = navigator.geolocation.watchPosition(
    (pos) => {
  setUserPos({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude
  });
},
    (error) => {
      alert("Activa el GPS en tu teléfono");
      console.log(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );

  alert("GPS activado 🚗");
};
const getHeading = (from: any, to: any) => {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const dLng = (to.lng - from.lng) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return Math.atan2(y, x) * (180 / Math.PI);
};

  // 🔥 AUTOCOMPLETE
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

  // 🚗 TRACKING EN TIEMPO REAL
useEffect(() => {
  if (!phone || !dateTime) return;

  const interval = setInterval(() => {
    fetchDriverLocation();
  }, 3000);

  return () => clearInterval(interval);
}, [phone, dateTime]);
useEffect(() => {
  if (!map || !driverPos) return;

  map.setCenter(driverPos);

  if (prevPosRef.current) {
    const heading = getHeading(prevPosRef.current, driverPos);

    map.setHeading(heading);
    map.setTilt(45);
  }

  prevPosRef.current = driverPos;
}, [driverPos]);


  // 🚗 calcular
  const calculateRoute = async () => {
    if (!pickup || !dropoff || !isGoogleReady()) return;

    const service = new window.google.maps.DirectionsService();

    const result: any = await new Promise((resolve, reject) => {
      service.route({
        origin: pickup,
        destination: dropoff,
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (res: any, status: any) => {
        status === "OK" ? resolve(res) : reject();
      });
    });

    const r = result.routes[0].legs[0];
    const miles = r.distance.value / 1609;
    const minutes = r.duration.value / 60;

    setDistance(+miles.toFixed(2));
    setPrice(+(10 + miles * 1.5 + minutes * 0.5).toFixed(2));
    setDirections(result);
  };

  // 🔥 DISPONIBILIDAD
  const checkAvailability = async () => {
    const res = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv");
    const text = await res.text();

    const rows = text.split("\n").slice(1);
    const selected = parseDate(dateTime);

    return !rows.some(r => {
      const c = r.split(",").map(x => x.replace(/(^"|"$)/g, "").trim());
      const t = parseDate(c[6]);
      return t && Math.abs(t - selected) < 30 * 60 * 1000;
    });
  };
const fetchDriverLocation = async () => {
  try {
    const res = await fetch(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpBB4Sb-wzWPSPT-Yvo_jA5KB0rDOR5epN0F3iHdHTOzd-tZnYbz3_336twwe1FKf14lBqOokS865i/pub?output=csv",
      { cache: "no-store" }
    );

    const text = await res.text();
    const rows = text.split("\n").slice(1);

    let found = false;

   for (let r of rows.reverse()) {

  const c = r.split(",").map(x => x.replace(/(^"|"$)/g, "").trim());

  const lat = parseFloat(c[8]);
  const lng = parseFloat(c[9]);

  const sheetPhone = c[1]?.replace(/\D/g, "");
  const userPhone = phone.replace(/\D/g, "");

  console.log("CHECK:", sheetPhone, userPhone, lat, lng); // 👈 AQUÍ

  if (
    sheetPhone.includes(userPhone) &&
    !isNaN(lat) &&
    !isNaN(lng)
  ) {
    setDriverPos({ lat, lng });
    break;
  }
}

    if (!found) {
      console.log("⛔ Driver no encontrado aún");
    }

  } catch (error) {
    console.error("🔥 ERROR TRACKING:", error);
  }
};
  const saveBooking = async () => {
  return await fetch("/api/route", {
    method: "POST",
    body: JSON.stringify({
      name,
      phone,
      pickup,
      dropoff,
      price,
      distance,
      dateTime
    })
  });
};
  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""} libraries={libraries} onLoad={handleLoad}>
      <div style={{ height: "100vh", position: "relative" }}>

        <GoogleMap
  center={driverPos || { lat: 36.1699, lng: -115.1398 }}
  zoom={16}
  onLoad={(m) => setMap(m)}
  options={{
    disableDefaultUI: true,
    zoomControl: true,
    heading: 0,
    tilt: 45
  }}
  mapContainerStyle={{ width: "100%", height: "100%" }}
>
          {directions && <DirectionsRenderer directions={directions} />}
          {/* 👤 USUARIO */}
{userPos && (
  <Marker
    position={userPos}
    icon={{
      url: "https://maps.google.com/mapfiles/kml/shapes/man.png",
      scaledSize: new window.google.maps.Size(35, 35)
    }}
  />
)}

{/* 🚗 DRIVER */}
{driverPos && (
  <Marker
    position={driverPos}
    icon={{
      url: "https://maps.google.com/mapfiles/kml/shapes/cabs.png",
      scaledSize: new window.google.maps.Size(40, 40)
    }}
  />
)}
        </GoogleMap>

        <div style={panel}>

          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} style={input} />
          <input placeholder="Teléfono (10 dígitos)" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
          <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} style={input} />

          <div style={{ display: "flex", gap: 6 }}>
            <input ref={pickupRef} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Origen" style={{ ...input, flex: 1 }} />
            <button
  style={btnIcon}
  onClick={getCurrentLocation}
  onMouseDown={pressIn}
  onMouseUp={pressOut}
  onTouchStart={pressIn}
  onTouchEnd={pressOut}
>
  📍
</button>
          </div>

          <input ref={dropoffRef} value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Destino" style={input} />

          <div style={row}>
            <button
  style={btn}
  onClick={calculateRoute}
  onMouseDown={pressIn}
  onMouseUp={pressOut}
  onTouchStart={pressIn}
  onTouchEnd={pressOut}
>
  Calcular
</button>
            <button
  style={btn}
  onClick={startTracking}
  onMouseDown={pressIn}
  onMouseUp={pressOut}
  onTouchStart={pressIn}
  onTouchEnd={pressOut}
>
  GPS
</button>
          </div>

          {price && (
            <>
              <h3>💰 ${price} | 📏 {distance} mi</h3>

              <div style={row}>
  <button
    style={btnPay}
    onClick={() => alert("Zelle: 725-287-6197")}
    onMouseDown={pressIn}
onMouseUp={pressOut}
onTouchStart={pressIn}
onTouchEnd={pressOut}

  >
    Zelle
  </button>

  <button
    style={btnPay}
    onClick={() =>
      window.open("https://www.paypal.com/paypalme/ernestogongorasaco")
    }
    onMouseDown={pressIn}
onMouseUp={pressOut}
onTouchStart={pressIn}
onTouchEnd={pressOut}
  >
    PayPal
  </button>

  <button
    style={btnPay}
    onClick={() =>
      window.open("https://venmo.com/code?user_id=4536118275999433880")
    }
   onMouseDown={pressIn}
onMouseUp={pressOut}
onTouchStart={pressIn}
onTouchEnd={pressOut}
  >
    Venmo
  </button>
</div>

              <div style={row}>
                <button
                  style={btnMain}
                 onClick={async () => {
   if (!isValidPhone(phone)) return alert("Número inválido");
if (!dateTime) return alert("Selecciona fecha y hora");

  const ok = await checkAvailability();
  if (!ok) return alert("Horario ocupado");

  const res = await saveBooking();

  let result;
  try {
    result = await res.json();
  } catch {
    result = { success: true };
  }

  if (!result.success) {
    alert("Horario ocupado");
    return;
  }

  const clean = cleanPhone(phone);

  const adminMsg = `🚗 NUEVA RESERVA
👤 ${name}
📞 ${clean}

📍 ORIGEN:
${pickup}

🏁 DESTINO:
${dropoff}

💰 $${price}
📏 ${distance} mi

📅 ${dateTime}`;

  window.open(`https://wa.me/17252876197?text=${encodeURIComponent(adminMsg)}`);

  clearData();

  alert("Reserva confirmada 🚗");
 window.open(`/tracking?phone=${phone}&dateTime=${encodeURIComponent(dateTime)}`);
}}
onMouseDown={pressIn}
onMouseUp={pressOut}
onTouchStart={pressIn}
onTouchEnd={pressOut}
                >
                  Confirmar
                </button>

                <button
                  style={btnCancel}
                 onClick={() => {
  const clean = cleanPhone(phone);

  // 🔥 MENSAJE ADMIN CANCELACIÓN
  const adminMsg = `❌ RESERVA CANCELADA
👤 ${name}
📞 ${clean}

📍 ${pickup}
🏁 ${dropoff}

💰 $${price}
📏 ${distance} mi

📅 ${dateTime}`;

  window.open(`https://wa.me/17252876197?text=${encodeURIComponent(adminMsg)}`);

  clearData();

  alert("Reserva cancelada");
}}
onMouseDown={pressIn}
onMouseUp={pressOut}
onTouchStart={pressIn}
onTouchEnd={pressOut}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </LoadScript>
  );
}

// 🎨 estilos (sin cambios)
const panel = { position: "absolute" as const, bottom: 0, width: "100%", background: "#948f8f", padding: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20 };
const input = { width: "100%", padding: 10, marginBottom: 6, borderRadius: 10, border: "1px solid #444", background: "#2a2a2a", color: "#fff" };
const row = { display: "flex", gap: 6, marginBottom: 6 };
const pressIn = (e: any) => e.currentTarget.style.transform = "scale(0.95)";
const pressOut = (e: any) => e.currentTarget.style.transform = "scale(1)";
const btn = {
  flex: 1,
  padding: 10,
  background: "#2d2d2d",
  color: "#fff",
  borderRadius: 10,
  border: "1px solid #555",
  transition: "all 0.15s ease",
  cursor: "pointer"
};
const btnMain = { flex: 1, padding: 12, background: "#00c853", color: "#fff", borderRadius: 12 };
const btnCancel = { flex: 1, padding: 12, background: "#d32f2f", color: "#fff", borderRadius: 12 };
const btnPay = { flex: 1, padding: 8, background: "#333", color: "#fff", borderRadius: 10 };
const btnIcon = { padding: 10, borderRadius: 10, border: "1px solid #555", background: "#2a2a2a", color: "#fff" };