import net from "node:net";

export async function scanFile(buffer: Buffer) {
  const host = process.env.CLAMAV_HOST;
  if (!host) return { clean: true, engine: "stub" as const };
  const port = Number(process.env.CLAMAV_PORT || 3310);
  const response = await new Promise<string>((resolve, reject) => {
    const socket = net.connect({ host, port });
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on("error", reject);
    socket.on("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.write("zINSTREAM\0");
    const size = Buffer.alloc(4);
    size.writeUInt32BE(buffer.length, 0);
    socket.write(size);
    socket.write(buffer);
    const end = Buffer.alloc(4);
    socket.write(end);
  });
  return { clean: response.includes("OK") && !response.includes("FOUND"), engine: "clamd" as const };
}
