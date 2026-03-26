const { S3Client, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const path = require('path');

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Upload a single file from disk to R2
async function uploadFile(localPath, r2Key, contentType) {
  const fileStream = fs.createReadStream(localPath);
  const upload = new Upload({
    client: r2,
    params: {
      Bucket: BUCKET,
      Key: r2Key,
      Body: fileStream,
      ContentType: contentType || 'application/octet-stream',
    },
  });
  await upload.done();
  return `${PUBLIC_URL}/${r2Key}`;
}

// Upload an entire local directory to R2 with a given prefix
async function uploadDirectory(localDir, r2Prefix) {
  const files = getAllFiles(localDir);
  await Promise.all(files.map(async filePath => {
    const relative = path.relative(localDir, filePath).replace(/\\/g, '/');
    const r2Key = `${r2Prefix}/${relative}`;
    const contentType = guessContentType(filePath);
    await uploadFile(filePath, r2Key, contentType);
  }));
}

// Delete a single object
async function deleteFile(r2Key) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r2Key }));
}

// Delete all objects under a prefix (for SCORM folders)
async function deleteFolder(prefix) {
  let continuationToken;
  do {
    const list = await r2.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
      ContinuationToken: continuationToken,
    }));
    if (list.Contents?.length) {
      await r2.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: list.Contents.map(o => ({ Key: o.Key })) },
      }));
    }
    continuationToken = list.NextContinuationToken;
  } while (continuationToken);
}

// Recursively get all file paths in a directory
function getAllFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllFiles(full));
    else results.push(full);
  }
  return results;
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html', '.htm': 'text/html',
    '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.xml': 'application/xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.zip': 'application/zip',
    '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
    '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };
  return map[ext] || 'application/octet-stream';
}

module.exports = { uploadFile, uploadDirectory, deleteFile, deleteFolder, PUBLIC_URL };
