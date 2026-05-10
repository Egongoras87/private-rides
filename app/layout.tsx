import "./globals.css";
import { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  // ---------------------------------------------------
  // APP INFO & IDENTITY
  // ---------------------------------------------------
  title: "Private Rides",
  description: "Aplicación de transporte privado tipo Uber",
  applicationName: "Private Rides",

  // ---------------------------------------------------
  // PWA USER CONFIG (Fundamental para separar apps)
  // ---------------------------------------------------
  manifest: "/manifest-user.json",
  
  icons: {
    icon: "/icon.png?v=10",
    apple: "/icon.png?v=10",
  },

  // ---------------------------------------------------
  // IOS PWA
  // ---------------------------------------------------
  appleWebApp: {
    capable: true,
    statusBarStyle: "default", // Cambiado a default para que combine con el fondo blanco
    title: "Private Rides",
  },

  // ---------------------------------------------------
  // OPEN GRAPH
  // ---------------------------------------------------
  openGraph: {
    title: "Private Rides",
    description: "Servicio de transporte privado",
    siteName: "Private Rides",
    type: "website",
  },
  
  verification: {
    google: "ABC123XYZ456",
  },
};

// ---------------------------------------------------
// VIEWPORT (Diferenciación visual por color)
// ---------------------------------------------------
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFFFFF", // Blanco para el usuario
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* No es necesario agregar <head> manualmente con links de manifest 
          si ya están definidos en el objeto metadata de arriba. 
          Next.js los inserta automáticamente de forma eficiente.
      */}
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}