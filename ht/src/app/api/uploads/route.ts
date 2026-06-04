import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireUserFromRequest } from "@/lib/current-user";
import { getEnv } from "@/lib/env";
import { ok, fail, handleRouteError } from "@/lib/http";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const maxUploadBytes = 2 * 1024 * 1024;

function extFromType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "img";
}

export async function POST(request: Request) {
  try {
    await requireUserFromRequest(request);
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");

    if (!(file instanceof File)) return fail("缺少图片文件");
    if (!allowedTypes.has(file.type)) return fail("只支持 png、jpg、webp、gif 图片");
    if (file.size > maxUploadBytes) return fail("图片不能超过 2MB");

    const ext = extFromType(file.type);
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const buffer = Buffer.from(await file.arrayBuffer());

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    const appUrl = getEnv().appUrl.replace(/\/$/, "");
    return ok({
      url: `${appUrl}/uploads/${filename}`,
      filename,
      size: file.size,
      storage: "public-uploads"
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
