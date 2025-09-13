import React from 'react';

export const Lighting: React.FC = () => {
  return (
    <>
      {/* Ambient light to soften the scene */}
      <ambientLight intensity={0.2} />

      {/* Key light (main light source) */}
      <directionalLight
        castShadow
        position={[10, 20, 5]}
        intensity={1.5}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Fill light (to soften shadows) */}
      <pointLight position={[-10, -5, -10]} intensity={0.5} color="#ffcccc" />

      {/* Back light (to create rim lighting) */}
      <spotLight
        position={[-5, 10, -15]}
        intensity={0.8}
        angle={Math.PI / 8}
        penumbra={0.2}
        castShadow
      />
    </>
  );
};
