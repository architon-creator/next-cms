import { readRunLog } from "@/lib/run-log-store";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  try {
    const content = await readRunLog(filename);
    return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
