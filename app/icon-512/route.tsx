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
            width: 320,
            height: 320,
            borderRadius: 160,
            background: "#C9A227",
            color: "#0A1628",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 140,
            fontWeight: 700,
          }}
        >
          MY
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}