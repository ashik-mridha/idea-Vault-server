require("./mongodb-dns");
require("dotenv").config();

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { createApp } = require("./app");

const uri = process.env.MONGODB_URI_STANDARD || process.env.MONGODB_URI;
const PORT = process.env.PORT || 8000;

const clientOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

if (FIREBASE_PROJECT_ID) {
  initializeApp({
    projectId: FIREBASE_PROJECT_ID,
    ...(FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY
      ? {
          credential: cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: FIREBASE_PRIVATE_KEY.replace(/\n/g, "\n"),
          }),
        }
      : {}),
  });
} else {
  console.warn("FIREBASE_PROJECT_ID is not set: every protected route will answer 401.");
}

const verifyIdToken = (token) => {
  if (!FIREBASE_PROJECT_ID) return Promise.reject(new Error("Firebase is not configured"));
  return getAuth().verifyIdToken(token);
};

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const app = createApp({ db: client.db("ideaVault"), verifyIdToken, clientOrigins });

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`IdeaVault API listening on port ${PORT}`);
  });
}

module.exports = app;
