
export interface SimulationParams {
  particleCount: number;
  heat: number; // Represents energy input at the hot wall
  isPaused: boolean;
}

export interface SimulationData {
  temperatureGradient: number[];
  entropyProduction: number;
  systemState: 'Initializing' | 'Near Equilibrium' | 'Steady State' | 'Chaotic';
}

export interface ReactionDiffusionParams {
  feed: number;
  kill: number;
}
