import { NextResponse, type NextRequest } from "next/server";
import { getLocalFileStorage } from "@/shared/storage";
import { LocalUploadRejectedError } from "@/shared/storage/local-file-storage";

// Development-only stand-in for S3: POST receives the form a
// LocalFileStorage upload target describes and writes the file to
// .uploads/; GET serves a file for a signed view link (like a presigned
// GET). Doesn't exist in production.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  try {
    await getLocalFileStorage().receive(form);
    return new NextResponse(null, { status: 204 }); // what S3 answers by default
  } catch (err) {
    if (err instanceof LocalUploadRejectedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const { body, contentType } = await getLocalFileStorage().read(req.nextUrl.searchParams);
    return new NextResponse(body, { headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof LocalUploadRejectedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new NextResponse(null, { status: 404 });
    throw err;
  }
}
