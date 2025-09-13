import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationParams, SimulationData } from '../types';
import { Effects } from './Effects';
import { Starfield } from './Starfield';
import { Lighting } from './Lighting';

const BOX_SIZE = 6;
const SLICES = 10;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
}

const tempColor = new THREE.Color();
const colorScale = (t: number) => {
    return tempColor.setHSL(0.7 - t * 0.7, 1.0, 0.6);
};

const Particles: React.FC<{ params: SimulationParams; onDataUpdate: (data: SimulationData) => void; }> = ({ params, onDataUpdate }) => {
  const { particleCount, heat, isPaused } = params;
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const particlesRef = useRef<Particle[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * BOX_SIZE,
        (Math.random() - 0.5) * BOX_SIZE,
        (Math.random() - 0.5) * BOX_SIZE
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      ),
      size: Math.random() * 0.5 + 0.5
    }));
    if (meshRef.current) {
        meshRef.current.count = particleCount;
    }
  }, [particleCount]);

  useFrame((state, delta) => {
    if (isPaused || !meshRef.current) return;

    const particles = particlesRef.current;
    const halfBox = BOX_SIZE / 2;
    const sliceEnergies = Array(SLICES).fill(0);
    const sliceCounts = Array(SLICES).fill(0);
    let energyIn = 0;
    let energyOut = 0;

    particles.forEach((p, i) => {
      p.position.addScaledVector(p.velocity, delta * 60);

      if (Math.abs(p.position.x) > halfBox) {
        p.velocity.x *= -1;
        p.position.x = Math.sign(p.position.x) * halfBox;

        if (p.position.x > 0) {
          const oldSpeed = p.velocity.length();
          p.velocity.x += Math.sign(p.velocity.x) * heat * 0.1;
          p.velocity.multiplyScalar(1.01);
          energyIn += p.velocity.lengthSq() - oldSpeed * oldSpeed;
        } else {
          const oldSpeed = p.velocity.length();
          p.velocity.multiplyScalar(0.9);
          energyOut += oldSpeed * oldSpeed - p.velocity.lengthSq();
        }
      }
      if (Math.abs(p.position.y) > halfBox) p.velocity.y *= -1;
      if (Math.abs(p.position.z) > halfBox) p.velocity.z *= -1;
      
      dummy.position.copy(p.position);
      const speed = p.velocity.length();
      const scale = p.size * (1 + speed * 2);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const normalizedSpeed = Math.min(speed * 5, 1.0);
      meshRef.current.setColorAt(i, colorScale(normalizedSpeed));

      const sliceIndex = Math.floor(((p.position.x + halfBox) / BOX_SIZE) * SLICES);
      if (sliceIndex >= 0 && sliceIndex < SLICES) {
        sliceEnergies[sliceIndex] += speed * speed;
        sliceCounts[sliceIndex]++;
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    
    const temperatureGradient = sliceEnergies.map((energy, i) => 
        sliceCounts[i] > 0 ? energy / sliceCounts[i] : 0
    );
    const tempHot = temperatureGradient[temperatureGradient.length - 1] || 1;
    const tempCold = temperatureGradient[0] || 0.1;
    const entropyProduction = (energyIn / Math.max(0.1, tempHot)) - (energyOut / Math.max(0.1, tempCold));
    
    let systemState: SimulationData['systemState'] = 'Chaotic';
    const gradientStdDev = Math.sqrt(temperatureGradient.map(t => Math.pow(t - (tempHot+tempCold)/2, 2)).reduce((a,b) => a+b, 0) / SLICES);
    
    if (heat < 0.001) systemState = 'Near Equilibrium';
    else if (gradientStdDev > 0.01 && Math.abs(entropyProduction) > 0.01) systemState = 'Steady State';

    onDataUpdate({
        temperatureGradient,
        entropyProduction: Math.max(0, entropyProduction),
        systemState,
    });
  });

  const particleTexture = useLoader(THREE.TextureLoader, '/dot.png');

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
      <planeGeometry args={[0.1, 0.1]} />
      <meshStandardMaterial map={particleTexture} blending={THREE.AdditiveBlending} depthWrite={false} transparent vertexColors />
    </instancedMesh>
  );
};

const HeatSource: React.FC = () => {
    const meshRef = useRef<THREE.Mesh>(null!);
    useFrame(({clock}) => {
        if(!meshRef.current) return;
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = (Math.sin(clock.getElapsedTime() * 2) * 0.1 + 0.2);
    })
    return (
        <mesh ref={meshRef} position={[BOX_SIZE / 2 + 0.1, 0, 0]}>
            <planeGeometry args={[0.1, BOX_SIZE]} />
            <meshBasicMaterial color="red" transparent side={THREE.DoubleSide} emissive="red" emissiveIntensity={2}/>
        </mesh>
    )
}

export const ThermodynamicsScene: React.FC<{ params: SimulationParams; onDataUpdate: (data: SimulationData) => void; }> = ({ params, onDataUpdate }) => {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 60 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <Starfield />
      <Lighting />
      <Particles params={params} onDataUpdate={onDataUpdate} />
      <Box args={[BOX_SIZE, BOX_SIZE, BOX_SIZE]} >
        <meshStandardMaterial color="#555" transparent opacity={0.15} />
      </Box>
      <HeatSource />
      <OrbitControls enableDamping dampingFactor={0.1} />
      <Effects />
    </Canvas>
  );
};