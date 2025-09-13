

import React, { useState, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { ControlPanel } from './components/ControlPanel';
import { ThermodynamicsScene } from './components/ThermodynamicsScene';
import { ReactionDiffusionScene } from './components/ReactionDiffusionScene';
import { BZReactionScene } from './components/BZReactionScene';
import { BoidsScene } from './components/BoidsScene';
import { ConvectionCellsScene } from './components/ConvectionCellsScene';
import { ExplanationModal } from './components/ExplanationModal';
import { generateExplanation } from './services/geminiService';
import type { SimulationData, SimulationParams, ReactionDiffusionParams } from './types';

type VisualizationType = 'thermodynamics' | 'reaction-diffusion' | 'bz-reaction' | 'boids' | 'convection-cells';

const App: React.FC = () => {
  const [visualization, setVisualization] = useState<VisualizationType>('thermodynamics');

  // Thermodynamics state
  const [thermoParams, setThermoParams] = useState<SimulationParams>({
    particleCount: 500,
    heat: 0.05,
    isPaused: false,
  });
  const [simulationData, setSimulationData] = useState<SimulationData>({
    temperatureGradient: [],
    entropyProduction: 0,
    systemState: 'Initializing',
  });
  
  // Reaction-Diffusion state
  const [rdParams, setRdParams] = useState<ReactionDiffusionParams>({
    feed: 0.055,
    kill: 0.062,
  });

  // Modal and Explanation state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  const handleThermoParamsChange = useCallback((newParams: Partial<SimulationParams>) => {
    setThermoParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const handleRdParamsChange = useCallback((newParams: Partial<ReactionDiffusionParams>) => {
    setRdParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const handleExplain = async () => {
    setIsModalOpen(true);
    setIsLoadingExplanation(true);
    setExplanation('');
    try {
      const generatedExplanation = await generateExplanation(thermoParams, simulationData);
      setExplanation(generatedExplanation);
    } catch (error) {
      console.error("Failed to generate explanation:", error);
      setExplanation("Sorry, I couldn't generate an explanation at this time. Please check the console for more details.");
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const chartData = useMemo(() => 
    simulationData.temperatureGradient.map((temp, index) => ({
      name: `Slice ${index + 1}`,
      temperature: temp.toFixed(4),
    })), [simulationData.temperatureGradient]);
  
  const VisualizationSelector: React.FC = () => (
    <div className="p-4 bg-brand-d-brown rounded-lg">
      <h2 className="text-lg font-semibold text-brand-red mb-2">Select Visualization</h2>
      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={() => setVisualization('thermodynamics')}
          className={`font-bold py-2 px-4 rounded-lg transition-colors ${visualization === 'thermodynamics' ? 'bg-brand-red text-white' : 'bg-brand-m-brown hover:bg-brand-m-brown/80 text-brand-tan'}`}
          aria-pressed={visualization === 'thermodynamics'}
        >
          Thermodynamics
        </button>
        <button 
          onClick={() => setVisualization('reaction-diffusion')}
          className={`font-bold py-2 px-4 rounded-lg transition-colors ${visualization === 'reaction-diffusion' ? 'bg-brand-red text-white' : 'bg-brand-m-brown hover:bg-brand-m-brown/80 text-brand-tan'}`}
          aria-pressed={visualization === 'reaction-diffusion'}
        >
          Reaction-Diffusion
        </button>
         <button 
          onClick={() => setVisualization('bz-reaction')}
          className={`font-bold py-2 px-4 rounded-lg transition-colors ${visualization === 'bz-reaction' ? 'bg-brand-red text-white' : 'bg-brand-m-brown hover:bg-brand-m-brown/80 text-brand-tan'}`}
          aria-pressed={visualization === 'bz-reaction'}
        >
          BZ Reaction
        </button>
        <button 
          onClick={() => setVisualization('boids')}
          className={`font-bold py-2 px-4 rounded-lg transition-colors ${visualization === 'boids' ? 'bg-brand-red text-white' : 'bg-brand-m-brown hover:bg-brand-m-brown/80 text-brand-tan'}`}
          aria-pressed={visualization === 'boids'}
        >
          Boids Swarm
        </button>
         <button 
          onClick={() => setVisualization('convection-cells')}
          className={`font-bold py-2 px-4 rounded-lg transition-colors ${visualization === 'convection-cells' ? 'bg-brand-red text-white' : 'bg-brand-m-brown hover:bg-brand-m-brown/80 text-brand-tan'}`}
          aria-pressed={visualization === 'convection-cells'}
        >
          Convection Cells
        </button>
      </div>
    </div>
  );

  const renderVisualization = () => {
    switch(visualization) {
        case 'thermodynamics':
            return <ThermodynamicsScene params={thermoParams} onDataUpdate={setSimulationData} />;
        case 'reaction-diffusion':
            return <ReactionDiffusionScene params={rdParams} />;
        case 'bz-reaction':
            return <BZReactionScene />;
        case 'boids':
            return <BoidsScene />;
        case 'convection-cells':
            return <ConvectionCellsScene />;
        default:
            return null;
    }
  }

  const renderInfoPanel = () => {
    switch(visualization) {
        case 'thermodynamics':
            return (
                <div className="bg-brand-d-brown p-4 rounded-lg flex-grow flex flex-col">
                    <h2 className="text-lg font-semibold mb-2 text-brand-red">System Data</h2>
                    <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                        <div className="bg-brand-m-brown p-3 rounded-md">
                            <p className="text-xs text-brand-tan/80">Entropy Production</p>
                            <p className="text-xl font-mono text-brand-red">{simulationData.entropyProduction.toFixed(4)}</p>
                        </div>
                        <div className="bg-brand-m-brown p-3 rounded-md">
                            <p className="text-xs text-brand-tan/80">System State</p>
                            <p className="text-lg font-semibold text-brand-red">{simulationData.systemState}</p>
                        </div>
                    </div>
                    <h3 className="text-md font-semibold mb-2 text-brand-tan">Temperature Gradient</h3>
                    <div className="w-full h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#59453c" />
                                <XAxis dataKey="name" tick={{ fill: '#a78a70' }} fontSize={10} />
                                <YAxis tick={{ fill: '#a78a70' }} fontSize={10} domain={['dataMin', 'dataMax']} />
                                <Tooltip contentStyle={{ backgroundColor: '#362222', border: 'none' }} labelStyle={{ color: '#a78a70' }} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                                <Line type="monotone" dataKey="temperature" stroke="#7c1f23" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            );
        case 'reaction-diffusion':
             return (
                <div className="bg-brand-d-brown p-4 rounded-lg flex-grow flex flex-col text-brand-tan space-y-3">
                    <h2 className="text-lg font-semibold text-brand-red">About Reaction-Diffusion</h2>
                    <p className="text-sm">
                    This simulates a <a href="https://en.wikipedia.org/wiki/Turing_pattern" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">Turing Pattern</a> using the Gray-Scott model. Two virtual chemicals react and diffuse, creating complex, self-organizing patterns.
                    </p>
                    <p className="text-sm">
                    By adjusting the 'feed' and 'kill' rates, you can discover a wide variety of life-like structures, similar to those found on animal coats or sea shells.
                    </p>
                </div>
            );
        case 'bz-reaction':
            return (
                <div className="bg-brand-d-brown p-4 rounded-lg flex-grow flex flex-col text-brand-tan space-y-3">
                    <h2 className="text-lg font-semibold text-brand-red">About BZ Reaction</h2>
                    <p className="text-sm">
                        The Belousov-Zhabotinsky (BZ) reaction is a classic example of a non-equilibrium chemical oscillator, often called a "chemical clock."
                    </p>
                    <p className="text-sm">
                        This simulation models an "excitable medium." The system naturally tries to rest, but a disturbance can trigger a cascade of reactions, forming propagating waves. These waves can collide, annihilate, or form persistent rotating spirals.
                    </p>
                </div>
            );
        case 'boids':
            return (
                <div className="bg-brand-d-brown p-4 rounded-lg flex-grow flex flex-col text-brand-tan space-y-3">
                    <h2 className="text-lg font-semibold text-brand-red">About Boids</h2>
                    <p className="text-sm">
                        This simulation models the flocking behavior of birds using Craig Reynolds' Boids algorithm. Each "boid" follows three simple rules, leading to complex, life-like swarm intelligence.
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                        <li><span className="font-bold">Separation:</span> Avoid crowding local flockmates.</li>
                        <li><span className="font-bold">Alignment:</span> Steer towards the average heading of local flockmates.</li>
                        <li><span className="font-bold">Cohesion:</span> Steer to move toward the average position of local flockmates.</li>
                    </ul>
                     <p className="text-sm">
                        The red sphere acts as a predator. The boids will actively flee from it, creating dynamic and natural-looking avoidance patterns.
                    </p>
                </div>
            );
        case 'convection-cells':
            return (
                <div className="bg-brand-d-brown p-4 rounded-lg flex-grow flex flex-col text-brand-tan space-y-3">
                    <h2 className="text-lg font-semibold text-brand-red">About Convection Cells</h2>
                    <p className="text-sm">
                        This simulation visualizes Rayleigh-Bénard convection cells. When a fluid is heated from below, it organizes itself into a regular pattern of hexagonal cells to efficiently transport heat upwards.
                    </p>
                    <p className="text-sm">
                        Here, a noise field simulates this process. Particles with upward velocity are colored bright yellow (hot), and those with downward velocity are colored dark purple (cool), revealing the underlying structure. This same principle drives weather systems and plate tectonics.
                    </p>
                </div>
            );
        default:
            return null;
    }
  }

  return (
    <div className="bg-brand-black text-brand-tan min-h-screen font-sans flex flex-col lg:flex-row">
      <div className="flex-grow relative h-[50vh] lg:h-screen">
        {renderVisualization()}
      </div>

      <div className="w-full lg:w-96 bg-brand-d-brown p-4 shadow-2xl flex flex-col space-y-4 overflow-y-auto">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-brand-red">ThermoVis</h1>
          <p className="text-sm text-brand-tan/80">Far-From-Equilibrium Systems</p>
        </header>

        <VisualizationSelector />

        <ControlPanel 
          visualization={visualization}
          thermoParams={thermoParams}
          onThermoParamsChange={handleThermoParamsChange}
          rdParams={rdParams}
          onRdParamsChange={handleRdParamsChange}
          onExplain={handleExplain} 
          isLoadingExplanation={isLoadingExplanation} 
        />

        {renderInfoPanel()}
      </div>
      
      <ExplanationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        explanation={explanation} 
        isLoading={isLoadingExplanation} 
      />
    </div>
  );
};

export default App;