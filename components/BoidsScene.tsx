

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import * as THREE from 'three';
import { Effects } from './Effects';
import { Starfield } from './Starfield';
import { Lighting } from './Lighting';

const BOID_COUNT = 500;
const BOUNDS = 25; // Increased bounds

const MAX_SPEED = 0.25;
const MAX_FORCE = 0.01;

const COHESION_WEIGHT = 1.0;
const ALIGNMENT_WEIGHT = 1.2;
const SEPARATION_WEIGHT = 1.5;
const PREDATOR_WEIGHT = 2.5;

const PERCEPTION_RADIUS = 3;
const SEPARATION_DISTANCE = 1.0;
const PREDATOR_RADIUS = 5;

class Boid {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  color: THREE.Color;

  constructor() {
    this.position = new THREE.Vector3(
      (Math.random() - 0.5) * BOUNDS,
      (Math.random() - 0.5) * BOUNDS,
      (Math.random() - 0.5) * BOUNDS
    );
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).setLength(Math.random() * MAX_SPEED);
    this.acceleration = new THREE.Vector3();
    this.color = new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.7, 0.5);
  }

  applyForce(force: THREE.Vector3) {
    this.acceleration.add(force);
  }
  
  steer(target: THREE.Vector3) {
    const desired = new THREE.Vector3().subVectors(target, this.position);
    desired.setLength(MAX_SPEED);
    const steer = new THREE.Vector3().subVectors(desired, this.velocity);
    steer.clampLength(0, MAX_FORCE);
    return steer;
  }

  flock(boids: Boid[], predatorPosition: THREE.Vector3) {
    const separation = new THREE.Vector3();
    const alignment = new THREE.Vector3();
    const cohesion = new THREE.Vector3();
    let total = 0;

    for (const other of boids) {
      if (other === this) continue;
      const d = this.position.distanceTo(other.position);
      if (d > 0 && d < PERCEPTION_RADIUS) {
        if (d < SEPARATION_DISTANCE) {
          const diff = new THREE.Vector3().subVectors(this.position, other.position);
          diff.normalize();
          diff.divideScalar(d);
          separation.add(diff);
        }
        alignment.add(other.velocity);
        cohesion.add(other.position);
        total++;
      }
    }

    if (total > 0) {
      alignment.divideScalar(total).setLength(MAX_SPEED);
      const alignSteer = this.steer(this.position.clone().add(alignment));
      this.applyForce(alignSteer.multiplyScalar(ALIGNMENT_WEIGHT));

      cohesion.divideScalar(total);
      const cohesionSteer = this.steer(cohesion);
      this.applyForce(cohesionSteer.multiplyScalar(COHESION_WEIGHT));
    }
    
    if(separation.lengthSq() > 0) {
        separation.setLength(MAX_SPEED);
        const separationSteer = this.steer(this.position.clone().add(separation));
        this.applyForce(separationSteer.multiplyScalar(SEPARATION_WEIGHT));
    }
    
    const dPredator = this.position.distanceTo(predatorPosition);
    if (dPredator < PREDATOR_RADIUS) {
      const flee = new THREE.Vector3().subVectors(this.position, predatorPosition);
      flee.setLength(MAX_SPEED);
      const fleeSteer = this.steer(this.position.clone().add(flee));
      this.applyForce(fleeSteer.multiplyScalar(PREDATOR_WEIGHT));
    }
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.clampLength(0, MAX_SPEED);
    this.position.add(this.velocity);
    this.acceleration.multiplyScalar(0);
    this.wrap();
  }

  wrap() {
    const half = BOUNDS / 2;
    if (this.position.x > half) this.position.x = -half;
    if (this.position.x < -half) this.position.x = half;
    if (this.position.y > half) this.position.y = -half;
    if (this.position.y < -half) this.position.y = half;
    if (this.position.z > half) this.position.z = -half;
    if (this.position.z < -half) this.position.z = half;
  }
}

const BoidsSystem: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const predatorRef = useRef<THREE.Mesh>(null!);
  const boids = useMemo(() => Array.from({ length: BOID_COUNT }, () => new Boid()), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const { viewport, pointer, camera } = useThree();
  const targetPredatorPosition = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    boids.forEach((boid, i) => {
      meshRef.current!.setColorAt(i, boid.color);
    });
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [boids]);

  useFrame((state, delta) => {
    if (!meshRef.current || !predatorRef.current) return;
    
    const target = new THREE.Vector3(pointer.x, pointer.y, 0.5);
    target.unproject(camera);
    target.sub(camera.position).normalize();
    const distance = -camera.position.z / target.z;
    targetPredatorPosition.copy(camera.position).add(target.multiplyScalar(distance));
    predatorRef.current.position.lerp(targetPredatorPosition, 0.1);

    boids.forEach(boid => {
      boid.flock(boids, predatorRef.current.position);
      boid.update();
    });

    boids.forEach((boid, i) => {
      dummy.position.copy(boid.position);
      dummy.lookAt(boid.position.clone().add(boid.velocity));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, BOID_COUNT]} castShadow>
        <coneGeometry args={[0.1, 0.6, 8]} />
        <meshStandardMaterial vertexColors metalness={0.8} roughness={0.3} />
      </instancedMesh>
      <mesh ref={predatorRef} castShadow>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial color="red" emissive="red" emissiveIntensity={2} roughness={0.1} />
      </mesh>
    </>
  );
};

export const BoidsScene: React.FC = () => {
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      camera={{ position: [0, 0, 40], fov: 75 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <Starfield />
      <Lighting />
      <BoidsSystem />
      <OrbitControls enableDamping dampingFactor={0.1} />
      <Box args={[BOUNDS, BOUNDS, BOUNDS]} >
        <meshStandardMaterial color="#333" transparent opacity={0.1} wireframe />
      </Box>
      <mesh rotation-x={-Math.PI / 2} position-y={-BOUNDS/2} receiveShadow>
        <planeGeometry args={[BOUNDS, BOUNDS]} />
        <meshStandardMaterial color="#111" metalness={0.5} roughness={0.8} />
      </mesh>
      <Effects />
    </Canvas>
  );
};