import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A1628",
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            background: "#C9A227",
            color: "#0A1628",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 52,
            fontWeight: 700,
          }}
        >
          MY
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}