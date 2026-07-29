export type SupportChatAttachmentPayload = {
  s3Path: string;
  originalName: string;
  contentType: string;
  size: number;
};

export type SupportChatAttachment = SupportChatAttachmentPayload & {
  viewUrl?: string;
};

export const SUPPORT_CHAT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
export const MAX_SUPPORT_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export function validateSupportChatImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return 'Only image files are allowed (JPEG, PNG, GIF, WebP).';
  }
  if (file.size > MAX_SUPPORT_CHAT_IMAGE_BYTES) {
    return 'Image must be 5MB or smaller.';
  }
  return null;
}

export async function presignSupportChatImageUpload(requestId: string, file: File) {
  const res = await fetch(`/api/support-requests/${requestId}/attachment-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to prepare image upload.');
  }
  return payload as {
    uploadUrl: string;
    s3Path: string;
    contentType: string;
    expiresIn: number;
  };
}

export async function uploadSupportChatImageToS3(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (progress: number) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(
        new Error(
          xhr.status === 404
            ? 'Image upload failed: S3 bucket not found. Check S3BUCKET on the server.'
            : `Failed to upload image to storage (HTTP ${xhr.status}).`,
        ),
      );
    };
    xhr.onerror = () =>
      reject(
        new Error(
          'Failed to upload image to storage. This is often a missing S3 bucket or CORS configuration issue.',
        ),
      );
    xhr.send(file);
  });
}

export async function uploadSupportChatImage(
  requestId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<SupportChatAttachmentPayload> {
  const validationError = validateSupportChatImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }
  onProgress?.(5);
  const presign = await presignSupportChatImageUpload(requestId, file);
  onProgress?.(12);
  await uploadSupportChatImageToS3(presign.uploadUrl, file, presign.contentType, (uploadPercent) => {
    onProgress?.(12 + Math.round(uploadPercent * 0.83));
  });
  onProgress?.(100);
  return {
    s3Path: presign.s3Path,
    originalName: file.name,
    contentType: presign.contentType,
    size: file.size,
  };
}
