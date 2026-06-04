import { NextResponse } from "next/server";

export function ok<T>(data: T, message = "") {
  return NextResponse.json({ success: true, data, message });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function handleRouteError(error: unknown) {
  if (error instanceof Response) {
    let message = error.statusText || "请求失败";
    try {
      const body = await error.clone().json() as { message?: string };
      message = body.message || message;
    } catch {
      // keep the default response message
    }
    return fail(message, error.status || 500);
  }

  const message = error instanceof Error ? error.message : "服务异常";
  return fail(message, 500);
}
