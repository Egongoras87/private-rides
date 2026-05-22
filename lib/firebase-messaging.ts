import { app } from "@/lib/firebase";

import {

  getMessaging,

  getToken,

  onMessage

} from "firebase/messaging";

// =====================================================
// 🔥 MESSAGING
// =====================================================

export const messaging =

  typeof window !==
  "undefined"

    ? getMessaging(app)

    : null;

export {

  getToken,

  onMessage
};