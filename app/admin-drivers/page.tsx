"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  ref,
  onValue,
  update,
  get
} from "firebase/database";
import {
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import {
  GoogleMap,
  Marker,
  useJsApiLoader
} from "@react-google-maps/api";

import { googleMapsConfig } from "@/lib/googleMaps";

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const { isLoaded } = useJsApiLoader(googleMapsConfig);

  // 🔐 AUTH + ADMIN
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null);
        setLoadingAuth(false);
        return;
      }

      const checkAdmin = async () => {

  try {

    const adminSnap = await get(
      ref(db, "admins/" + u.uid)
    );

    // ❌ no es admin
    if (!adminSnap.exists()) {

      setUser(null);

      setLoadingAuth(false);

      return;
    }

    // ❌ admin desactivado
    if (
      adminSnap.val()?.active !== true
    ) {

      setUser(null);

      setLoadingAuth(false);

      return;
    }

    // ✅ admin válido
    setUser(u);

    setLoadingAuth(false);

  } catch (err) {

    console.error(err);

    setUser(null);

    setLoadingAuth(false);
  }
};

checkAdmin();
    });

    return () => unsub();
  }, []);

  // ⏱️ tiempo online
  const tiempoOnline = (timestamp: number) => {
    if (!timestamp) return "N/A";
    const diff = Date.now() - timestamp;
    const min = Math.floor(diff / 60000);
    return min + " min";
  };

  // 📡 DRIVERS + LIMPIEZA FANTASMAS
  useEffect(() => {
    const driversRef = ref(db, "drivers");

    const unsub = onValue(driversRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setDrivers([]);
        return;
      }

      const ahora = Date.now();
      const LIMITE = 5 * 60 * 1000;

      const lista = Object.entries(data).map(([id, d]: any) => ({
        id,
        ...d
      }));

      // 👻 LIMPIAR FANTASMAS
      lista.forEach((d) => {
        if (d.online && d.lastSeen && ahora - d.lastSeen > LIMITE) {
          update(ref(db, "drivers/" + d.id), {
            online: false,
            activo: false
          });
        }
      });

      // 🔥 FILTRO FINAL
      setDrivers(
        lista.filter(
          (d) =>
            d.online === true &&
            d.activo === true
        )
      );
    });

    return () => unsub();
  }, []);

  // 🔄 ACTIVAR / DESACTIVAR DRIVER
  const toggleActivo = async (id: string, actual: boolean) => {
    await update(ref(db, "drivers/" + id), {
      activo: !actual,
      online: !actual
    });
  };

  // 🎯 EFECTOS BOTÓN
  const press = (e: any) => {
    e.currentTarget.style.transform = "scale(0.95)";
    e.currentTarget.style.boxShadow = "0 2px 0 #000";
  };

  const release = (e: any) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow = "0 6px 0 #000";
  };

  const logout = async () => {

  try {

    await signOut(auth);

    window.location.href =
      "/login-admin";

  } catch (err) {

    console.error(err);
  }
};

  // 🔐 BLOQUEO DE ACCESO
  if (loadingAuth) {
    return (
      <div style={{ color: "#fff", padding: 20 }}>
        🔐 Verificando acceso...
      </div>
    );
  }

  if (!user) {
    window.location.href =
  "/login-admin";
    return null;
  }

  // 🗺️ MAP LOAD
  if (!isLoaded) {
    return (
      <div style={{ color: "#fff", padding: 20 }}>
        🗺️ Cargando mapa...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        color: "#fff",
        padding: 20,
        fontFamily: "system-ui"
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20
        }}
      >
        <h2 style={{ margin: 0 }}>🚗 Admin Panel</h2>

        <button
  onClick={logout}

  style={{
    background: "#ff4444",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 5px 0 rgba(0,0,0,0.4)"
  }}

  onMouseDown={press}

  onMouseUp={release}

  onMouseLeave={release}
>
  🚪 Sign Out
</button>
      </div>

      {/* MAPA */}
      <div
        style={{
          height: "40vh",
          borderRadius: 20,
          overflow: "hidden",
          marginBottom: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
        }}
      >
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={{ lat: 36.1699, lng: -115.1398 }}
          zoom={12}
        >
          {drivers.map((d) =>
            d.lat && d.lng ? (
              <Marker
                key={d.id}
                position={{
                  lat: Number(d.lat),
                  lng: Number(d.lng)
                }}
                icon={{
                  url: d.viajeActivo
                    ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                    : "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                }}
              />
            ) : null
          )}
        </GoogleMap>
      </div>

      {/* LISTA */}
      {drivers.length === 0 && (
        <p style={{ color: "#888" }}>No hay drivers activos</p>
      )}

      {drivers.map((d) => {

  const isOnline =

    Date.now() -

    (d.lastSeen || 0)

    < 15000;

  return (

    <div
      key={d.id}

      style={{
        background: "#1c1c1c",
        padding: 15,
        borderRadius: 16,
        marginBottom: 15,
        boxShadow:
          "0 10px 30px rgba(0,0,0,0.6)"
      }}
    >

      <p>
        <b>ID:</b> {d.id}
      </p>

      <p>
        <b>Nombre:</b>{" "}
        {d.nombre || "N/A"}
      </p>

      <p>
        <b>Teléfono:</b>{" "}
        {d.telefono || "N/A"}
      </p>

      <p>
        <b>Vehículo:</b>{" "}

        {d.carro?.marca || "N/A"}

        {" "}

        {d.carro?.modelo || ""}
      </p>

      <p>
        <b>Placa:</b>{" "}

        {d.carro?.placa || "N/A"}
      </p>

      <p>
        <b>Color:</b>{" "}

        {d.carro?.color || "N/A"}
      </p>

      <p>
        <b>Estado:</b>{" "}

        {d.activo

          ? "🟢 Activo"

          : "🔴 Inactivo"}
      </p>

      <p>
        <b>Online:</b>{" "}

        <span
          style={{
            color: isOnline

              ? "#00ff99"

              : "#ff5555",

            fontWeight: "bold"
          }}
        >

          {isOnline

            ? "🟢 Online"

            : "🔴 Offline"}

        </span>
      </p>

      <p>
        <b>Última señal:</b>{" "}

        <span style={{ color: "#00ff99" }}>
          {tiempoOnline(d.lastSeen)}
        </span>
      </p>

      <p>
        <b>Viaje:</b>{" "}

        {d.viajeActivo

          ? "🚗 En viaje"

          : "🟢 Libre"}
      </p>

      <p>
        <b>Ubicación:</b>{" "}

        {d.lat && d.lng

          ? `${Number(d.lat)
              .toFixed(4)},
             ${Number(d.lng)
              .toFixed(4)}`

          : "Sin ubicación"}
      </p>

      <button
        onClick={() =>
          toggleActivo(
            d.id,
            d.activo
          )
        }

        onMouseDown={press}

        onMouseUp={release}

        onMouseLeave={release}

        style={{
          width: "100%",
          marginTop: 10,
          padding: 12,
          borderRadius: 10,
          border: "none",

          background: d.activo

            ? "#ff4d4d"

            : "#2ecc71",

          color: "#fff",

          fontWeight: "bold",

          cursor: "pointer",

          boxShadow:
            "0 6px 0 #000"
        }}
      >

        {d.activo

          ? "🔴 Desactivar"

          : "🟢 Activar"}

      </button>

    </div>
  );
})}
    </div>
  );
}