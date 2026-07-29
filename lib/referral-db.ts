import mongoose from 'mongoose';

type ReferralCache = {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
  uri: string | null;
};

let cached = (global as typeof globalThis & { referralMongoose?: ReferralCache })
  .referralMongoose;

if (!cached) {
  cached = (global as typeof globalThis & { referralMongoose?: ReferralCache }).referralMongoose =
    {
      conn: null,
      promise: null,
      uri: null,
    };
}

function getReferralMongoUri(): string {
  const uri = process.env.REFERRAL_APP_MONGODB_URL?.trim();
  if (!uri) {
    throw new Error('REFERRAL_APP_MONGODB_URL is not configured');
  }
  return uri;
}

export async function getReferralDbConnection(): Promise<mongoose.Connection> {
  const uri = getReferralMongoUri();

  if (cached!.conn && cached!.uri === uri) {
    return cached!.conn;
  }

  if (cached!.conn && cached!.uri !== uri) {
    await cached!.conn.close();
    cached!.conn = null;
    cached!.promise = null;
  }

  if (!cached!.promise) {
    cached!.uri = uri;
    cached!.promise = mongoose.createConnection(uri, { bufferCommands: false }).asPromise();
  }

  cached!.conn = await cached!.promise;
  return cached!.conn;
}
