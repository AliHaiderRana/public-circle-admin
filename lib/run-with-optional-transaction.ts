import mongoose from 'mongoose';

function isTransactionUnsupportedError(error: unknown): boolean {
  const err = error as { code?: number; codeName?: string; message?: string };
  if (err?.code === 20 || err?.codeName === 'IllegalOperation') return true;
  const message = String(err?.message ?? '');
  return message.includes(
    'Transaction numbers are only allowed on a replica set member or mongos'
  );
}

/**
 * Runs work inside a MongoDB transaction when the deployment supports it
 * (replica set / mongos). Falls back to non-transactional updates on standalone
 * local MongoDB instances used in development.
 */
export async function runWithOptionalTransaction<T>(
  work: (session: mongoose.ClientSession | undefined) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction().catch(() => undefined);
    }

    if (isTransactionUnsupportedError(error)) {
      return work(undefined);
    }

    throw error;
  } finally {
    session.endSession();
  }
}
