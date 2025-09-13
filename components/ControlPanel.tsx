

import React from 'react';
import type { SimulationParams, ReactionDiffusionParams } from '../types';

interface ControlPanelProps {
  visualization: 'thermodynamics' | 'reaction-diffusion' | 'bz-reaction' | 'boids' | 'convection-cells';
  thermoParams: SimulationParams;
  onThermoParamsChange: (newParams: Partial<SimulationParams>) => void;
  rdParams: ReactionDiffusionParams;
  onRdParamsChange: (newParams: Partial<ReactionDiffusionParams>) => void;
  onExplain: () => void;
  isLoadingExplanation: boolean;
}

const Slider: React.FC<{ label: string; min: number; max: number; step: number; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ label, min, max, step, value, onChange }) => (
  <div className="flex flex-col space-y-2">
    <label htmlFor={label} className="text-sm text-gray-400">{label}</label>
    <input
      id={label}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
    />
    <span className="text-center text-xs text-gray-300 font-mono">{Number(value).toFixed(4)}</span>
  </div>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  visualization,
  thermoParams,
  onThermoParamsChange,
  rdParams,
  onRdParamsChange,
  onExplain, 
  isLoadingExplanation 
}) => {
  return (
    <div className="bg-gray-900 p-4 rounded-lg space-y-4">
      <h2 className="text-lg font-semibold text-cyan-400">Controls</h2>
      
      {visualization === 'thermodynamics' && (
        <>
          <Slider
            label="Number of Particles"
            min={100}
            max={2000}
            step={100}
            value={thermoParams.particleCount}
            onChange={(e) => onThermoParamsChange({ particleCount: parseInt(e.target.value, 10) })}
          />
          <Slider
            label="Heat Input"
            min={0}
            max={0.2}
            step={0.005}
            value={thermoParams.heat}
            onChange={(e) => onThermoParamsChange({ heat: parseFloat(e.target.value) })}
          />
          <div className="flex space-x-2">
            <button
              onClick={() => onThermoParamsChange({ isPaused: !thermoParams.isPaused })}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {thermoParams.isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => onThermoParamsChange({ heat: 0.05 })}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
          <button
            onClick={onExplain}
            disabled={isLoadingExplanation}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-fuchsia-800 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoadingExplanation && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            <span>Explain This Phenomenon</span>
          </button>
        </>
      )}

      {visualization === 'reaction-diffusion' && (
        <>
          <Slider
            label="Feed Rate (f)"
            min={0.01}
            max={0.1}
            step={0.0001}
            value={rdParams.feed}
            onChange={(e) => onRdParamsChange({ feed: parseFloat(e.target.value) })}
          />
          <Slider
            label="Kill Rate (k)"
            min={0.01}
            max={0.1}
            step={0.0001}
            value={rdParams.kill}
            onChange={(e) => onRdParamsChange({ kill: parseFloat(e.target.value) })}
          />
        </>
      )}

      {visualization === 'bz-reaction' && (
          <div className="text-center bg-gray-800 p-3 rounded-md">
            <p className="text-sm text-gray-300">Click and drag on the canvas to trigger new chemical waves and spirals.</p>
          </div>
      )}

      {visualization === 'boids' && (
        <div className="text-center bg-gray-800 p-3 rounded-md">
          <p className="text-sm text-gray-300">Move your mouse to guide the predator sphere and watch the flock react.</p>
        </div>
      )}

      {visualization === 'convection-cells' && (
        <div className="text-center bg-gray-800 p-3 rounded-md">
          <p className="text-sm text-gray-300">The simulation runs automatically. Pan and zoom to observe the emergent patterns.</p>
        </div>
      )}
    </div>
  );
};
