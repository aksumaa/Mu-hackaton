import type { FileKind } from "@prisma/client";
import JSZip from "jszip";

const PDF = [0x25, 0x50, 0x44, 0x46];
const OLE = [0xd0, 0xcf, 0x11, 0xe0];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

function startsWith(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function isMp4(buffer: Buffer) {
  return buffer.length > 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

export async function matchesKind(kind: FileKind, mime: string, buffer: Buffer) {
  if (kind === "PRD_PDF") return mime === "application/pdf" && startsWith(buffer, PDF);
  if (kind === "VIDEO_FILE") return mime === "video/mp4" && isMp4(buffer);
  if (kind === "PITCH_DECK") {
    if (mime === "application/vnd.ms-powerpoint") return startsWith(buffer, OLE);
    if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      if (!startsWith(buffer, ZIP)) return false;
      const zip = await JSZip.loadAsync(buffer);
      return Boolean(zip.file("ppt/presentation.xml"));
    }
    return false;
  }
  if (kind === "EQUIVALENT_PROOF" || kind === "OTHER") {
    if (mime === "application/pdf") return startsWith(buffer, PDF);
    if (mime === "application/zip") return startsWith(buffer, ZIP);
    if (mime === "application/vnd.ms-powerpoint") return startsWith(buffer, OLE);
    if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      return startsWith(buffer, ZIP);
    }
    if (mime === "video/mp4") return isMp4(buffer);
    return false;
  }
  return false;
}

export function extensionFor(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

export function extensionAllowed(kind: FileKind, name: string) {
  const extension = extensionFor(name);
  if (kind === "PRD_PDF") return extension === "pdf";
  if (kind === "PITCH_DECK") return extension === "ppt" || extension === "pptx";
  if (kind === "VIDEO_FILE") return extension === "mp4";
  return ["pdf", "ppt", "pptx", "mp4", "zip"].includes(extension);
}
