import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationParams, SimulationData } from '../types';

// FIX: Removed `extend(THREE)` call. In modern @react-three/fiber, it's unnecessary 
// and causes errors as THREE elements are extended by default.

const BOX_SIZE = 5;
const SLICES = 10; // For temperature gradient calculation

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const tempColor = new THREE.Color();
const colorScale = (t: number) => {
    // A purple to red/orange gradient that fits the new theme
    return tempColor.setHSL(0.8 - t * 0.8, 0.9, 0.6);
};

const Particles: React.FC<{ params: SimulationParams; onDataUpdate: (data: SimulationData) => void; }> = ({ params, onDataUpdate }) => {
  const { particleCount, heat, isPaused } = params;
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const particlesRef = useRef<Particle[]>([]);

  // Memoize dummy object to avoid re-creation
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize particles
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
    }));
    if (meshRef.current) {
        meshRef.current.count = particleCount;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleCount]);

  useFrame((_, delta) => {
    if (isPaused || !meshRef.current) return;

    const particles = particlesRef.current;
    const halfBox = BOX_SIZE / 2;
    let totalKineticEnergy = 0;
    const sliceEnergies = Array(SLICES).fill(0);
    const sliceCounts = Array(SLICES).fill(0);

    let energyIn = 0;
    let energyOut = 0;

    particles.forEach((p, i) => {
      p.position.addScaledVector(p.velocity, delta * 60);

      // Wall collisions and temperature effects
      if (Math.abs(p.position.x) > halfBox) {
        p.velocity.x *= -1;
        p.position.x = Math.sign(p.position.x) * halfBox;

        if (p.position.x > 0) { // Hot wall (right)
          const oldSpeed = p.velocity.length();
          p.velocity.x += Math.sign(p.velocity.x) * heat;
          energyIn += p.velocity.lengthSq() - oldSpeed * oldSpeed;
        } else { // Cold wall (left)
          const oldSpeed = p.velocity.length();
          p.velocity.multiplyScalar(0.95); // Damping
          energyOut += oldSpeed * oldSpeed - p.velocity.lengthSq();
        }
      }
      if (Math.abs(p.position.y) > halfBox) {
        p.velocity.y *= -1;
        p.position.y = Math.sign(p.position.y) * halfBox;
      }
      if (Math.abs(p.position.z) > halfBox) {
        p.velocity.z *= -1;
        p.position.z = Math.sign(p.position.z) * halfBox;
      }
      
      const kineticEnergy = p.velocity.lengthSq();
      totalKineticEnergy += kineticEnergy;

      // Update instance
      dummy.position.copy(p.position);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const normalizedSpeed = Math.min(p.velocity.length() * 5, 1.0);
      meshRef.current.setColorAt(i, colorScale(normalizedSpeed));

      // Data calculation
      const sliceIndex = Math.floor(((p.position.x + halfBox) / BOX_SIZE) * SLICES);
      if (sliceIndex >= 0 && sliceIndex < SLICES) {
        sliceEnergies[sliceIndex] += kineticEnergy;
        sliceCounts[sliceIndex]++;
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    
    // Update data for parent component
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

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial emissive="#fff" emissiveIntensity={0.5}/>
    </instancedMesh>
  );
};


export const ThermodynamicsScene: React.FC<{ params: SimulationParams; onDataUpdate: (data: SimulationData) => void; }> = ({ params, onDataUpdate }) => {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} />

      <Particles params={params} onDataUpdate={onDataUpdate} />

      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)]} />
        <lineBasicMaterial color="#59453c" />
      </lineSegments>

      {/* Temperature Wall Indicators */}
      <mesh position={[BOX_SIZE / 2 + 0.1, 0, 0]}>
        <planeGeometry args={[BOX_SIZE, BOX_SIZE]} />
        <meshBasicMaterial color="#7c1f23" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-BOX_SIZE / 2 - 0.1, 0, 0]}>
        <planeGeometry args={[BOX_SIZE, BOX_SIZE]} />
        <meshBasicMaterial color="#59453c" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>

      <OrbitControls />
    </Canvas>
  );
};