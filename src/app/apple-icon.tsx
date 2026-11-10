import { ImageResponse } from "next/og";

// Home-screen icon for iOS, which doesn't accept SVG: the same three-bar mark
// as icon.svg and the header logo, as a 180×180 PNG generated at build time.
// iOS rounds the corners itself, so the background is a plain square.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const bars = [
  { height: 56, opacity: 0.45 },
  { height: 92, opacity: 0.7 },
  { height: 117, opacity: 1 },
];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 9,
          paddingBottom: 31,
          background: "#000",
        }}
      >
        {bars.map((b, i) => (
          <div key={i} style={{ width: 32, height: b.height, borderRadius: 8, background: "#fff", opacity: b.opacity }} />
        ))}
      </div>
    ),
    size,
  );
}
