import { ImageResponse } from "next/og";

// Dynamic social-share card — on-brand black with the headline + tagline.
export const runtime = "nodejs";
export const alt = "Game6 Sports Academy — Where Passion Meets Discipline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 8, color: "#9a9a9a", textTransform: "uppercase" }}>
          Game6 Sports Academy
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 104,
            fontWeight: 800,
            lineHeight: 1.0,
            color: "#f5f5f3",
            textTransform: "uppercase",
          }}
        >
          <span>Where Passion</span>
          <span>Meets Discipline</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 30, color: "#f5f5f3", letterSpacing: 2 }}>
            Free League Drop-In · Woodbridge, ON
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#9a9a9a", letterSpacing: 4, textTransform: "uppercase" }}>
            We got next.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
