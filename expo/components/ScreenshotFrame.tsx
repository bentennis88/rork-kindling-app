import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  ImageSourcePropType,
} from 'react-native';

const { width, height } = Dimensions.get('window');

type ScreenshotFrameProps = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  children?: React.ReactNode;
};

export default function ScreenshotFrame({
  title,
  subtitle,
  imageUrl,
  children,
}: ScreenshotFrameProps) {
  return (
    <View style={styles.container}>
      {imageUrl && (
        <Image
          source={{ uri: imageUrl } as ImageSourcePropType}
          style={styles.screenshot}
          resizeMode="cover"
        />
      )}
      
      {children}

      <View style={styles.textOverlay}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000000',
    position: 'relative',
  },
  screenshot: {
    width: '100%',
    height: '100%',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
