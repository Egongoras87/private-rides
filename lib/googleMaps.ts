import { Libraries } from "@react-google-maps/api";

const libraries: Libraries = ["places"];

export const googleMapsConfig = {
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  libraries,
};