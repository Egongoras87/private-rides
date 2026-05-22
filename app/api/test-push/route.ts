import { NextResponse }
from "next/server";

import {
  adminMessaging
} from "@/lib/firebase-admin";

export async function GET() {

  try {

    const response =

      await adminMessaging.send({

        token:

          "d8dMVgcOaakRNQyL61Gi-n:APA91bH1mMW-zH7rcXwa98It-LCP0uFXxwl1RcscQFAW9xHmT_4J3MH4H2h14ewau7eqaHXXKICSe_Rc7Nx-knOpOkJK4BIIZmMf-PtRA8ORc8Vb5j9t-BA",

        notification: {

          title:
            "🔥 TEST PUSH",

          body:
            "Firebase Messaging Working"
        },

        webpush: {

          headers: {

            Urgency:
              "high"
          },

          notification: {

            icon:
              "/icon-192.png",

            badge:
              "/icon-192.png",

            vibrate:
              [200,100,200],

            requireInteraction:
              true
          },

          fcmOptions: {

            link:
              "/driver"
          }
        }
      });

    console.log(
      "✅ TEST PUSH SUCCESS:",
      response
    );

    return NextResponse.json({

      success: true,

      response
    });

  } catch (err: any) {

    console.error(
      "❌ TEST PUSH ERROR:",
      err
    );

    return NextResponse.json({

      success: false,

      error:
        err.message
    });
  }
}