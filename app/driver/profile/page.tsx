"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";

export default function DriverProfile() {
  const [perfil, setPerfil] = useState<any>(null);

  // 📥 CARGAR PERFIL
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const perfilRef = ref(db, "drivers/" + user.uid);

      return onValue(perfilRef, (snap) => {
        const data = snap.val();

        // 🔥 asegurar estructura (evita errores undefined)
        setPerfil({
          nombre: data?.nombre || "",
          telefono: data?.telefono || "",
          carro: {
            marca: data?.carro?.marca || "",
            modelo: data?.carro?.modelo || "",
            color: data?.carro?.color || "",
            placa: data?.carro?.placa || ""
          },
          rating: data?.rating || 5
        });
      });
    });

    return () => unsub();
  }, []);

  // 💾 GUARDAR
  const guardar = async () => {
    const user = auth.currentUser;
    if (!user || !perfil) return;

    await update(ref(db, "drivers/" + user.uid), perfil);

    alert("✅ Perfil actualizado");
  };

  if (!perfil) {
    return (
      <div style={{ color: "#fff", padding: 20 }}>
        🔄 Cargando perfil...
      </div>
    );
  }

  return (
    <div style={container}>
      
      {/* HEADER */}
      <div style={header}>
        <button onClick={() => (window.location.href = "/driver")} style={backBtn}>
          ⬅
        </button>

        <h2 style={{ margin: 0 }}>👤 Perfil</h2>

        <div style={avatar}>
          {perfil.nombre?.charAt(0).toUpperCase() || "D"}
        </div>
      </div>

      {/* CARD */}
      <div style={card}>
        
        {/* INFO */}
        <div style={section}>
          <label style={label}>Nombre</label>
          <input
            value={perfil.nombre}
            onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
            style={input}
          />
        </div>

        <div style={section}>
          <label style={label}>Teléfono</label>
          <input
            value={perfil.telefono}
            onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value })}
            style={input}
          />
        </div>

        {/* CARRO */}
        <h3 style={{ marginTop: 20 }}>🚗 Vehículo</h3>

        <div style={grid}>
          <input
            placeholder="Marca"
            value={perfil.carro.marca}
            onChange={(e) =>
              setPerfil({
                ...perfil,
                carro: { ...perfil.carro, marca: e.target.value }
              })
            }
            style={input}
          />

          <input
            placeholder="Modelo"
            value={perfil.carro.modelo}
            onChange={(e) =>
              setPerfil({
                ...perfil,
                carro: { ...perfil.carro, modelo: e.target.value }
              })
            }
            style={input}
          />

          <input
            placeholder="Color"
            value={perfil.carro.color}
            onChange={(e) =>
              setPerfil({
                ...perfil,
                carro: { ...perfil.carro, color: e.target.value }
              })
            }
            style={input}
          />

          <input
            placeholder="Placa"
            value={perfil.carro.placa}
            onChange={(e) =>
              setPerfil({
                ...perfil,
                carro: { ...perfil.carro, placa: e.target.value }
              })
            }
            style={input}
          />
        </div>

        {/* RATING */}
        <div style={ratingBox}>
          ⭐ Rating: {perfil.rating}
        </div>

        {/* BOTÓN */}
        <button
          onClick={guardar}
          style={btn}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "translateY(3px)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          💾 Guardar cambios
        </button>
      </div>
    </div>
  );
}

//
// 🎨 ESTILOS
//

const container = {
  minHeight: "100vh",
  background: "linear-gradient(180deg,#0f0f0f,#1c1c1c)",
  color: "#fff",
  padding: 20,
  fontFamily: "system-ui"
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 20
};

const backBtn = {
  background: "#222",
  border: "none",
  color: "#fff",
  fontSize: 20,
  padding: 10,
  borderRadius: 10,
  cursor: "pointer"
};

const avatar = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: "#007bff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold"
};

const card = {
  background: "#1c1c1c",
  padding: 20,
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
};

const section = {
  marginBottom: 15
};

const label = {
  fontSize: 13,
  color: "#aaa",
  marginBottom: 5,
  display: "block"
};

const input = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "#2a2a2a",
  color: "#fff"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10
};

const ratingBox = {
  marginTop: 15,
  background: "#222",
  padding: 10,
  borderRadius: 10,
  textAlign: "center" as const
};

const btn = {
  width: "100%",
  marginTop: 20,
  padding: 14,
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(145deg,#28a745,#1e7e34)",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 6px 0 #000",
  transition: "0.1s"
};