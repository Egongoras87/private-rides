"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const router = useRouter();

  const login = async () => {
    if (!email || !pass) {
      alert("Completa todos los campos");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);

      const redirect = new URLSearchParams(window.location.search).get("redirect");

      router.push(redirect || "/driver");

    } catch (e: unknown) {
      const err = e as Error;
      alert(err.message);
      console.log(err);
    }
  };

  const register = async () => {
    if (!email || !pass) {
      alert("Completa todos los campos");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, pass);

      alert("Usuario creado");
      router.push("/driver");

    } catch (e: unknown) {
      const err = e as Error;
      alert(err.message);
      console.log(err);
    }
  };

  return (
    <div style={{ padding: 30 }}>
      <h2>Login Driver</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br /><br />

      <input
        type="password"
        placeholder="Password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />

      <br /><br />

      <button onClick={login}>Login</button>
      <button onClick={register}>Register</button>
    </div>
  );
}