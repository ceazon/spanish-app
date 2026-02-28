// Spanish-app/src/components/Celebration.jsx

import React, { useEffect, useRef } from 'react';

// --- Web Audio API Sound Synthesizer ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (!audioContext) return;
  
  if (type === 'sublevel') {
    // A simple, pleasant chime for leveling up
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    
    oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioContext.currentTime + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.6);
  } else if (type === 'band') {
    // A more triumphant, orchestral-like fanfare for major milestones
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((note, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, audioContext.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.4, audioContext.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + i * 0.15 + 0.4);
      osc.start(audioContext.currentTime + i * 0.15);
      osc.stop(audioContext.currentTime + i * 0.15 + 0.5);
    });
  }
}

// --- HTML Canvas Animation ---
function drawCanvas(canvas, type) {
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    const particles = [];
    const width = canvas.width = window.innerWidth;
    const height = canvas.height = window.innerHeight;

    function createParticles(count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height - height,
                vx: Math.random() * 10 - 5,
                vy: Math.random() * 5 + 2,
                radius: Math.random() * 3 + 2,
                color: `hsl(${Math.random() * 360}, 90%, 70%)`,
            });
        }
    }

    const particleCount = type === 'band' ? 400 : 100;
    createParticles(particleCount);

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.y += p.vy;
            p.x += p.vx;
            p.vy += 0.05; // Gravity

            if (p.y > height) { // Reset particle when it falls off screen
                p.y = Math.random() * height - height;
                p.x = Math.random() * width;
                p.vx = Math.random() * 10 - 5;
                p.vy = Math.random() * 5 + 2;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
        animationFrameId = window.requestAnimationFrame(animate);
    }
    animate();

    return () => {
        window.cancelAnimationFrame(animationFrameId);
    };
}

export function Celebration({ type, title, onComplete }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    playSound(type);
    const cleanupCanvas = drawCanvas(canvasRef.current, type);
    
    const timer = setTimeout(onComplete, 4000); // Celebration lasts 4 seconds

    return () => {
      clearTimeout(timer);
      cleanupCanvas();
    };
  }, [type, onComplete]);

  const styles = {
    band: {
      backgroundColor: 'rgba(17, 10, 33, 0.9)',
      titleColor: '#fff',
      fontSize: '48px',
      message: 'Band Complete!',
    },
    sublevel: {
      backgroundColor: 'rgba(17, 10, 33, 0.8)',
      titleColor: '#d8b4fe',
      fontSize: '32px',
      message: 'Level Up!',
    }
  };
  const style = styles[type] || styles.sublevel;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: style.backgroundColor,
      color: '#fff',
      textAlign: 'center',
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
      <div style={{ zIndex: 1 }}>
        <div style={{ fontSize: '24px', color: '#a78bfa', letterSpacing: 3 }}>{style.message}</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: style.fontSize, color: style.titleColor, margin: '16px 0' }}>
          {title}
        </h1>
      </div>
    </div>
  );
}
