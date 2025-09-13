import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree, createPortal } from '@react-three/fiber';
import { OrbitControls, TorusKnot } from '@react-three/drei';
import * as THREE from 'three';
import type { ReactionDiffusionParams } from '../types';
import { Effects } from './Effects';
import { Starfield } from './Starfield';
import { Lighting } from './Lighting';

const FBO_SIZE = 512;

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
  uniform float uFeed;
  uniform float uKill;

  const float Du = 0.16;
  const float Dv = 0.08;
  const float dt = 1.0;

  vec2 laplacian(vec2 uv) {
    vec2 sum = vec2(0.0);
    sum += texture2D(uTexture, uv + vec2(0.0, uPixelSize.y)).rg * 0.2;
    sum += texture2D(uTexture, uv - vec2(0.0, uPixelSize.y)).rg * 0.2;
    sum += texture2D(uTexture, uv + vec2(uPixelSize.x, 0.0)).rg * 0.2;
    sum += texture2D(uTexture, uv - vec2(uPixelSize.x, 0.0)).rg * 0.2;
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
    
    float reaction = u * v * v;
    
    float u_new = u + (Du * L.x - reaction + uFeed * (1.0 - u)) * dt;
    float v_new = v + (Dv * L.y + reaction - (uFeed + uKill) * v) * dt;
    
    u_new = clamp(u_new, 0.0, 1.0);
    v_new = clamp(v_new, 0.0, 1.0);
    
    gl_FragColor = vec4(u_new, v_new, 0.0, 1.0);
  }
`;

const RDSystem: React.FC<{ params: ReactionDiffusionParams, onTextureUpdate: (texture: THREE.Texture) => void }> = ({ params, onTextureUpdate }) => {
  const { gl } = useThree();
  const [scene, camera] = useMemo(() => [new THREE.Scene(), new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)], []);

  const fbo1 = useMemo(() => new THREE.WebGLRenderTarget(FBO_SIZE, FBO_SIZE, { type: THREE.FloatType }), []);
  const fbo2 = useMemo(() => new THREE.WebGLRenderTarget(FBO_SIZE, FBO_SIZE, { type: THREE.FloatType }), []);
  
  const simulationMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uPixelSize: { value: new THREE.Vector2(1 / FBO_SIZE, 1 / FBO_SIZE) },
      uFeed: { value: params.feed },
      uKill: { value: params.kill }
    },
    vertexShader: simVertexShader,
    fragmentShader: simFragmentShader
  }), []);

  useEffect(() => {
    simulationMaterial.uniforms.uFeed.value = params.feed;
    simulationMaterial.uniforms.uKill.value = params.kill;
  }, [params, simulationMaterial]);
  
  useEffect(() => {
    const seedSize = 20;
    const initialData = new Float32Array(FBO_SIZE * FBO_SIZE * 4);
    for (let i = 0; i < FBO_SIZE * FBO_SIZE; i++) {
      const x = i % FBO_SIZE;
      const y = Math.floor(i / FBO_SIZE);
      initialData[i * 4] = 1.0;
      const isSeed = Math.abs(x - FBO_SIZE / 2) < seedSize && Math.abs(y - FBO_SIZE / 2) < seedSize;
      initialData[i * 4 + 1] = isSeed ? 1.0 : 0.0;
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
    for (let i = 0; i < 8; i++) {
        simulationMaterial.uniforms.uTexture.value = currentFBO.texture;
        gl.setRenderTarget(nextFBO);
        gl.render(scene, camera);
        [currentFBO, nextFBO] = [nextFBO, currentFBO];
    }
    onTextureUpdate(currentFBO.texture);
  });

  return createPortal(
    <mesh material={simulationMaterial}><planeGeometry args={[2, 2]} /></mesh>,
    scene
  );
};

const DisplayMesh: React.FC = () => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  const onTextureUpdate = (texture: THREE.Texture) => {
    if (materialRef.current) {
      (materialRef.current.userData.shader.uniforms.uTexture as THREE.IUniform).value = texture;
    }
  };

  const onBeforeCompile = (shader: THREE.Shader) => {
    shader.uniforms.uTexture = { value: null };
    shader.fragmentShader = `
      uniform sampler2D uTexture;
      varying vec2 vUv; // Use the default vUv from MeshStandardMaterial
      ${shader.fragmentShader}
    `.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      vec2 state = texture2D(uTexture, vUv).rg;
      float u = state.r;
      float v = state.g;

      vec3 patternColor = vec3(0.9, 0.9, 0.1) * v + vec3(0.1, 0.1, 0.9) * (1.0 - v);
      diffuseColor.rgb = mix(diffuseColor.rgb, patternColor, smoothstep(0.0, 0.5, v));

      float normalOffset = (v - 0.5) * 0.1;
      vec3 newNormal = normalize(vNormal + vec3(dFdx(normalOffset), dFdy(normalOffset), 0.0));
      `
    ).replace(
      '#include <normal_fragment_maps>',
      `
      #include <normal_fragment_maps>
      normal = normalize(normal + newNormal * 0.5);
      `
    );
    materialRef.current.userData.shader = shader;
  };

  return (
    <>
      <RDSystem params={{ feed: 0.055, kill: 0.062 }} onTextureUpdate={onTextureUpdate} />
      <TorusKnot args={[1, 0.4, 256, 32]} castShadow>
          <meshStandardMaterial
            ref={materialRef}
            metalness={0.2}
            roughness={0.5}
            onBeforeCompile={onBeforeCompile}
          />
      </TorusKnot>
    </>
  );
};


export const ReactionDiffusionScene: React.FC<{ params: ReactionDiffusionParams }> = ({ params }) => {
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      camera={{ position: [0, 0, 4.5], fov: 50 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <Starfield />
      <Lighting />
      <DisplayMesh />
      <OrbitControls enableDamping dampingFactor={0.1} />
      <Effects />
    </Canvas>
  );
};