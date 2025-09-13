

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Effects } from './Effects';
import { Starfield } from './Starfield';

const PARTICLE_COUNT = 300; // Increased particle count
const GRID_SIZE = 25;

const vertexShader = `
  uniform float u_time;
  uniform float u_amplitude;
  
  varying vec3 vColor;
  varying float vAlpha;

  // Simplex 3D Noise by Ashima Arts (unchanged)
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){ 
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0); 
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // New color ramp
  vec3 colorRamp(float t) {
    vec3 c1 = vec3(0.0, 0.0, 0.0); // Black for lowest velocity
    vec3 c2 = vec3(0.2, 0.0, 0.4); // Deep purple
    vec3 c3 = vec3(0.8, 0.1, 0.1); // Red/Orange
    vec3 c4 = vec3(1.0, 0.8, 0.4); // Bright Yellow
    vec3 c5 = vec3(1.0, 1.0, 1.0); // White

    t = smoothstep(0.0, 1.0, t);

    vec3 color = mix(c1, c2, smoothstep(-1.0, -0.5, t) - smoothstep(-0.5, 0.0, t));
    color = mix(color, c3, smoothstep(-0.5, 0.0, t) - smoothstep(0.0, 0.5, t));
    color = mix(color, c4, smoothstep(0.0, 0.5, t) - smoothstep(0.5, 1.0, t));
    color = mix(color, c5, smoothstep(0.5, 1.0, t));

    // A more direct multi-mix approach
    t = (t + 1.0) / 2.0; // remap t to 0-1
    vec3 finalColor = mix(c1, c2, smoothstep(0.0, 0.25, t));
    finalColor = mix(finalColor, c3, smoothstep(0.25, 0.5, t));
    finalColor = mix(finalColor, c4, smoothstep(0.5, 0.75, t));
    finalColor = mix(finalColor, c5, smoothstep(0.75, 1.0, t));

    return finalColor;
  }

  void main() {
    vec3 pos = position;
    float time = u_time * 0.1;
    float noise_freq = 1.5;

    float current_noise = snoise(vec3(pos.x * noise_freq, pos.z * noise_freq, time));
    float prev_noise = snoise(vec3(pos.x * noise_freq, pos.z * noise_freq, time - 0.01));
    
    pos.y = u_amplitude * current_noise;
    float velocity = (current_noise - prev_noise) * 50.0;

    // Fade out particles at the edges
    float edgeFade = 1.0 - smoothstep(0.9, 1.0, length(position.xz) / (0.5 * ${GRID_SIZE.toFixed(1)}));
    vAlpha = edgeFade;

    vColor = colorRamp(velocity);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Vary particle size based on velocity and distance
    float baseSize = 15.0;
    float sizeVelocityFactor = 1.0 + abs(velocity) * 2.0;
    gl_PointSize = baseSize * sizeVelocityFactor * (1.0 / -mvPosition.z);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Render particles as soft-edged circles
    float dist = length(gl_PointCoord - vec2(0.5));
    float alpha = 1.0 - smoothstep(0.45, 0.5, dist);

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(vColor, alpha * vAlpha);
  }
`;

const ConvectionSystem: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null!);

  const particles = useMemo(() => {
    const totalParticles = PARTICLE_COUNT * PARTICLE_COUNT;
    const positions = new Float32Array(totalParticles * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = 0; j < PARTICLE_COUNT; j++) {
        const index = (i * PARTICLE_COUNT + j) * 3;
        positions[index] = (i / PARTICLE_COUNT - 0.5) * GRID_SIZE;
        positions[index + 1] = 0;
        positions[index + 2] = (j / PARTICLE_COUNT - 0.5) * GRID_SIZE;
      }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0.0 },
      u_amplitude: { value: 2.5 }, // Increased amplitude for more dynamism
    },
    vertexShader,
    fragmentShader,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    transparent: true,
  }), []);

  useFrame((state) => {
    material.uniforms.u_time.value = state.clock.getElapsedTime();
  });

  return <points ref={pointsRef} geometry={particles} material={material} />;
};

export const ConvectionCellsScene: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [0, 15, 30], fov: 60 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <Starfield />
      <ConvectionSystem />
      <OrbitControls enableDamping dampingFactor={0.1} />
      <Effects />
      <mesh>
        <boxGeometry args={[GRID_SIZE + 1, 8, GRID_SIZE + 1]} />
        <meshBasicMaterial color="white" wireframe opacity={0.1} transparent />
      </mesh>
    </Canvas>
  );
};