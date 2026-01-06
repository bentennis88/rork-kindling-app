import { StyleSheet, View, ActivityIndicator, Alert, Platform, TouchableOpacity, Modal, TextInput, Text, KeyboardAvoidingView, ScrollView, Image } from "react-native";
import { useEffect, useState, useRef, useCallback } from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import { GeoCollectionReference, GeoFirestore } from "geofirestore";
import { db, storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Flame, Camera, Image as ImageIcon, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Spark } from "@/types/spark";
import { createSparkData } from "@/utils/spark";
import { canCreateSpark, recordSparkCreation, formatResetTime } from "@/utils/rateLimiter";
import { requestLocationWithRetry } from "@/utils/locationPermissions";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import * as Location from "expo-location";

export default function HomeScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [sparkText, setSparkText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const initializeLocation = useCallback(async () => {
    const result = await requestLocationWithRetry();
    
    if (!result.granted) {
      console.log('[HomeScreen] Location permission denied');
      setLoading(false);
      return;
    }

    if (result.location) {
      console.log('[HomeScreen] Location obtained:', result.location.coords);
      setLocation(result.location);

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: result.location.coords.latitude,
          longitude: result.location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }

      console.log('[HomeScreen] Querying sparks within 500m');
      const geoFirestore = new GeoFirestore(db as any);
      const sparksCollection = geoFirestore.collection("sparks") as GeoCollectionReference;
      
      const center = new (geoFirestore as any).GeoPoint(
        result.location.coords.latitude,
        result.location.coords.longitude
      );
      
      const geoQuery = sparksCollection.near({
        center: center,
        radius: 0.5,
      });

      const unsubscribe = geoQuery.onSnapshot((snapshot) => {
        console.log('[HomeScreen] Received snapshot with', snapshot.docs.length, 'sparks');
        const nearbySparks = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            photoUrl: data.photoUrl,
            lat: data.lat || data.coordinates?.latitude || 0,
            lng: data.lng || data.coordinates?.longitude || 0,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
            warmedCount: data.warmedCount || 0,
            coordinates: {
              latitude: data.coordinates.latitude,
              longitude: data.coordinates.longitude,
            },
          } as Spark;
        });
        setSparks(nearbySparks);
        setLoading(false);
      });

      return unsubscribe;
    }
  }, []);

  useEffect(() => {
    initializeLocation();

    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      console.log('[HomeScreen] Network state:', state.isConnected);
      setIsOffline(!state.isConnected);
    });

    return () => {
      unsubscribeNetInfo();
    };
  }, [initializeLocation]);

  const handleMarkerPress = (spark: Spark) => {
    console.log('[HomeScreen] Marker pressed:', spark.id);
    router.push(`/spark/${spark.id}` as any);
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera permission is required to take photos"
      );
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Media library permission is required to select photos"
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    console.log('[HomeScreen] Taking photo');
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('[HomeScreen] Photo taken:', result.assets[0].uri);
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSelectPhoto = async () => {
    console.log('[HomeScreen] Selecting photo from gallery');
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('[HomeScreen] Photo selected:', result.assets[0].uri);
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImageToStorage = async (uri: string): Promise<string> => {
    console.log('[HomeScreen] Uploading image to storage:', uri);
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `sparks/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    console.log('[HomeScreen] Image uploaded:', downloadURL);
    return downloadURL;
  };

  const handleSubmitSpark = async () => {
    if (!sparkText.trim()) {
      Alert.alert("Error", "Please enter some text for your spark");
      return;
    }

    if (!location) {
      Alert.alert("Error", "Location not available");
      return;
    }

    const rateLimitCheck = await canCreateSpark();
    if (!rateLimitCheck.allowed) {
      const resetTimeFormatted = rateLimitCheck.resetTime
        ? formatResetTime(rateLimitCheck.resetTime)
        : 'soon';
      Alert.alert(
        "Rate Limit Reached",
        `You can only create 5 sparks per hour. Try again in ${resetTimeFormatted}.`,
        [{ text: "OK" }]
      );
      return;
    }

    console.log('[HomeScreen] Submitting spark');
    setSubmitting(true);

    try {
      let photoUrl: string | undefined;
      if (selectedImage) {
        photoUrl = await uploadImageToStorage(selectedImage);
      }

      const sparkData = createSparkData(
        sparkText.trim(),
        location.coords.latitude,
        location.coords.longitude,
        photoUrl
      );

      console.log('[HomeScreen] Creating spark document');
      const geoFirestore = new GeoFirestore(db as any);
      const sparksCollection = geoFirestore.collection("sparks") as GeoCollectionReference;
      
      await sparksCollection.add(sparkData);
      await recordSparkCreation();

      console.log('[HomeScreen] Spark created successfully');
      setModalVisible(false);
      setSparkText("");
      setSelectedImage(null);
      Alert.alert("Success", "Your spark has been left!");
    } catch (error) {
      console.error('[HomeScreen] Error creating spark:', error);
      Alert.alert(
        "Error",
        isOffline
          ? "You're offline. Please check your connection and try again."
          : "Failed to create spark. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <Flame size={48} color="#FFD700" fill="#FFD700" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>You&apos;re offline</Text>
        </View>
      )}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton
      >
        {sparks.map((spark) => (
          <Marker
            key={spark.id}
            coordinate={spark.coordinates}
            onPress={() => handleMarkerPress(spark)}
          >
            <View style={styles.markerContainer}>
              <Flame size={32} color="#FFD700" fill="#FFD700" />
            </View>
          </Marker>
        ))}
      </MapView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Flame size={32} color="#000000" fill="#000000" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Leave a spark</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setSparkText("");
                  setSelectedImage(null);
                }}
              >
                <X size={24} color="#FFD700" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <TextInput
                style={styles.textInput}
                placeholder="Share your moment..."
                placeholderTextColor="#666666"
                value={sparkText}
                onChangeText={(text) => {
                  if (text.length <= 120) {
                    setSparkText(text);
                  }
                }}
                multiline
                maxLength={120}
              />
              <Text style={styles.charCount}>{sparkText.length}/120</Text>

              {selectedImage && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setSelectedImage(null)}
                  >
                    <X size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.imageButtonsContainer}>
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={handleTakePhoto}
                  disabled={submitting}
                >
                  <Camera size={24} color="#FFD700" />
                  <Text style={styles.imageButtonText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={handleSelectPhoto}
                  disabled={submitting}
                >
                  <ImageIcon size={24} color="#FFD700" />
                  <Text style={styles.imageButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitSpark}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.submitButtonText}>Leave spark</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const darkMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#1d1d1d" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a8a" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d1d1d" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#181818" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a8a" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#373737" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3c3c3c" }],
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry",
    stylers: [{ color: "#4e4e4e" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3d3d3d" }],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold" as const,
    color: "#FFD700",
  },
  modalContent: {
    padding: 20,
  },
  textInput: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    color: "#666666",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 16,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 16,
    padding: 6,
  },
  imageButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  imageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  imageButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  submitButton: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "bold" as const,
  },
  offlineBanner: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FF6B6B",
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
    alignItems: "center" as const,
  },
  offlineText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600" as const,
  },
});
