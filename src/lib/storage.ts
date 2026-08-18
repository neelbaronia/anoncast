import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const r2PublicBaseUrl = "https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string = "audio/mpeg"
): Promise<string> {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error("Missing R2 configuration");
    throw new Error("Missing R2 configuration");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    
    // Use the direct R2 Public Development URL. 
    // This is the only one guaranteed to support byte-ranges without DNS configuration issues.
    return getR2PublicUrl(key);
  } catch (error) {
    console.error("Error uploading to R2:", error);
    throw error;
  }
}

export function getR2PublicUrl(key: string): string {
  return `${r2PublicBaseUrl}/${key}`;
}

export async function deleteR2Objects(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Missing R2 configuration");
  }

  await s3Client.send(new DeleteObjectsCommand({
    Bucket: bucketName,
    Delete: {
      Objects: keys.map((key) => ({ Key: key })),
      Quiet: true,
    },
  }));
}
