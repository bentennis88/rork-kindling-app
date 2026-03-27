import { Timestamp } from "firebase/firestore";
import { CreateSparkData } from "@/types/spark";

export function createSparkData(
  text: string,
  lat: number,
  lng: number,
  photoUrl?: string
): CreateSparkData {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 48 * 60 * 60 * 1000);

  return {
    text,
    photoUrl,
    lat,
    lng,
    createdAt: now,
    expiresAt,
    warmedCount: 0,
    coordinates: {
      latitude: lat,
      longitude: lng,
    },
  };
}
