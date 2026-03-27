# Firestore TTL Setup for Sparks Collection

To enable automatic deletion of sparks after 48 hours, you need to set up a TTL (Time To Live) policy in Firebase Console.

## Steps:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database
4. Click on the "Indexes" tab
5. Scroll down to "TTL policies"
6. Click "Create TTL policy"
7. Configure:
   - Collection ID: `sparks`
   - Timestamp field: `expiresAt`
8. Click "Create"

## How it works:

- Each spark document will have an `expiresAt` field set to `createdAt + 48 hours`
- Firebase will automatically delete documents where `expiresAt` has passed
- Deletion typically happens within 24 hours after expiration
- This is a server-side operation requiring no client-side code

## Alternative: Cloud Function

If TTL policies are not available in your plan, you can use a scheduled Cloud Function to delete expired sparks.
