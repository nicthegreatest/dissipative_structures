import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, createPortal } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Effects } from './Effects';
import { Starfield } from './Starfield';

const FBO_SIZE = 512;
const PLANE_SIZE = 20;
const PLANE_SEGMENTS = 256;

const simVertexShader = `
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
  uniform vec2 uMouse;
  uniform float uTime;

  const float Du = 0.16;
  const float Dv = 0.08;
  const float feed = 0.03;
  const float kill = 0.06;
  const float dt = 2.0;

  vec2 laplacian(vec2 uv) {
    vec2 sum = vec2(0.0);
    sum += texture2D(uTexture, uv + vec2(0.0, uPixelSize.y)).rg * 0.20;
    sum += texture2D(uTexture, uv - vec2(0.0, uPixelSize.y)).rg * 0.20;
    sum += texture2D(uTexture, uv + vec2(uPixelSize.x, 0.0)).rg * 0.20;
    sum += texture2D(uTexture, uv - vec2(uPixelSize.x, 0.0)).rg * 0.20;
    sum += texture2D(uTexture, uv + uPixelSize * vec2(1,1)).rg * 0.05;
    sum += texture2D(uTexture, uv + uPixelSize * vec2(-1,1)).rg * 0.05;
    sum += texture2D(uTexture, uv + uPixelSize * vec2(1,-1)).rg * 0.05;
    sum += texture2D(uTexture, uv + uPixelSize * vec2(-1,-1)).rg * 0.05;
    sum -= texture2D(uTexture, uv).rg;
    return sum;
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

    if (uMouse.x > 0.0 && distance(vUv, uMouse) < 0.02) {
      u_new = 1.0;
    }
    
    gl_FragColor = vec4(u_new, v_new, 0.0, 1.0);
  }
`;

const displayVertexShader = `
  uniform sampler2D uTexture;
  uniform float uDisplacementScale;
  varying vec2 vUv;
  varying float vValue;

  void main() {
    vUv = uv;
    vec2 state = texture2D(uTexture, uv).rg;
    float displacement = state.r - state.g;
    vValue = displacement;

    vec3 displacedPosition = position + normal * displacement * uDisplacementScale;

    vec4 modelViewPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
  }
`;

const displayFragmentShader = `
  varying vec2 vUv;
  varying float vValue;

  vec3 colorRamp(float t) {
    vec3 c1 = vec3(0.05, 0.0, 0.1);    // Deep Blue/Purple
    vec3 c2 = vec3(0.2, 0.3, 0.9);    // Bright Blue
    vec3 c3 = vec3(1.0, 0.2, 0.2);    // Fiery Red
    vec3 c4 = vec3(1.0, 0.9, 0.1);    // Bright Yellow
    
    t = smoothstep(0.0, 1.0, t * 1.5 - 0.2); // Adjust contrast/brightness

    vec3 color = mix(c1, c2, smoothstep(0.0, 0.3, t));
    color = mix(color, c3, smoothstep(0.3, 0.6, t));
    color = mix(color, c4, smoothstep(0.6, 1.0, t));
    
    return color;
  }

  void main() {
    vec3 color = colorRamp(vValue);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const Ripple: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [isAnimating, setIsAnimating] = useState(true);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const elapsedTime = clock.getElapsedTime() - meshRef.current.userData.startTime;
    if (elapsedTime > 1.0) {
      setIsAnimating(false);
      return;
    }
    const scale = Math.sin(elapsedTime * Math.PI) * 0.5;
    meshRef.current.scale.set(scale, scale, scale);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 1.0 - elapsedTime;
  });

  if (!isAnimating) return null;

  return (
    <mesh ref={meshRef} position={position} userData={{ startTime: useThree().clock.getElapsedTime() }}>
      <ringGeometry args={[0.2, 0.3, 32]} />
      <meshBasicMaterial color="yellow" transparent side={THREE.DoubleSide} />
    </mesh>
  );
};

const BZSystem: React.FC = () => {
  const { gl, viewport, camera: mainCamera } = useThree();
  const [scene, camera] = useMemo(() => [new THREE.Scene(), new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)], []);
  const mouse = useRef(new THREE.Vector2(-1, -1));
  const [ripples, setRipples] = useState<{ id: number, position: THREE.Vector3 }[]>([]);

  const fbo1 = useMemo(() => new THREE.WebGLRenderTarget(FBO_SIZE, FBO_SIZE, { type: THREE.FloatType }), []);
  const fbo2 = useMemo(() => new THREE.WebGLRenderTarget(FBO_SIZE, FBO_SIZE, { type: THREE.FloatType }), []);

  const simulationMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uPixelSize: { value: new THREE.Vector2(1 / FBO_SIZE, 1 / FBO_SIZE) },
      uMouse: { value: mouse.current },
    },
    vertexShader: simVertexShader,
    fragmentShader: simFragmentShader,
  }), []);

  const displayMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: fbo1.texture },
      uDisplacementScale: { value: 1.5 },
    },
    vertexShader: displayVertexShader,
    fragmentShader: displayFragmentShader,
  }), [fbo1.texture]);

  useEffect(() => {
    const initialData = new Float32Array(FBO_SIZE * FBO_SIZE * 4);
    for (let i = 0; i < FBO_SIZE * FBO_SIZE; i++) {
      initialData[i * 4] = 1.0;
      initialData[i * 4 + 1] = Math.random() > 0.98 ? 1.0 : 0.0;
    }
    const initialTexture = new THREE.DataTexture(initialData, FBO_SIZE, FBO_SIZE, THREE.RGBAFormat, THREE.FloatType);
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
    for (let i = 0; i < 2; i++) { // Run simulation twice per frame for speed
      simulationMaterial.uniforms.uTexture.value = currentFBO.texture;
      simulationMaterial.uniforms.uMouse.value.copy(mouse.current);

      gl.setRenderTarget(nextFBO);
      gl.render(scene, camera);

      [currentFBO, nextFBO] = [nextFBO, currentFBO];
    }
    
    gl.setRenderTarget(null);
    displayMaterial.uniforms.uTexture.value = currentFBO.texture;
    mouse.current.set(-1, -1);
  });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (e.uv) mouse.current.copy(e.uv);

    const ripplePos = new THREE.Vector3(e.point.x, e.point.y, e.point.z + 0.1);
    setRipples(prev => [...prev, { id: Date.now(), position: ripplePos }]);
    setTimeout(() => {
        setRipples(prev => prev.slice(1));
    }, 1000);
  };

  return (
    <>
      {createPortal(
        <mesh material={simulationMaterial}><planeGeometry args={[2, 2]} /></mesh>,
        scene
      )}
      <mesh
        onPointerDown={handlePointerDown}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, PLANE_SEGMENTS, PLANE_SEGMENTS]} />
        <primitive object={displayMaterial} attach="material" />
      </mesh>
      {ripples.map(r => <Ripple key={r.id} position={r.position} />)}
    </>
  );
};

export const BZReactionScene: React.FC = () => {
    return (
      <Canvas
        camera={{ position: [0, 10, 15], fov: 75 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Starfield />
        <ambientLight intensity={0.5} />
        <pointLight position={[0, 10, 0]} intensity={1} />
        <BZSystem />
        <OrbitControls enableDamping dampingFactor={0.1} />
        <Effects />
      </Canvas>
    );
};