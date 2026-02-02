// app/api/weather/route.ts
import { NextResponse } from "next/server";

// ใช้ Open-Meteo ฟรี ไม่ต้องมี API key
// ส่ง lat/lon + date (yyyy-mm-dd) → ตอบ max/min
export async function GET(req: Request) {
  const url = new URL(req.url);

  const lat = Number(url.searchParams.get("lat") ?? "18.7883"); // default Chiang Mai
  const lon = Number(url.searchParams.get("lon") ?? "98.9853");
  const date = url.searchParams.get("date"); // yyyy-mm-dd

  if (!date) {
    return NextResponse.json({ error: "missing date" }, { status: 400 });
  }

  const api = new URL("https://api.open-meteo.com/v1/forecast");
  api.searchParams.set("latitude", String(lat));
  api.searchParams.set("longitude", String(lon));
  api.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  api.searchParams.set("timezone", "Asia/Bangkok");
  api.searchParams.set("start_date", date);
  api.searchParams.set("end_date", date);

  const res = await fetch(api.toString());
  if (!res.ok) {
    return NextResponse.json({ error: "weather fetch failed" }, { status: 500 });
  }

  const data = await res.json();
  const max = data?.daily?.temperature_2m_max?.[0];
  const min = data?.daily?.temperature_2m_min?.[0];

  return NextResponse.json({ max, min });
}
