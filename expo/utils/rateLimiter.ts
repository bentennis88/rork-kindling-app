import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_KEY = 'spark_rate_limit';
const MAX_SPARKS_PER_HOUR = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface SparkTimestamp {
  timestamp: number;
}

export async function canCreateSpark(): Promise<{ allowed: boolean; remainingCount: number; resetTime?: number }> {
  try {
    const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    
    let timestamps: SparkTimestamp[] = [];
    
    if (stored) {
      timestamps = JSON.parse(stored);
      timestamps = timestamps.filter(t => now - t.timestamp < ONE_HOUR_MS);
    }

    const remainingCount = MAX_SPARKS_PER_HOUR - timestamps.length;
    
    if (timestamps.length >= MAX_SPARKS_PER_HOUR) {
      const oldestTimestamp = Math.min(...timestamps.map(t => t.timestamp));
      const resetTime = oldestTimestamp + ONE_HOUR_MS;
      
      return {
        allowed: false,
        remainingCount: 0,
        resetTime
      };
    }

    return {
      allowed: true,
      remainingCount
    };
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    return { allowed: true, remainingCount: MAX_SPARKS_PER_HOUR };
  }
}

export async function recordSparkCreation(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    
    let timestamps: SparkTimestamp[] = [];
    
    if (stored) {
      timestamps = JSON.parse(stored);
      timestamps = timestamps.filter(t => now - t.timestamp < ONE_HOUR_MS);
    }

    timestamps.push({ timestamp: now });
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps));
    
    console.log('[RateLimiter] Spark creation recorded. Count:', timestamps.length);
  } catch (error) {
    console.error('[RateLimiter] Error recording spark:', error);
  }
}

export function formatResetTime(resetTime: number): string {
  const diff = resetTime - Date.now();
  if (diff <= 0) return '0m';
  
  const minutes = Math.ceil(diff / (1000 * 60));
  if (minutes < 60) return `${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
