import "./globals.css";

export const metadata = {
  title: "App Private Rides",
  description: "App tipo Uber",
    icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}