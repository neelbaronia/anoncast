import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;

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
    
    // Return the public URL if configured, otherwise a guess or empty
    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, "")}/${key}`;
    }
    
    // Fallback to the R2 dev domain if publicUrl is not set
    // Note: This usually requires public access to be enabled on the bucket
    return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
  } catch (error) {
    console.error("Error uploading to R2:", error);
    throw error;
  }
}
