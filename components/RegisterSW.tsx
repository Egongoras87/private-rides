"use client";

import { useEffect } from "react";

export default function RegisterSW() {

  useEffect(() => {

    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {

      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then(() => {

          console.log(
            "SW Registered"
          );

        })
        .catch((err) => {

          console.error(
            "SW ERROR:",
            err
          );

        });
    }

  }, []);

  return null;
}