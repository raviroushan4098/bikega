
// This script is for one-time use to seed initial admin/user accounts into Firestore.
// Ensure your Firebase project is configured in src/lib/firebase.ts.
// Run it from your project root: npx tsx src/scripts/seed-initial-users.ts

import { addUser, type NewUserDetails } from '../lib/user-service';
// The following imports ensure Firebase is initialized for the user-service
// We import db and app directly from firebase.ts to ensure we're using the same initialized instances.
import { db, app as firebaseAppInstance } from '../lib/firebase';

// Log to confirm db from firebase.ts should be available
console.log("Seed script starting. It will use the Firebase db instance initialized in 'src/lib/firebase.ts'.");
if (!firebaseAppInstance) {
  console.error("CRITICAL: Firebase app instance from 'src/lib/firebase.ts' is not available. Seeding cannot proceed.");
  console.error("Please check your Firebase configuration in 'src/lib/firebase.ts'.");
  process.exit(1);
}
if (!db) {
  console.error("CRITICAL: Firestore 'db' instance from 'src/lib/firebase.ts' is not available. Seeding cannot proceed.");
  console.error("Please check your Firebase configuration and Firestore initialization in 'src/lib/firebase.ts'.");
  process.exit(1);
}
console.log("Firebase app and Firestore db instances from 'src/lib/firebase.ts' appear to be initialized.");


const usersToSeed: NewUserDetails[] = [
  {
    name: "Initial Admin",
    email: "admin123@gmail.com",
    password: "admin123", // Note: Current setup doesn't securely store/use this password for login.
    role: "admin",
  },
  {
    name: "Initial User",
    email: "user123@gmail.com",
    password: "user123", // Note: Current setup doesn't securely store/use this password for login.
    role: "user",
  },
];

async function seedUsers() {
  console.log("\n======================================================================");
  console.log("🌱 Starting to seed initial users into Firestore...");
  console.log("IMPORTANT: This script attempts to WRITE to your Firestore 'users' collection.");
  console.log("👉 Ensure your Firestore security rules allow writes.");
  console.log("   - In Firebase Console > Firestore Database > Rules:");
  console.log("   - For development, you can use: rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }");
  console.log("   - Default 'test mode' rules also allow writes for a limited time (e.g., allow read, write: if request.time < timestamp.date(YYYY, MM, DD);).");
  console.log("   If writes fail due to permissions, you will likely see 'Error adding user to Firestore: FirebaseError: Missing or insufficient permissions.' messages below.");
  console.log("======================================================================\n");

  let allSuccessful = true;
  let usersActuallyAdded = 0;
  let usersAlreadyExisted = 0;

  for (const userData of usersToSeed) {
    console.log(`Attempting to add user: ${userData.name} (${userData.email})`);
    try {
      const result = await addUser(userData);
      if ('error' in result) {
        if (result.error === "Email already exists.") {
          console.log(`✅ User with email ${userData.email} already exists in Firestore. Skipping.`);
          usersAlreadyExisted++;
        } else {
          console.error(`❌ Failed to add user ${userData.email}: ${result.error}`);
          allSuccessful = false;
        }
      } else {
        console.log(`🎉 Successfully ADDED user '${result.name}' (ID: ${result.id}) with email ${userData.email} to Firestore.`);
        usersActuallyAdded++;
      }
    } catch (error) {
      console.error(`❌ An unexpected error occurred while processing user ${userData.email}:`, error);
      allSuccessful = false;
    }
  }

  console.log("\n======================================================================");
  console.log("📊 Seeding Summary:");
  console.log(`   - New users added: ${usersActuallyAdded}`);
  console.log(`   - Users already existed: ${usersAlreadyExisted}`);
  
  if (allSuccessful && usersActuallyAdded === 0 && usersAlreadyExisted === usersToSeed.length && usersToSeed.length > 0) {
    console.log("🏁 All specified users already existed in Firestore. No new users were added.");
  } else if (allSuccessful && usersActuallyAdded > 0) {
     console.log("✅ User seeding process completed successfully.");
  } else if (allSuccessful && usersToSeed.length === 0) {
    console.log("🤷 No users were defined in 'usersToSeed' array. Nothing to do.");
  }
   else {
    console.error("❌ User seeding process completed with errors. Please review the logs above.");
    console.error("   Common issues: Firestore security rules, Firebase project setup in 'src/lib/firebase.ts'.");
  }
  console.log("======================================================================");
}

seedUsers()
  .then(() => {
    console.log("\nSeed script finished executing.");
    // process.exit(0) can sometimes cut off final logs in some environments.
    // Let the script exit naturally.
  })
  .catch((error) => {
    console.error("\nCRITICAL ERROR running the seed script itself (outside the seedUsers function):", error);
    process.exit(1); // Exit with an error code
  });

