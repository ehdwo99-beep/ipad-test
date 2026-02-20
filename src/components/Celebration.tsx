import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
}

const COLORS = [
  "hsl(45, 100%, 60%)",
  "hsl(340, 70%, 65%)",
  "hsl(200, 80%, 60%)",
  "hsl(140, 60%, 55%)",
  "hsl(30, 100%, 65%)",
  "hsl(280, 60%, 65%)",
];

export default function Celebration({ onComplete }: { onComplete?: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 40; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 8 + Math.random() * 20,
        delay: Math.random() * 0.5,
        duration: 1 + Math.random() * 1.5,
      });
    }
    setParticles(newParticles);

    const timer = setTimeout(() => {
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `float-up ${p.duration}s ease-out ${p.delay}s forwards, sparkle ${p.duration * 0.5}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
      {/* Big star bursts */}
      {[...Array(8)].map((_, i) => (
        <div
          key={`star-${i}`}
          className="absolute text-4xl md:text-6xl"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            animation: `sparkle 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        >
          ⭐
        </div>
      ))}
    </div>
  );
}
