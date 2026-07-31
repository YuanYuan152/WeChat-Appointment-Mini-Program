export const dynamic = "force-static";

export function GET() {
  return Response.json({
    status: "ok",
    service: "eap-front-site",
    version: process.env.APP_VERSION ?? "unknown",
  });
}
