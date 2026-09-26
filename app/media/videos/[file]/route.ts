import { Readable } from "node:stream";
import { getObjectStream, headObject } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams the long-form films out of R2.
 *
 * These files are far too large for git (the reception film is ~150MB, past
 * GitHub's hard 100MB ceiling) so they live in the bucket and are served from
 * here instead of from public/. Range requests are passed through so seeking
 * works, which is why this cannot be a static file.
 */
const FILMS: Record<string, string> = {
  "reception-film-1080.mp4": "videos/reception-film-1080.mp4",
  "gallery-reception-film.mp4": "videos/gallery-reception-film.mp4",
  "gallery-sh-teaser.mp4": "videos/gallery-sh-teaser.mp4",
  "ss-home.mp4": "videos/ss-home.mp4",
};

const CACHE_CONTROL = "public, max-age=3600, s-maxage=31536000, immutable";
const NOT_FOUND = { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" } } as const;

function notFound() {
  return new Response("Not found", NOT_FOUND);
}

/** Node Readable -> Web ReadableStream, so the body streams instead of buffering 150MB. */
function toWebStream(body: unknown): ReadableStream<Uint8Array> | null {
  if (!body) return null;
  if (typeof (body as ReadableStream<Uint8Array>).getReader === "function") return body as ReadableStream<Uint8Array>;
  const node = body as Readable;
  if (typeof node.pipe === "function") return Readable.toWeb(node) as ReadableStream<Uint8Array>;
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Strict allowlist: this bucket also holds private client photographs, so the
  // route must never pass a caller-supplied path through to R2.
  const key = FILMS[file];
  if (!key) return notFound();

  const range = request.headers.get("range") ?? undefined;
  if (range && !/^bytes=\d*-\d*$/.test(range.trim())) {
    return new Response("Range Not Satisfiable", { status: 416, headers: { "Content-Range": "bytes */*", "Accept-Ranges": "bytes" } });
  }
  if (!(await headObject(key))) return notFound();

  let object;
  try {
    object = await getObjectStream(key, range);
  } catch (error) {
    // A range past the end of the object is a client mistake, not an outage.
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 416) {
      return new Response("Range Not Satisfiable", { status: 416, headers: { "Content-Range": "bytes */*", "Accept-Ranges": "bytes" } });
    }
    if (status === 404) return notFound();
    throw error;
  }

  const body = toWebStream(object.Body);
  if (!body) return notFound();

  const headers = new Headers({
    "Content-Type": object.ContentType ?? "video/mp4",
    "Cache-Control": CACHE_CONTROL,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
  if (object.ContentLength != null) headers.set("Content-Length", String(object.ContentLength));
  if (object.ContentRange) headers.set("Content-Range", object.ContentRange);

  return new Response(body, { status: range ? 206 : 200, headers });
}
