import { ok } from "@/lib/http";
import { repository } from "@/lib/repository";

export async function GET() {
  return ok({ tags: await repository.listTags() });
}
