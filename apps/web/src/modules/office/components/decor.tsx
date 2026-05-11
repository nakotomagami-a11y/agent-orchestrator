import { COLS, ROWS, isoXY, stageDimensions } from "../utils/iso-coords";

export function Decor() {
  const { offsetX, offsetY } = stageDimensions();
  const wb = isoXY(2, 0);
  const cb = isoXY(6, 0);
  const corner = isoXY(COLS - 1, ROWS - 1);

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: wb.x + offsetX - 30,
          top: wb.y + offsetY - 65,
          width: 80,
          height: 36,
          background: "#F8F4EE",
          border: "2px solid #2C001E",
          boxShadow: "2px 2px 0 rgba(0,0,0,0.15)",
          fontFamily: "var(--font-mono)",
          fontSize: 7,
          padding: 4,
          color: "#2C001E",
          lineHeight: 1.1,
          overflow: "hidden",
        }}
      >
        SPRINT
        <br />· ship feature
        <br />· a11y pass
        <br />· perf budget
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          left: cb.x + offsetX - 20,
          top: cb.y + offsetY - 30,
          width: 60,
          height: 30,
          background: "#77216F",
          borderTop: "3px solid #5e1858",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 8,
            top: -10,
            width: 10,
            height: 14,
            background: "#1E1A18",
            borderTop: "2px solid #E95420",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 28,
            top: -8,
            width: 12,
            height: 12,
            background: "#E95420",
            borderRadius: 2,
          }}
        />
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          left: corner.x + offsetX - 14,
          top: corner.y + offsetY - 32,
          width: 28,
          height: 36,
        }}
      >
        <div
          style={{ position: "absolute", left: 8, top: 22, width: 12, height: 12, background: "#8B5A3C", borderRadius: 2 }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 28,
            height: 26,
            background: "radial-gradient(ellipse at 50% 60%, #2C8B3E 50%, transparent 60%)",
          }}
        />
      </div>
    </>
  );
}
