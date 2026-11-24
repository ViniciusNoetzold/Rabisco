import type { Rect } from '../layers/types';
import './navegacao-canvas.css';

export function LupaOverlay({ area, zoom }: { area: Rect | null; zoom: number }) {
  if (!area) return null;
  return (
    <div
      className="lupa-area"
      aria-hidden="true"
      style={{
        left: area.x * zoom,
        top: area.y * zoom,
        width: area.width * zoom,
        height: area.height * zoom,
      }}
    />
  );
}
