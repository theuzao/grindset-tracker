import { useEffect, useRef } from 'react';

interface FireworksProps {
  isActive: boolean;
  duration?: number;
  onComplete?: () => void;
}

export function Fireworks({ isActive, duration = 3000, onComplete }: FireworksProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Generate firework sound
  const playFireworkSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      // Create explosion sound
      const createExplosion = (delay: number) => {
        setTimeout(() => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          // Noise-like explosion
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(150 + Math.random() * 100, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(3000, ctx.currentTime);
          filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);

          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

          oscillator.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.5);
        }, delay);
      };

      // Create whistle sound (rocket going up)
      const createWhistle = (delay: number) => {
        setTimeout(() => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(400, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);

          gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.3);
        }, delay);
      };

      // Play multiple fireworks
      createWhistle(0);
      createExplosion(300);
      createWhistle(400);
      createExplosion(700);
      createWhistle(900);
      createExplosion(1200);
      createWhistle(1500);
      createExplosion(1800);
      createExplosion(2000);
      createExplosion(2200);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  useEffect(() => {
    if (isActive) {
      playFireworkSound();

      const timer = setTimeout(() => {
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isActive, duration, onComplete]);

  if (!isActive) return null;

  // Generate random particles
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 30,
    y: 50 + (Math.random() - 0.5) * 30,
    color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA'][
      Math.floor(Math.random() * 8)
    ],
    delay: Math.random() * 2,
    duration: 0.5 + Math.random() * 0.5,
    angle: Math.random() * 360,
    distance: 20 + Math.random() * 40,
  }));

  // Generate rocket trails
  const rockets = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    startX: 30 + Math.random() * 40,
    delay: i * 0.3 + Math.random() * 0.2,
  }));

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden"
      style={{ perspective: '1000px' }}
    >
      {/* Rockets going up */}
      {rockets.map((rocket) => (
        <div
          key={`rocket-${rocket.id}`}
          className="absolute bottom-0"
          style={{
            left: `${rocket.startX}%`,
            animation: `rocketUp 0.6s ease-out ${rocket.delay}s forwards`,
          }}
        >
          <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/50" />
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1 h-8 opacity-60"
            style={{
              background: 'linear-gradient(to bottom, rgba(255,200,100,0.8), transparent)',
            }}
          />
        </div>
      ))}

      {/* Explosion particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: '8px',
            height: '8px',
            backgroundColor: particle.color,
            boxShadow: `0 0 10px ${particle.color}, 0 0 20px ${particle.color}`,
            animation: `explode ${particle.duration}s ease-out ${particle.delay}s forwards`,
            transform: `rotate(${particle.angle}deg) translateX(0)`,
            opacity: 0,
          }}
        />
      ))}

      {/* Sparkles */}
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={`sparkle-${i}`}
          className="absolute"
          style={{
            left: `${30 + Math.random() * 40}%`,
            top: `${20 + Math.random() * 40}%`,
            animation: `sparkle 0.8s ease-out ${0.5 + Math.random() * 2}s infinite`,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M6 0L7 5L12 6L7 7L6 12L5 7L0 6L5 5Z"
              fill={['#FFD700', '#FFF', '#FF69B4', '#00FFFF'][Math.floor(Math.random() * 4)]}
            />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes rocketUp {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(-60vh);
            opacity: 0;
          }
        }

        @keyframes explode {
          0% {
            transform: scale(0) rotate(var(--angle, 0deg)) translateX(0);
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(var(--angle, 0deg)) translateX(80px);
            opacity: 0;
          }
        }

        @keyframes sparkle {
          0%, 100% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1) rotate(180deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
