importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
);

// =====================================================
// 🔥 FIREBASE CONFIG
// =====================================================

firebase.initializeApp({

  apiKey:
    "AIzaSyCUm9Bawr6Gnr-QAbwDhmdJ2TVVrMNA3Uc",

  authDomain:
    "private-rides-52e08.firebaseapp.com",

  projectId:
    "private-rides-52e08",

  storageBucket:
    "private-rides-52e08.firebasestorage.app",

  messagingSenderId:
    "768368448310",

  appId:
    "1:768368448310:web:9e5fc8c3e92aac5e719997"
});

// =====================================================
// 🔥 FIREBASE MESSAGING
// =====================================================

const messaging =
  firebase.messaging();

console.log(
  "🔥 Firebase Messaging SW Ready"
);

// =====================================================
// 🔥 BACKGROUND PUSH
// =====================================================

messaging.onBackgroundMessage(

  function(payload) {

    console.log(
      "🔥 BACKGROUND MESSAGE:",
      payload
    );

    const title =
      payload.notification?.title ||
      "New Ride";

    const options = {

      body:
        payload.notification?.body ||

        "New ride request",

      icon:
        "/icon-192.png",

      badge:
        "/icon-192.png",

      vibrate:
        [200,100,200],

      requireInteraction:
        true,

      data: {

        url:
          payload.data?.url ||
          "/driver"
      }
    };

    self.registration.showNotification(
      title,
      options
    );
  }
);

// =====================================================
// 🔥 CLICK NOTIFICATION
// =====================================================

self.addEventListener(

  "notificationclick",

  function(event) {

    event.notification.close();

    const url =
      event.notification.data?.url ||
      "/driver";

    event.waitUntil(

      clients.matchAll({
        type: "window",
        includeUncontrolled: true
      })

      .then((clientList) => {

        for (const client of clientList) {

          if (
            client.url.includes(url) &&
            "focus" in client
          ) {

            return client.focus();
          }
        }

        if (
          clients.openWindow
        ) {

          return clients.openWindow(url);
        }
      })
    );
  }
);