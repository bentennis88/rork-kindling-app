import { Timestamp } from "firebase/firestore";

export interface Spark {
  id: string;
  text: string;
  photoUrl?: string;
  lat: number;
  lng: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  warmedCount: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface CreateSparkData {
  text: string;
  photoUrl?: string;
  lat: number;
  lng: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  warmedCount: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}
