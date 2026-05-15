import mongoose from 'mongoose';
import { registerModels } from './register-models';

function getMongoUri(): string {
  const raw = process.env.MONGODB_URI || process.env.MONGODB_URL;
  const uri = typeof raw === 'string' ? raw.trim() : '';
  if (!uri) {
    throw new Error(
      'Set MONGODB_URI or MONGODB_URL in .env.local (staging) — see server/.env',
    );
  }
  return uri;
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  uri: string | null;
};

let cached = (global as typeof globalThis & { mongoose?: MongooseCache }).mongoose;

if (!cached) {
  cached = (global as typeof globalThis & { mongoose?: MongooseCache }).mongoose = {
    conn: null,
    promise: null,
    uri: null,
  };
}

async function dbConnect() {
  const uri = getMongoUri();

  if (cached!.conn && cached!.uri === uri) {
    return cached!.conn;
  }

  if (cached!.conn && cached!.uri !== uri) {
    await mongoose.disconnect();
    cached!.conn = null;
    cached!.promise = null;
  }

  if (!cached!.promise) {
    cached!.uri = uri;
    cached!.promise = mongoose.connect(uri, { bufferCommands: false }).then((instance) => instance);
  }

  cached!.conn = await cached!.promise;
  registerModels();
  return cached!.conn;
}

export default dbConnect;
