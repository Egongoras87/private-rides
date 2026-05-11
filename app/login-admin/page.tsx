"use client";

import { useState } from "react";

import {
  signInWithEmailAndPassword
} from "firebase/auth";

import {
  ref,
  get
} from "firebase/database";

import {
  auth,
  db
} from "@/lib/firebase";

export default function LoginAdminPage() {

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const login = async () => {

    try {

      setLoading(true);

      setError("");

      // 🔥 LOGIN FIREBASE AUTH
      const cred =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const uid =
        cred.user.uid;

      // 🔥 VALIDAR ADMIN REAL
      const adminSnap =
        await get(
          ref(db, "admins/" + uid)
        );

      // ❌ NO ES ADMIN
      if (!adminSnap.exists()) {

        setError(
          "Unauthorized"
        );

        await auth.signOut();

        return;
      }

      // ✅ ADMIN OK
      window.location.href =
        "/admin-drivers";

    } catch (err: any) {

      console.error(err);

      setError(
        "Invalid credentials"
      );

    } finally {

      setLoading(false);
    }
  };

  return (

    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#111"
      }}
    >

      <div
        style={{
          width: 350,
          background: "#fff",
          padding: 30,
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}
      >

        <h1
          style={{
            margin: 0,
            textAlign: "center"
          }}
        >
          Admin Login
        </h1>

        <input
          placeholder="Email"

          value={email}

          onChange={(e) =>
            setEmail(
              e.target.value
            )
          }

          style={{
            padding: 14,
            borderRadius: 10,
            border: "1px solid #ccc"
          }}
        />

        <input
          type="password"

          placeholder="Password"

          value={password}

          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }

          style={{
            padding: 14,
            borderRadius: 10,
            border: "1px solid #ccc"
          }}
        />

        {error && (

          <div
            style={{
              color: "red",
              fontSize: 14
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={login}

          disabled={loading}

          style={{
            padding: 14,
            borderRadius: 10,
            border: "none",
            background: "#000",
            color: "#fff",
            cursor: "pointer"
          }}
        >
          {loading
            ? "Loading..."
            : "Login"}
        </button>

      </div>
    </div>
  );
}