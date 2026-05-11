"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, update } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion"; // 🔥 Ahora sí los usaremos

export default function DriverProfile() {
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

 useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    // Si no hay usuario y no estamos cargando (es decir, ya se intentó cargar)
    if (!user && !loading) {
      window.location.href = "/login";
      return;
    }
    
    if (user) {
      const perfilRef = ref(db, "drivers/" + user.uid);
      onValue(perfilRef, (snap) => {
        const data = snap.val();
        if (data) {
          setPerfil({
            nombre: data.nombre || "",
            telefono: data.telefono || "",
            carro: {
              marca: data.carro?.marca || "",
              modelo: data.carro?.modelo || "",
              color: data.carro?.color || "",
              placa: data.carro?.placa || ""
            },
            rating: data.rating || 5
          });
        }
        setLoading(false);
      }, { onlyOnce: true });
    } else {
      setLoading(false);
    }
  });
  return () => unsub();
}, []);

  const guardar = async () => {
    const user = auth.currentUser;
    if (!user || !perfil) return;

    setSaving(true);
    try {
      await update(ref(db, "drivers/" + user.uid), {
        ...perfil,
        updatedAt: Date.now()
      });
      alert("✅ Perfil actualizado");
    } catch (err) {
      alert("❌ Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <AnimatePresence mode="wait">
        {loading ? (
          /* --- PANTALLA DE CARGA --- */
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} // 🔥 Se desvanece al terminar
            style={fullCenter}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              style={loader}
            />
          </motion.div>
        ) : (
          /* --- CONTENIDO DEL PERFIL --- */
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 10 }} // Aparece desde abajo
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={container}
          >
            {/* HEADER */}
            <header style={header}>
            <motion.button
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.9 }}
  onClick={() => (window.location.href = "/driver")}
  style={backBtn}
>
  <span
    style={{
      fontSize: 40,
      fontWeight: "bold",
      lineHeight: 1
    }}
  >
    ←
  </span>
</motion.button>
             
            </header>

            <div style={content}>
              {/* SECCIÓN PERSONAL */}
              <section style={card}>
                <h3 style={sectionTitle}>Información Personal</h3>
                <div style={inputGroup}>
                  <label style={label}>Nombre Completo</label>
                  <motion.input
                    whileFocus={{ borderColor: "#007bff" }}
                    value={perfil.nombre}
                    onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
                    style={input}
                    placeholder="Tu nombre"
                  />
                </div>
                <div style={inputGroup}>
                  <label style={label}>Teléfono de Contacto</label>
                  <motion.input
                    whileFocus={{ borderColor: "#007bff" }}
                    value={perfil.telefono}
                    onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value })}
                    style={input}
                    placeholder="+1..."
                  />
                </div>
              </section>

              {/* SECCIÓN VEHÍCULO */}
              <section style={card}>
                <h3 style={sectionTitle}>Detalles del Vehículo</h3>
                <div style={grid}>
                  {Object.keys(perfil.carro).map((key) => (
                    <div key={key} style={inputGroup}>
                      <label style={label}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                      <motion.input
                        whileFocus={{ borderColor: "#007bff" }}
                        value={perfil.carro[key]}
                        onChange={(e) => setPerfil({
                          ...perfil,
                          carro: { ...perfil.carro, [key]: e.target.value }
                        })}
                        style={input}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                style={ratingBadge}
              >
                ⭐ Nivel de Conductor: {perfil.rating} / 5
              </motion.div>

              <motion.button
  whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
  whileTap={{ scale: 0.98 }}
  disabled={saving}
  onClick={guardar}
  style={{
    ...btnGuardar,
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.7 : 1,
    background: saving ? "#444" : "linear-gradient(135deg, #28a745, #1e7e34)"
  }}
>
  {saving ? "Guardando..." : "💾 Guardar Cambios"}
</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ... (Tus estilos se mantienen igual)
const container: React.CSSProperties = {
  minHeight: "100vh",
  color: "#fff",
  padding: "20px",
  paddingBottom: "40px"
};
// ... (resto de estilos iguales al anterior)
const fullCenter: React.CSSProperties = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};
const loader: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "4px solid #1e1e1e",
  borderTop: "4px solid #007bff",
  borderRadius: "50%"
};
const header: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "30px" };
const title: React.CSSProperties = { fontSize: "20px", fontWeight: "600" };
const backBtn: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", width: "45px", height: "45px", borderRadius: "14px", cursor: "pointer" };
const avatar: React.CSSProperties = { width: "45px", height: "45px", borderRadius: "50%", background: "linear-gradient(135deg, #007bff, #0056b3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" };
const content: React.CSSProperties = { maxWidth: "500px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" };
const card: React.CSSProperties = { background: "#161616", padding: "20px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.05)" };
const sectionTitle: React.CSSProperties = { fontSize: "15px", color: "#007bff", marginBottom: "15px", fontWeight: "bold", textTransform: "uppercase" };
const inputGroup: React.CSSProperties = { marginBottom: "15px" };
const label: React.CSSProperties = { fontSize: "12px", color: "#777", marginBottom: "6px", display: "block" };
const input: React.CSSProperties = { width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #2a2a2a", background: "#1e1e1e", color: "#fff", outline: "none" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const ratingBadge: React.CSSProperties = { background: "rgba(255, 193, 7, 0.1)", color: "#ffc107", padding: "12px", borderRadius: "12px", textAlign: "center", fontWeight: "600" };
const btnGuardar: React.CSSProperties = { width: "100%", padding: "16px", borderRadius: "16px", border: "none", color: "#fff", fontSize: "16px", fontWeight: "bold", cursor: "pointer" };