
// This script is for one-time use to seed initial admin/user accounts into Firestore.
// Ensure your Firebase project is configured in src/lib/firebase.ts and .env.local if needed.
// Run it from your project root: npx tsx src/scripts/seed-initial-users.ts

import { addUser, type NewUserDetails } from '../lib/user-service';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { firebaseConfig } from '../lib/firebase'; // Ensure firebaseConfig is exported

// Initialize Firebase app if not already initialized (important for scripts)
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

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
  console.log("Starting to seed initial users into Firestore...");
  let allSuccessful = true;

  for (const userData of usersToSeed) {
    try {
      const result = await addUser(userData);
      if ('error' in result) {
        if (result.error === "Email already exists.") {
          console.log(`User with email ${userData.email} already exists. Skipping.`);
        } else {
          console.error(`Failed to add user ${userData.email}: ${result.error}`);
          allSuccessful = false;
        }
      } else {
        console.log(`Successfully added user '${result.name}' (ID: ${result.id}) with email ${userData.email}.`);
      }
    } catch (error) {
      console.error(`An unexpected error occurred while adding user with email ${userData.email}:`, error);
      allSuccessful = false;
    }
  }

  if (allSuccessful) {
    console.log("User seeding process completed successfully.");
  } else {
    console.log("User seeding process completed with some errors. Please check the logs above.");
  }
}

seedUsers()
  .then(() => {
    console.log("Seed script finished.");
    process.exit(0); // Exit successfully
  })
  .catch((error) => {
    console.error("Critical error running seed script:", error);
    process.exit(1); // Exit with an error code
  });
