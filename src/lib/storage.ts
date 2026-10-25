import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveInside } from "@/lib/safe-path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StoredObject = { key: string };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required");
  return value;
}

function driver() {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

function localRoot() {
  return path.resolve(process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), "storage"));
}

function s3() {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: true,
  });
}

export function newStorageKey(prefix: string) {
  return `${prefix}/${randomUUID()}`;
}

export async function putObject(key: string, body: Buffer, mime: string) {
  if (driver() === "s3") {
    await s3().send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: mime,
    }));
    return;
  }
  const target = resolveInside(localRoot(), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

export async function readObject(key: string) {
  if (driver() === "s3") {
    const response = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error("empty object");
    return Buffer.from(bytes);
  }
  return readFile(resolveInside(localRoot(), key));
}

export async function deleteObject(key: string) {
  if (driver() === "s3") {
    await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    return;
  }
  const { rm } = await import("node:fs/promises");
  await rm(resolveInside(localRoot(), key), { force: true });
}

export function signLocalFile(id: string, expiresInSeconds = 300) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const sig = createHmac("sha256", secret()).update(`${id}.${exp}`).digest("hex");
  return `/api/files/${id}?exp=${exp}&sig=${sig}`;
}

export function verifyLocalSignature(id: string, exp: string, sig: string) {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", secret()).update(`${id}.${expires}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(sig);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function signedDownloadUrl(storageKey: string, fileId: string) {
  if (driver() === "s3") {
    return getSignedUrl(s3(), new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: storageKey }), { expiresIn: 300 });
  }
  return signLocalFile(fileId);
}

export function randomPassword() {
  return randomBytes(9).toString("base64url");
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}
