import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(32),
  color: z.string().min(4).max(24)
});

export async function GET() {
  return ok({ categories: await repository.listCategories() });
}

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("分类参数不正确");
    return ok({ category: await repository.upsertCategory(parsed.data) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.required({ id: true }).safeParse(await request.json());
    if (!parsed.success) return fail("分类参数不正确");
    return ok({ category: await repository.upsertCategory(parsed.data) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return fail("分类 id 不能为空");
    await repository.deleteCategory(id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
