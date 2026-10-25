import { safeHttpUrl } from "@/lib/utils";

export function youtubeEmbed(value: string) {
  const safe = safeHttpUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (/^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  return null;
}
