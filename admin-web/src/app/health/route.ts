export const dynamic = "force-static";

export function GET() {
  return Response.json({
    status: "ok",
    service: "admin-web",
    version: process.env.APP_VERSION ?? "unknown",
  });
}
