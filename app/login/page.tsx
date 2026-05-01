"use client";

import { useState } from "react";
import { auth } from "../../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      window.location.href = "/";
    } catch (e) {
      alert("Error login");
      console.log(e);
    }
  };

  const register = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      alert("Usuario creado");
    } catch (e) {
      alert("Error registro");
      console.log(e);
    }
  };

  return (
    <div style={{ padding: 30 }}>
      <h2>Login</h2>

      <input
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Password"
        type="password"
        onChange={(e) => setPass(e.target.value)}
      />

      <br /><br />

      <button onClick={login}>Login</button>
      <button onClick={register}>Register</button>
    </div>
  );
}