"use client";

import { LoadScript } from "@react-google-maps/api";

export default function GoogleProvider({ children }: { children: React.ReactNode }) {
  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!}
      libraries={["places"]}
    >
      {children}
    </LoadScript>
  );
}
