import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

function createS3Client(): S3Client | null {
  const region = (process.env.AWS_REGION || 'ca-central-1').trim();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  return (
    process.env.S3BUCKET ||
    process.env.AWS_S3_BUCKET ||
    process.env.TEMPLATE_THUMBNAILS_BUCKET ||
    ''
  ).trim();
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (
    typeof body === 'object' &&
    body !== null &&
    'transformToByteArray' in body &&
    typeof (body as { transformToByteArray: () => Promise<Uint8Array> })
      .transformToByteArray === 'function'
  ) {
    const bytes = await (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  }

  const stream = body as AsyncIterable<Uint8Array | Buffer | string>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.name === 'NoSuchKey' ||
    e.name === 'NotFound' ||
    e.$metadata?.httpStatusCode === 404
  );
}

const sleep = (ms = 0) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });

export async function uploadJsonToS3({
  s3Path,
  data,
}: {
  s3Path: string;
  data: unknown;
}): Promise<string> {
  const bucket = getBucket();
  const client = createS3Client();
  const region = (process.env.AWS_REGION || 'ca-central-1').trim();

  if (!bucket || !client) {
    throw new Error('S3 is not configured (S3BUCKET, AWS credentials)');
  }

  const body = Buffer.from(
    typeof data === 'string' ? data : JSON.stringify(data),
    'utf-8'
  );

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Path,
      Body: body,
      ContentType: 'application/json',
    })
  );

  return `https://${bucket}.s3.${region}.amazonaws.com/${s3Path}`;
}

export async function downloadJsonFromS3<T = unknown>({
  s3Path,
}: {
  s3Path: string;
}): Promise<T | null> {
  const bucket = getBucket();
  const client = createS3Client();

  if (!bucket || !client) {
    throw new Error('S3 is not configured (S3BUCKET, AWS credentials)');
  }

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: s3Path,
      })
    );

    const buffer = await streamToBuffer(response.Body);
    if (!buffer.length) return null;

    return JSON.parse(buffer.toString('utf-8')) as T;
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

/** Folder-like common prefixes directly under `prefix` (e.g. archive month folders). */
export async function listS3CommonPrefixes({
  prefix,
  delimiter = '/',
}: {
  prefix: string;
  delimiter?: string;
}): Promise<string[]> {
  const bucket = getBucket();
  const client = createS3Client();

  if (!bucket || !client) {
    throw new Error('S3 is not configured (S3BUCKET, AWS credentials)');
  }

  const prefixes: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: delimiter,
        ContinuationToken: continuationToken,
      })
    );
    for (const item of response.CommonPrefixes ?? []) {
      if (item.Prefix) prefixes.push(item.Prefix);
    }
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return prefixes;
}

export async function uploadJsonToS3WithRetry({
  s3Path,
  data,
  maxAttempts = 5,
}: {
  s3Path: string;
  data: unknown;
  maxAttempts?: number;
}): Promise<string> {
  let attempt = 0;
  let delay = 500;

  while (attempt < maxAttempts) {
    try {
      return await uploadJsonToS3({ s3Path, data });
    } catch (err) {
      attempt += 1;
      const isThrottleError =
        typeof err === 'object' &&
        err !== null &&
        ((err as { Code?: string }).Code === 'SlowDown' ||
          (err as { name?: string }).name === 'SlowDown');

      if (!isThrottleError || attempt >= maxAttempts) {
        throw err;
      }

      await sleep(delay + Math.random() * 150);
      delay = Math.min(delay * 2, 8000);
    }
  }

  throw new Error('uploadJsonToS3WithRetry exhausted attempts');
}
