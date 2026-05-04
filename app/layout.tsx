import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "App Private Rides",
  description: "App tipo Uber",

  // 🔥 ICONO
  icons: {
    icon: [{ url: "/icon.png?v=2" }],
  },

  // 🔥 PWA
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: "no",

  // ✅ AQUÍ VA AHORA
  themeColor: "#000000",
};

export default function RootLayout({ children }: any) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}