import { StyleSheet, View, Text, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Platform, Alert } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useEffect, useState, useRef } from "react";
import * as ScreenCapture from "expo-screen-capture";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/config/firebase";
import { Flame, Heart } from "lucide-react-native";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";
import { Spark } from "@/types/spark";
import confettiAnimation from "@/assets/confetti.json";

const { width } = Dimensions.get("window");

export default function SparkDetailScreen() {
  const { id } = useLocalSearchParams();
  const [spark, setSpark] = useState<Spark | null>(null);
  const [loading, setLoading] = useState(true);
  const [warming, setWarming] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<LottieView>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenCapture.preventScreenCaptureAsync();
      console.log('[SparkDetail] Screen capture prevented');
    }

    let subscription: any;
    if (Platform.OS === 'ios') {
      subscription = ScreenCapture.addScreenshotListener(() => {
        console.log('[SparkDetail] Screenshot attempt detected');
        Alert.alert(
          "♥",
          "Sparks are ephemeral ♥",
          [{ text: "OK", style: "default" }]
        );
      });
    }

    return () => {
      if (Platform.OS !== 'web') {
        ScreenCapture.allowScreenCaptureAsync();
        console.log('[SparkDetail] Screen capture allowed');
      }
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!id || typeof id !== "string") {
        console.log('[SparkDetail] Invalid spark ID');
        setLoading(false);
        return;
      }

      console.log('[SparkDetail] Fetching spark:', id);
      const sparkDoc = await getDoc(doc(db, "sparks", id));
      
      if (sparkDoc.exists()) {
        console.log('[SparkDetail] Spark found');
        setSpark({
          id: sparkDoc.id,
          ...sparkDoc.data(),
        } as Spark);
      } else {
        console.log('[SparkDetail] Spark not found');
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!spark?.expiresAt) return;

    const updateCountdown = () => {
      const now = Date.now();
      const expiresMs = spark.expiresAt.seconds * 1000;
      const diff = expiresMs - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [spark]);

  const handleWarm = async () => {
    if (!spark?.id || warming) return;

    try {
      setWarming(true);
      console.log('[SparkDetail] Warming spark:', spark.id);

      const sparkRef = doc(db, "sparks", spark.id);
      
      await runTransaction(db, async (transaction) => {
        const sparkDoc = await transaction.get(sparkRef);
        
        if (!sparkDoc.exists()) {
          throw new Error("Spark does not exist");
        }

        const currentCount = sparkDoc.data().warmedCount || 0;
        transaction.update(sparkRef, {
          warmedCount: currentCount + 1,
        });
      });

      setSpark(prev => prev ? { ...prev, warmedCount: prev.warmedCount + 1 } : null);
      
      setShowConfetti(true);
      confettiRef.current?.play();
      setTimeout(() => setShowConfetti(false), 2000);

      console.log('[SparkDetail] Spark warmed successfully');
    } catch (error) {
      console.error('[SparkDetail] Failed to warm spark:', error);
    } finally {
      setWarming(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ 
          title: "Spark",
          headerStyle: { backgroundColor: "#000000" },
          headerTintColor: "#FFD700",
        }} />
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!spark) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ 
          title: "Spark Not Found",
          headerStyle: { backgroundColor: "#000000" },
          headerTintColor: "#FFD700",
        }} />
        <Flame size={48} color="#FFD700" fill="#FFD700" />
        <Text style={styles.errorText}>This spark could not be found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: "Spark",
        headerStyle: { backgroundColor: "#000000" },
        headerTintColor: "#FFD700",
      }} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Flame size={72} color="#FFD700" fill="#FFD700" />
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Expires in</Text>
            <Text style={styles.timerText}>{timeLeft}</Text>
          </View>
        </View>

        {spark.photoUrl && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: spark.photoUrl }}
              style={styles.image}
              contentFit="cover"
            />
          </View>
        )}

        <View style={styles.textContainer}>
          <Text style={styles.sparkText}>{spark.text}</Text>
        </View>

        <View style={styles.statsContainer}>
          <Heart size={20} color="#FFD700" fill="#FFD700" />
          <Text style={styles.statsText}>
            {spark.warmedCount} {spark.warmedCount === 1 ? 'person' : 'people'} warmed by this
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.warmButton, warming && styles.warmButtonDisabled]}
          onPress={handleWarm}
          disabled={warming}
          activeOpacity={0.8}
        >
          <Text style={styles.warmButtonText}>
            {warming ? "Warming..." : "This warmed me ♥"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.watermarkContainer} pointerEvents="none">
        <Text style={styles.watermarkText}>kindling.app · do not screenshot</Text>
      </View>

      {showConfetti && (
        <View style={styles.confettiContainer} pointerEvents="none">
          <LottieView
            ref={confettiRef}
            source={confettiAnimation}
            style={styles.confetti}
            loop={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    paddingTop: 8,
  },
  timerContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  timerLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    opacity: 0.6,
    marginBottom: 4,
  },
  timerText: {
    fontSize: 24,
    fontWeight: "bold" as const,
    color: "#FFD700",
    letterSpacing: 1,
  },
  imageContainer: {
    width: "100%",
    height: width * 0.75,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: "#1a1a1a",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    backgroundColor: "#1a1a1a",
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  sparkText: {
    fontSize: 18,
    color: "#FFFFFF",
    lineHeight: 28,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    gap: 8,
  },
  statsText: {
    fontSize: 16,
    color: "#FFD700",
    opacity: 0.9,
  },
  warmButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  warmButtonDisabled: {
    opacity: 0.6,
  },
  warmButtonText: {
    fontSize: 20,
    fontWeight: "bold" as const,
    color: "#000000",
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 16,
    color: "#FFFFFF",
    opacity: 0.8,
    marginTop: 16,
  },
  confettiContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  confetti: {
    width: width,
    height: width,
  },
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  watermarkText: {
    fontSize: 16,
    color: "#FFFFFF",
    opacity: 0.15,
    letterSpacing: 1,
    textAlign: "center",
  },
});
