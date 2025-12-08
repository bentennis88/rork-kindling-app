import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

export interface LocationPermissionResult {
  granted: boolean;
  location?: Location.LocationObject;
  error?: string;
}

export async function requestLocationWithRetry(): Promise<LocationPermissionResult> {
  try {
    console.log('[Location] Checking foreground permissions');
    
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    
    if (existingStatus === 'granted') {
      console.log('[Location] Permission already granted');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { granted: true, location };
    }

    console.log('[Location] Requesting foreground permissions');
    const { status: requestedStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (requestedStatus !== 'granted') {
      console.log('[Location] Permission denied:', requestedStatus);
      
      return {
        granted: false,
        error: 'Location permission is required to discover nearby sparks. Please enable it in Settings.'
      };
    }

    console.log('[Location] Permission granted, getting position');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return { granted: true, location };
  } catch (error) {
    console.error('[Location] Error requesting permissions:', error);
    return {
      granted: false,
      error: 'Failed to access location. Please check your settings and try again.'
    };
  }
}

export function showLocationPermissionAlert(
  error: string,
  onRetry?: () => void,
  onOpenSettings?: () => void
) {
  const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
    {
      text: 'Cancel',
      style: 'cancel'
    }
  ];

  if (onRetry) {
    buttons.push({
      text: 'Retry',
      onPress: onRetry
    });
  }

  if (onOpenSettings && Platform.OS === 'ios') {
    buttons.push({
      text: 'Open Settings',
      onPress: onOpenSettings
    });
  }

  Alert.alert(
    'Location Access Required',
    error,
    buttons
  );
}
