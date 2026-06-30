"use client";

import { useEffect, useRef } from "react";

export function HomeHeroOrbit() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let animationId = 0;
    let width = 0;
    let height = 0;
    let ratio = 1;

    const particles = Array.from({ length: 76 }, (_, index) => ({
      angle: (index / 76) * Math.PI * 2,
      orbit: 0.2 + (index % 6) * 0.064,
      speed: 0.0032 + (index % 7) * 0.00056,
      size: 1.6 + (index % 5) * 0.62,
      phase: index * 0.37,
    }));

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(box.width));
      height = Math.max(1, Math.floor(box.height));
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const cx = width * 0.63;
      const cy = height * 0.48;
      const base = Math.min(width, height);
      const time = frame;

      context.lineWidth = 1.25;
      for (let i = 0; i < 8; i += 1) {
        const radiusX = base * (0.22 + i * 0.06);
        const radiusY = radiusX * (0.38 + i * 0.016);
        context.save();
        context.translate(cx, cy);
        context.rotate(-0.36 + i * 0.13 + time * 0.0018);
        context.beginPath();
        context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
        context.strokeStyle = i % 2 === 0 ? "rgba(15, 107, 72, 0.32)" : "rgba(79, 99, 217, 0.24)";
        context.setLineDash(i % 2 === 0 ? [4, 8] : [12, 12]);
        context.stroke();
        context.restore();
      }

      for (let i = 0; i < 3; i += 1) {
        const sweep = (time * 0.016 + i * 2.1) % (Math.PI * 2);
        context.save();
        context.translate(cx, cy);
        context.rotate(-0.28 + i * 0.18);
        context.beginPath();
        context.arc(0, 0, base * (0.23 + i * 0.08), sweep, sweep + Math.PI * 0.42);
        context.strokeStyle = i === 1 ? "rgba(91, 79, 229, 0.38)" : "rgba(15, 107, 72, 0.42)";
        context.lineWidth = 2.1 - i * 0.25;
        context.lineCap = "round";
        context.stroke();
        context.restore();
      }

      const nodePoints: Array<[number, number]> = [];
      for (const particle of particles) {
        const angle = particle.angle + time * particle.speed;
        const x = cx + Math.cos(angle) * base * particle.orbit;
        const y = cy + Math.sin(angle + particle.phase) * base * particle.orbit * 0.38;
        nodePoints.push([x, y]);
        const alpha = 0.38 + Math.sin(time * 0.03 + particle.phase) * 0.32;
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(15, 107, 72, ${Math.max(0.18, alpha)})`;
        context.fill();
      }

      context.lineWidth = 1;
      for (let i = 0; i < nodePoints.length; i += 8) {
        const [x1, y1] = nodePoints[i];
        const [x2, y2] = nodePoints[(i + 19) % nodePoints.length];
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.strokeStyle = "rgba(63, 125, 217, 0.24)";
        context.stroke();
      }

      const pulse = 0.65 + Math.sin(time * 0.032) * 0.25;
      const glow = context.createRadialGradient(cx, cy, 0, cx, cy, base * 0.25);
      glow.addColorStop(0, `rgba(15, 107, 72, ${0.46 + pulse * 0.18})`);
      glow.addColorStop(0.48, "rgba(15, 107, 72, 0.16)");
      glow.addColorStop(1, "rgba(15, 107, 72, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(cx, cy, base * 0.25, 0, Math.PI * 2);
      context.fill();

      const scanX = ((time * 2.25) % (width + 240)) - 120;
      const scan = context.createLinearGradient(scanX - 60, 0, scanX + 80, 0);
      scan.addColorStop(0, "rgba(255, 255, 255, 0)");
      scan.addColorStop(0.4, "rgba(91, 79, 229, 0.08)");
      scan.addColorStop(0.52, "rgba(255, 255, 255, 0.62)");
      scan.addColorStop(0.64, "rgba(15, 107, 72, 0.12)");
      scan.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = scan;
      context.fillRect(scanX - 90, 0, 190, height);

      if (!reduceMotion) {
        frame += 1;
        animationId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationId) window.cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="a519-orbit-canvas" aria-hidden="true" />;
}
