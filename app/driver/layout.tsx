import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private Rides Driver",
  description: "App Driver Private Rides",
  manifest: "/manifest-driver.json",
  // El 'id' aquí debe coincidir con el del manifest para vinculación perfecta
  applicationName: "PR Driver",
  
  icons: {
    icon: "/drivericon.png?v=10",
    shortcut: "/drivericon.png?v=10",
    apple: "/drivericon.png?v=10",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PR Driver",
  },
  
  // Esto ayuda a que la barra de estado del celular combine con tu app negra
  themeColor: "#000000",
};

// Separamos el viewport (recomendado en versiones recientes de Next.js)
export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Es importante que el layout de driver mantenga su propia estructura
    // si necesitas envolverlo en algún Provider de autenticación específico
    <>
      {children}
    </>
  );
}