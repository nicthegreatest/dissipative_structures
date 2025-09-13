

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const BOID_COUNT = 500;
const BOUNDS = 20;

const MAX_SPEED = 0.2;
const MAX_FORCE = 0.01;

const COHESION_WEIGHT = 1.0;
const ALIGNMENT_WEIGHT = 1.2;
const SEPARATION_WEIGHT = 1.5;
const PREDATOR_WEIGHT = 2.5;

const PERCEPTION_RADIUS = 3;
const SEPARATION_DISTANCE = 1.0;
const PREDATOR_RADIUS = 4;

class Boid {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;

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
      const d = this.position.distanceTo(other.position);
      if (d > 0 && d < PERCEPTION_RADIUS) {
        // Separation
        if (d < SEPARATION_DISTANCE) {
          const diff = new THREE.Vector3().subVectors(this.position, other.position);
          diff.normalize();
          diff.divideScalar(d); // Weight by distance
          separation.add(diff);
        }
        // Alignment
        alignment.add(other.velocity);
        // Cohesion
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
    
    // Predator avoidance
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
  
  const { viewport, pointer } = useThree();
  const targetPredatorPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!meshRef.current || !predatorRef.current) return;
    
    // Update predator position smoothly
    targetPredatorPosition.set(
      (pointer.x * viewport.width) / 2,
      (pointer.y * viewport.height) / 2,
      0
    );
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
      <instancedMesh ref={meshRef} args={[undefined, undefined, BOID_COUNT]}>
        <coneGeometry args={[0.1, 0.5, 8]} />
        <meshStandardMaterial color="#a78a70" />
      </instancedMesh>
      <mesh ref={predatorRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#7c1f23" emissive="#7c1f23" emissiveIntensity={0.5} />
      </mesh>
    </>
  );
};

export const BoidsScene: React.FC = () => {
  return (
    <Canvas camera={{ position: [0, 0, 30], fov: 75 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 50]} intensity={1} />
      <BoidsSystem />
      <OrbitControls enabled={false} />
       <mesh>
        <boxGeometry args={[BOUNDS, BOUNDS, BOUNDS]} />
        <meshBasicMaterial wireframe color="#59453c" />
      </mesh>
    </Canvas>
  );
};