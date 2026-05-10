export const metadata = {

  title:
    "Private Rides Driver",

  description:
    "App Driver Private Rides",

  manifest:
    "/manifest-driver.json",

  icons: {

    icon: [

      {
        url:
          "/driver-icon.png?v=1"
      }
    ],

    apple: [

      {
        url:
          "/driver-icon.png?v=1"
      }
    ]
  },

  appleWebApp: {

    capable: true,

    statusBarStyle:
      "black-translucent",

    title:
      "PR Driver"
  }
};

// ---------------------------------------------------
// DRIVER LAYOUT
// ---------------------------------------------------

export default function DriverLayout({
  children
}: {
  children: React.ReactNode;
}) {

  return (

    <>

      {/* DRIVER MANIFEST */}

      <link
        rel="manifest"
        href="/manifest-driver.json"
      />

      {/* IOS */}

      <meta
        name="apple-mobile-web-app-capable"
        content="yes"
      />

      <meta
        name="apple-mobile-web-app-status-bar-style"
        content="black-translucent"
      />

      {/* DRIVER ICON */}

      <link
        rel="apple-touch-icon"
        href="/driver-icon.png?v=1"
      />

      {children}

    </>
  );
}