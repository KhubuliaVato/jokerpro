import { ImageResponse } from "next/og";

export const alt = "ProJoker: online Joker, Bura and Poker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The picture shown when a link to the site is shared (Latin text only: the image renderer has no Georgian font). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "radial-gradient(ellipse at 50% 0%, #7a1f36, #1a0710 75%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", fontSize: 150, fontWeight: 900, letterSpacing: -4 }}>
          <span>Pro</span>
          <span style={{ color: "#fcd34d" }}>Joker</span>
        </div>
        <div style={{ fontSize: 46, color: "#fde68a" }}>Joker · Bura · Poker</div>
        <div style={{ fontSize: 34, color: "rgba(255,255,255,0.7)" }}>Play online with friends and bots</div>
      </div>
    ),
    size,
  );
}
