import { MongoClient, type Db } from "mongodb";

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

const DEFAULT_DB_NAME = "shopify_app";

export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!global.__mongoClientPromise) {
    const client = new MongoClient(uri);
    global.__mongoClientPromise = client.connect().catch((error) => {
      global.__mongoClientPromise = undefined; // let the next request retry
      throw error;
    });
  }

  return global.__mongoClientPromise;
}

export async function getDatabase(dbName?: string): Promise<Db> {
  const client = await getMongoClient();
  const name = dbName || process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME;
  return client.db(name);
}

export async function verifyMongoConnection(): Promise<boolean> {
  try {
    const db = await getDatabase();
    await db.command({ ping: 1 });
    console.log(`[MongoDB] Connected successfully to database: ${db.databaseName}`);
    return true;
  } catch (error) {
    console.error("[MongoDB] Connection failed:", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}
