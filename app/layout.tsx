import "./globals.css";

import AuthProvider from "@/components/AuthProvider";

export const metadata = {

  // ---------------------------------------------------
  // APP INFO
  // ---------------------------------------------------

  title: "Private Rides",

  description:
    "Aplicación de transporte privado tipo Uber",

  // ---------------------------------------------------
  // GOOGLE VERIFICATION
  // ---------------------------------------------------

  verification: {

    google:
      "ABC123XYZ456"
  },

  // ---------------------------------------------------
  // ICONOS
  // ---------------------------------------------------

  icons: {

    icon: [

      {
        url:
          "/icon.png?v=3"
      }
    ],

    apple: [

      {
        url:
          "/icon.png?v=3"
      }
    ]
  },

  // ---------------------------------------------------
  // PWA USER
  // ---------------------------------------------------

  manifest:
    "/manifest-user.json",

  // ---------------------------------------------------
  // IOS PWA
  // ---------------------------------------------------

  appleWebApp: {

    capable: true,

    statusBarStyle:
      "black-translucent",

    title:
      "Private Rides"
  },

  // ---------------------------------------------------
  // OPEN GRAPH
  // ---------------------------------------------------

  openGraph: {

    title:
      "Private Rides",

    description:
      "Servicio de transporte privado",

    siteName:
      "Private Rides",

    type:
      "website"
  }
};

// ---------------------------------------------------
// VIEWPORT
// ---------------------------------------------------

export const viewport = {

  width:
    "device-width",

  initialScale: 1,

  maximumScale: 1,

  userScalable: "no",

  viewportFit:
    "cover",

  themeColor:
    "#000000"
};

// ---------------------------------------------------
// ROOT LAYOUT
// ---------------------------------------------------

export default function RootLayout({
  children
}: any) {

  return (

    <html
  lang="en"
  suppressHydrationWarning
>

      <head>

        {/* --------------------------------------------------- */}
        {/* PWA IOS */}
        {/* --------------------------------------------------- */}

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        {/* --------------------------------------------------- */}
        {/* APPLE ICON */}
        {/* --------------------------------------------------- */}

        <link
          rel="apple-touch-icon"
          href="/icon.png?v=3"
        />

        {/* --------------------------------------------------- */}
        {/* USER MANIFEST */}
        {/* --------------------------------------------------- */}

        <link
          rel="manifest"
          href="/manifest-user.json"
        />

      </head>

      <body>

        <AuthProvider>

          {children}

        </AuthProvider>

      </body>

    </html>
  );
}