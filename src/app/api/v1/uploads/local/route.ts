import { NextResponse, type NextRequest } from "next/server";
import { getLocalFileStorage } from "@/shared/storage";
import { LocalUploadRejectedError } from "@/shared/storage/local-file-storage";

// Development-only stand-in for S3's presigned POST endpoint: receives the
// form a LocalFileStorage upload target describes and writes the file to
// .uploads/. Doesn't exist in production.
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
