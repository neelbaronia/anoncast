import { AwsClient } from 'aws4fetch';

export function getR2Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 credentials');
  }

  return new AwsClient({ accessKeyId, secretAccessKey });
}

export async function uploadToR2Edge(
  data: Uint8Array,
  key: string,
  contentType: string = 'audio/mpeg'
): Promise<string> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !bucketName) {
    throw new Error('Missing R2 configuration');
  }

  const client = getR2Client();
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;

  const resp = await client.fetch(url, {
    method: 'PUT',
    body: data.buffer as ArrayBuffer,
    headers: { 'Content-Type': contentType },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`R2 upload failed: ${resp.status} ${text}`);
  }

  return `https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/${key}`;
}
