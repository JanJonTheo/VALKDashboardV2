import { ImageResponse } from "next/og";

export const alt = "VALK Command Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#07090d",
        color: "#f2f4f7",
        padding: "78px",
        fontFamily: "Arial",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ color: "#e8bd52", fontSize: 22, letterSpacing: "10px" }}>
          VALK
        </div>
        <div
          style={{
            fontSize: 70,
            fontWeight: 700,
            letterSpacing: "-4px",
            maxWidth: 800,
          }}
        >
          Command Dashboard V2
        </div>
        <div style={{ fontSize: 25, color: "#909baa" }}>
          Analytics · Operations · Intelligence
        </div>
      </div>
      <div
        style={{
          width: 170,
          height: 200,
          background: "#e8bd52",
          color: "#1b1407",
          clipPath: "polygon(50% 0,100% 22%,82% 86%,50% 100%,18% 86%,0 22%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 90,
          fontWeight: 900,
        }}
      >
        V
      </div>
    </div>,
    size,
  );
}
