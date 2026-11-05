export function getErpPublicUrl(request: Request) {
  const configuredUrl = process.env.ERP_PUBLIC_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  if (process.env.VERCEL_ENV === "production") return "https://erp.brasaland.site";
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return new URL(request.url).origin;
}
