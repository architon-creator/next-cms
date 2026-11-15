import { redirectToPreviewURL } from "@prismicio/next";
import { NextRequest } from "next/server";
import { createClient } from "@architon-creator/cms/next";

export async function GET(request: NextRequest) {
  const client = createClient();

  return await redirectToPreviewURL({ client, request, defaultURL: "/" });
}
