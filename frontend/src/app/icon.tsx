import { ImageResponse } from "next/og";

export const runtime = "edge";

// Image metadata size
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          color: "#ffffff",
          fontSize: "18px",
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, sans-serif",
          boxShadow: "inset 0 0 4px rgba(255,255,255,0.2)",
        }}
      >
        V
      </div>
    ),
    {
      ...size,
    }
  );
}
