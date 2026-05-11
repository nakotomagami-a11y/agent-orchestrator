import { COLS, ROWS, TILE_H, TILE_W, isoXY, stageDimensions } from "../utils/iso-coords";

export function FloorSvg() {
  const { width, height, offsetX, offsetY } = stageDimensions();
  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y } = isoXY(c, r);
      tiles.push({ x: x + offsetX, y: y + offsetY, alt: (c + r) % 2 === 0 });
    }
  }

  return (
    <svg
      className="iso-floor-svg"
      width={width}
      height={height}
      style={{ position: "absolute", left: 0, top: 0 }}
      aria-hidden
    >
      <defs>
        <linearGradient id="ao-wallGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#EFE2D6" />
          <stop offset="1" stopColor="#E1D0C0" />
        </linearGradient>
        <linearGradient id="ao-wallShade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#D8C0AA" />
          <stop offset="1" stopColor="#C8AE96" />
        </linearGradient>
      </defs>

      <polygon
        points={`${isoXY(0, 0).x + offsetX},${isoXY(0, 0).y + offsetY}
          ${isoXY(COLS, 0).x + offsetX},${isoXY(COLS, 0).y + offsetY}
          ${isoXY(COLS, 0).x + offsetX},${isoXY(COLS, 0).y + offsetY - 120}
          ${isoXY(0, 0).x + offsetX},${isoXY(0, 0).y + offsetY - 120}`}
        fill="url(#ao-wallGrad)"
        stroke="#C8AE96"
        strokeWidth="1"
      />
      <polygon
        points={`${isoXY(COLS, 0).x + offsetX},${isoXY(COLS, 0).y + offsetY}
          ${isoXY(COLS, ROWS).x + offsetX},${isoXY(COLS, ROWS).y + offsetY}
          ${isoXY(COLS, ROWS).x + offsetX},${isoXY(COLS, ROWS).y + offsetY - 120}
          ${isoXY(COLS, 0).x + offsetX},${isoXY(COLS, 0).y + offsetY - 120}`}
        fill="url(#ao-wallShade)"
        stroke="#B89A80"
        strokeWidth="1"
      />

      {[1, 3, 5].map((i) => {
        const a = isoXY(i, 0);
        const b = isoXY(i + 1.5, 0);
        return (
          <g key={i}>
            <rect
              x={a.x + offsetX + 4}
              y={a.y + offsetY - 90}
              width={b.x - a.x - 8}
              height={50}
              fill="#B3D9E8"
              stroke="#A0C0D0"
            />
            <line
              x1={a.x + offsetX + (b.x - a.x) / 2}
              y1={a.y + offsetY - 90}
              x2={a.x + offsetX + (b.x - a.x) / 2}
              y2={a.y + offsetY - 40}
              stroke="#A0C0D0"
            />
          </g>
        );
      })}

      {tiles.map((t, i) => (
        <polygon
          key={i}
          points={`${t.x},${t.y}
            ${t.x + TILE_W / 2},${t.y + TILE_H / 2}
            ${t.x},${t.y + TILE_H}
            ${t.x - TILE_W / 2},${t.y + TILE_H / 2}`}
          fill={t.alt ? "#D4BFA6" : "#C9B097"}
          stroke="#B89A80"
          strokeWidth="0.5"
        />
      ))}
    </svg>
  );
}
