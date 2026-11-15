import { redirect } from "next/navigation";

// /booking has no page of its own: send it to the default locale (/booking/en).
// redirect() is basePath-aware, so "/en" becomes "/booking/en".
export default function Page() {
  redirect("/en");
}
