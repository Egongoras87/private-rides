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
          "/driver-icon.png?v=10"
      }
    ],

    apple: [

      {
        url:
          "/driver-icon.png?v=10"
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

export default function DriverLayout({
  children
}: {
  children: React.ReactNode;
}) {

  return children;
}