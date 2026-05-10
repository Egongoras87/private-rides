import "./globals.css";
import { Metadata, Viewport } from "next";
import { headers } from "next/headers"; // Asegúrate de que esta importación esté así
import AuthProvider from "@/components/AuthProvider";

// 1. VIEWPORT DINÁMICO
export async function generateViewport(): Promise<Viewport> {
  // ✅ CORREGIDO: Añadido 'await' antes de headers()
  const headersList = await headers(); 
  const host = headersList.get("host") || "";
  const isDriver = host.includes("driver.privaterideslasvegas.com");

  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: isDriver ? "#000000" : "#FFFFFF", 
  };
}

// 2. METADATA DINÁMICA
export async function generateMetadata(): Promise<Metadata> {
  // ✅ CORREGIDO: Añadido 'await' antes de headers()
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const isDriver = host.includes("driver.privaterideslasvegas.com");

  if (isDriver) {
    return {
      title: "PR Driver",
      description: "Acceso exclusivo para conductores - Private Rides",
      applicationName: "PR Driver",
      manifest: "/manifest-driver.json",
      icons: {
        icon: "/drivericon.png?v=11",
        apple: "/drivericon.png?v=11",
      },
      appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "PR Driver",
      },
    };
  }

  return {
    title: "Private Rides",
    description: "Premium Transportation Service in Las Vegas",
    applicationName: "Private Rides",
    manifest: "/manifest-user.json",
    icons: {
      icon: "/icon.png?v=11",
      apple: "/icon.png?v=11",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Private Rides",
    },
  };
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}