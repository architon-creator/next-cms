import { BookingDemo } from "../booking-demo";

// Served at /booking/<locale> (basePath "/booking"), matching ab.com/booking/en.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>Cross-app store reset: app 2 (booking)</h1>
      <p>
        Locale: <code>{locale}</code>
      </p>
      <BookingDemo />
    </main>
  );
}
