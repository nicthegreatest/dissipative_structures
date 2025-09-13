import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, createPortal, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

// FIX: Removed `extend(THREE)` call. In modern @react-three/fiber, it's unnecessary 
// and causes errors as THREE elements are extended by default.

// Shaders
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const simFragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uPixelSize;
  uniform vec2 uMouse; // Mouse position in UV coordinates

  // FitzHugh-Nagumo model parameters
  const float Du = 0.2;
  const float Dv = 0.1;
  const float feed = 0.030;
  const float kill = 0.062;
  const float dt = 1.5;

  vec2 laplacian(vec2 uv) {
    vec2 center = texture2D(uTexture, uv).rg;
    vec2 n = texture2D(uTexture, uv + vec2(0.0, uPixelSize.y)).rg;
    vec2 s = texture2D(uTexture, uv - vec2(0.0, uPixelSize.y)).rg;
    vec2 e = texture2D(uTexture, uv + vec2(uPixelSize.x, 0.0)).rg;
    vec2 w = texture2D(uTexture, uv - vec2(uPixelSize.x, 0.0)).rg;
    
    return (n + s + e + w) - 4.0 * center;
  }

  void main() {
    vec2 state = texture2D(uTexture, vUv).rg;
    float u = state.r;
    float v = state.g;
    
    vec2 L = laplacian(vUv);
    
    float reaction = u * v * v;
    
    float u_new = u + (Du * L.x - reaction + feed * (1.0 - u)) * dt;
    float v_new = v + (Dv * L.y + reaction - (feed + kill) * v) * dt;
    
    u_new = clamp(u_new, 0.0, 1.0);
    v_new = clamp(v_new, 0.0, 1.0);

    // Excite the system at the mouse position
    if (uMouse.x > 0.0 && distance(vUv, uMouse) < 0.02) {
      u_new = 1.0;
    }
    
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

    float val = u - v;
    
    // New color palette
    vec3 baseColor = vec3(0.21, 0.13, 0.13);     // brand-d-brown
    vec3 accent1 = vec3(0.486, 0.12, 0.137);   // brand-red
    vec3 accent2 = vec3(0.65, 0.54, 0.44);     // brand-tan
    
    vec3 color = mix(baseColor, accent1, smoothstep(0.0, 0.3, val));
    color = mix(color, accent2, smoothstep(0.3, 0.4, val));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BZSystem: React.FC = () => {
  const { gl, viewport } = useThree();
  const [scene, camera] = useMemo(() => [new THREE.Scene(), new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)], []);
  const mouse = useRef(new THREE.Vector2(-1, -1)); // Offscreen initial
  const [isPointerDown, setIsPointerDown] = useState(false);

  // Frame Buffer Objects
  const fbo1 = useMemo(() => new THREE.WebGLRenderTarget(512, 512, { type: THREE.FloatType }), []);
  const fbo2 = useMemo(() => new THREE.WebGLRenderTarget(512, 512, { type: THREE.FloatType }), []);

  const simulationMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uPixelSize: { value: new THREE.Vector2(1 / 512, 1 / 512) },
      uMouse: { value: mouse.current },
    },
    vertexShader,
    fragmentShader: simFragmentShader,
  }), []);

  const displayMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTexture: { value: fbo1.texture } },
    vertexShader,
    fragmentShader: displayFragmentShader,
  }), [fbo1.texture]);

  // Initialize simulation state
  useEffect(() => {
    const initialData = new Float32Array(512 * 512 * 4);
    for (let i = 0; i < 512 * 512; i++) {
      initialData[i * 4] = 1.0; // u
      initialData[i * 4 + 1] = Math.random() > 0.95 ? 1.0 : 0.0; // v (sparse noise)
    }
    const initialTexture = new THREE.DataTexture(initialData, 512, 512, THREE.RGBAFormat, THREE.FloatType);
    initialTexture.needsUpdate = true;

    const tempScene = new THREE.Scene();
    const tempMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: initialTexture }));
    tempScene.add(tempMesh);
    
    gl.setRenderTarget(fbo1);
    gl.render(tempScene, camera);
    gl.setRenderTarget(null);
  }, [gl, camera, fbo1]);

  let currentFBO = fbo1;
  let nextFBO = fbo2;

  useFrame(() => {
    simulationMaterial.uniforms.uTexture.value = currentFBO.texture;
    simulationMaterial.uniforms.uMouse.value.copy(mouse.current);

    gl.setRenderTarget(nextFBO);
    gl.render(scene, camera);
    
    [currentFBO, nextFBO] = [nextFBO, currentFBO];
    
    gl.setRenderTarget(null);
    displayMaterial.uniforms.uTexture.value = currentFBO.texture;

    // Reset mouse after one frame
    mouse.current.set(-1, -1);
  });

  return (
    <>
      {createPortal(
        <mesh material={simulationMaterial}>
          <planeGeometry args={[2, 2]} />
        </mesh>,
        scene
      )}
      <mesh
        onPointerDown={(e) => { e.stopPropagation(); setIsPointerDown(true); if (e.uv) mouse.current.copy(e.uv); }}
        onPointerUp={() => setIsPointerDown(false)}
        onPointerLeave={() => setIsPointerDown(false)}
        onPointerMove={(e) => { if (isPointerDown && e.uv) mouse.current.copy(e.uv); }}
      >
        <planeGeometry args={[viewport.width, viewport.height]} />
        <primitive object={displayMaterial} attach="material" />
      </mesh>
    </>
  );
};

export const BZReactionScene: React.FC = () => {
    return (
      <Canvas>
        <BZSystem />
      </Canvas>
    );
};