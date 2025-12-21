import { NextResponse } from "next/server";
import { getReviewLogs } from "@/lib/reviewLogStore";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        controller.enqueue(
          `data: ${JSON.stringify(getReviewLogs())}\n\n`
        );
      };

      send();
      const interval = setInterval(send, 2000);
      return () => clearInterval(interval);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
