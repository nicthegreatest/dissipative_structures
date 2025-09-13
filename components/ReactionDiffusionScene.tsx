import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree, createPortal } from '@react-three/fiber';
import { OrbitControls, TorusKnot } from '@react-three/drei';
import * as THREE from 'three';
import type { ReactionDiffusionParams } from '../types';

// FIX: Removed `extend(THREE)` call. In modern @react-three/fiber, it's unnecessary 
// and causes errors as THREE elements are extended by default.

// GLSL Shaders
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const simFragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uPixelSize;
  uniform float uFeed;
  uniform float uKill;

  const float Du = 0.16;
  const float Dv = 0.08;
  const float dt = 1.0;

  vec2 laplacian(vec2 uv) {
    vec2 center = texture2D(uTexture, uv).rg;
    vec2 n = texture2D(uTexture, uv + vec2(0.0, uPixelSize.y)).rg;
    vec2 s = texture2D(uTexture, uv - vec2(0.0, uPixelSize.y)).rg;
    vec2 e = texture2D(uTexture, uv + vec2(uPixelSize.x, 0.0)).rg;
    vec2 w = texture2D(uTexture, uv - vec2(uPixelSize.x, 0.0)).rg;
    
    vec2 ne = texture2D(uTexture, uv + uPixelSize).rg;
    vec2 nw = texture2D(uTexture, uv + vec2(-uPixelSize.x, uPixelSize.y)).rg;
    vec2 se = texture2D(uTexture, uv + vec2(uPixelSize.x, -uPixelSize.y)).rg;
    vec2 sw = texture2D(uTexture, uv - uPixelSize).rg;

    return (
      (n + s + e + w) * 0.2 +
      (ne + nw + se + sw) * 0.05 -
      center
    );
  }

  void main() {
    vec2 uv = texture2D(uTexture, vUv).rg;
    vec2 L = laplacian(vUv);
    
    float reaction = uv.x * uv.y * uv.y;
    
    float u_new = uv.x + (Du * L.x - reaction + uFeed * (1.0 - uv.x)) * dt;
    float v_new = uv.y + (Dv * L.y + reaction - (uFeed + uKill) * uv.y) * dt;
    
    u_new = clamp(u_new, 0.0, 1.0);
    v_new = clamp(v_new, 0.0, 1.0);
    
    gl_FragColor = vec4(u_new, v_new, 0.0, 1.0);
  }
`;

const displayFragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uTexture;

  void main() {
    vec2 state = texture2D(uTexture, vUv).rg;
    float u = state.r;
    float v = state.g;
    
    // New color palette
    vec3 baseColor = vec3(0.05, 0.05, 0.05);     // brand-black
    vec3 accent1 = vec3(0.486, 0.12, 0.137);   // brand-red
    vec3 accent2 = vec3(0.65, 0.54, 0.44);     // brand-tan

    vec3 color = baseColor + accent1 * v * 1.2 + accent2 * u * 0.5;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

const RDSystem: React.FC<{ params: ReactionDiffusionParams }> = ({ params }) => {
  const { gl, size } = useThree();
  const [scene, camera] = useMemo(() => [new THREE.Scene(), new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)], []);

  const fbo1 = useMemo(() => new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.FloatType }), [size]);
  const fbo2 = useMemo(() => new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.FloatType }), [size]);
  
  const simulationMaterial = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uTexture: { value: null }, uPixelSize: { value: new THREE.Vector2() }, uFeed: { value: 0.0 }, uKill: { value: 0.0 } }, vertexShader, fragmentShader: simFragmentShader }), []);
  const displayMaterial = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uTexture: { value: null } }, vertexShader, fragmentShader: displayFragmentShader }), []);
  
  useEffect(() => {
    const seedSize = 10;
    const initialData = new Float32Array(size.width * size.height * 4);
    for (let i = 0; i < size.width * size.height; i++) {
      const x = (i % size.width);
      const y = Math.floor(i / size.width);
      initialData[i * 4] = 1.0; // u
      
      const isSeed = Math.abs(x - size.width / 2) < seedSize && Math.abs(y - size.height / 2) < seedSize;
      initialData[i * 4 + 1] = isSeed ? 1.0 : 0.0; // v
    }
    const initialTexture = new THREE.DataTexture(initialData, size.width, size.height, THREE.RGBAFormat, THREE.FloatType);
    initialTexture.needsUpdate = true;
    
    const tempScene = new THREE.Scene();
    const tempMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: initialTexture }));
    tempScene.add(tempMesh);
    
    gl.setRenderTarget(fbo1);
    gl.render(tempScene, camera);
    gl.setRenderTarget(null);

  }, [gl, camera, size, fbo1]);

  let currentFBO = fbo1;
  let nextFBO = fbo2;

  useFrame(() => {
    for (let i = 0; i < 5; i++) {
        simulationMaterial.uniforms.uTexture.value = currentFBO.texture;
        simulationMaterial.uniforms.uPixelSize.value.set(1 / size.width, 1 / size.height);
        simulationMaterial.uniforms.uFeed.value = params.feed;
        simulationMaterial.uniforms.uKill.value = params.kill;

        gl.setRenderTarget(nextFBO);
        gl.render(scene, camera);
        
        [currentFBO, nextFBO] = [nextFBO, currentFBO];
    }
    
    gl.setRenderTarget(null);
    displayMaterial.uniforms.uTexture.value = currentFBO.texture;
  });

  return (
    <>
      {createPortal(
        <mesh material={simulationMaterial}>
          <planeGeometry args={[2, 2]} />
        </mesh>,
        scene
      )}
      <TorusKnot args={[1, 0.4, 256, 32]} material={displayMaterial}>
      </TorusKnot>
    </>
  );
};

export const ReactionDiffusionScene: React.FC<{ params: ReactionDiffusionParams }> = ({ params }) => {
  return (
    <Canvas camera={{ position: [0, 0, 3.5], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <RDSystem params={params} />
      <OrbitControls />
    </Canvas>
  );
};