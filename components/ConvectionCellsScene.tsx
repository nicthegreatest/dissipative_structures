
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const PARTICLE_COUNT = 200; // Grid will be PARTICLE_COUNT x PARTICLE_COUNT
const GRID_SIZE = 20;

const vertexShader = `
  uniform float u_time;
  uniform float u_amplitude;
  
  varying vec3 vColor;

  // Simplex 3D Noise by Ashima Arts
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

  void main() {
    vec3 pos = position;
    float time = u_time * 0.1;
    float noise_freq = 1.5;

    // Calculate noise at current time and a moment before to find velocity
    float current_noise = snoise(vec3(pos.x * noise_freq, pos.z * noise_freq, time));
    float prev_noise = snoise(vec3(pos.x * noise_freq, pos.z * noise_freq, time - 0.01));
    
    // Y-position is based on current noise
    pos.y = u_amplitude * current_noise;

    // Velocity is the change in position (noise)
    float velocity = (current_noise - prev_noise) * 50.0; // Scaled for color mapping

    // Color mapping
    vec3 hotColor = vec3(1.0, 1.0, 0.6); // Bright yellow
    vec3 coolColor = vec3(0.2, 0.1, 0.5); // Dark purple
    float colorMix = smoothstep(-1.0, 1.0, velocity);
    vColor = mix(coolColor, hotColor, colorMix);

    // Final position and size
    vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = 2.0;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
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
        positions[index] = (i / PARTICLE_COUNT - 0.5) * GRID_SIZE; // x
        positions[index + 1] = 0; // y
        positions[index + 2] = (j / PARTICLE_COUNT - 0.5) * GRID_SIZE; // z
      }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0.0 },
      u_amplitude: { value: 1.5 },
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
    <Canvas camera={{ position: [0, 10, 15], fov: 60 }}>
      <color attach="background" args={['#111118']} />
      <ConvectionSystem />
      <OrbitControls />
    </Canvas>
  );
};
