import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "Missing id" },
        { status: 400 }
      );
    }

    // TODO: logic tải file theo id của bạn ở đây
    // Ví dụ: redirect tới url, hoặc trả file stream, ...
    // Hiện tại mình giữ nguyên format bạn đang trả JSON:
    return NextResponse.json(
      { ok: true, message: `Download ${id}` },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
