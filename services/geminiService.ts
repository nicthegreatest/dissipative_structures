
import { GoogleGenAI } from "@google/genai";
import type { SimulationParams, SimulationData } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // A bit of a hack for the environment this runs in, to prevent crashing.
  // In a real app, this would be a hard error.
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export async function generateExplanation(params: SimulationParams, data: SimulationData): Promise<string> {
  if (!API_KEY) {
    return Promise.resolve("API Key is not configured. Please set the `process.env.API_KEY` environment variable to use this feature.");
  }
    
  const prompt = `
    Analyze the following thermodynamic simulation state and explain the physical principles at play in a clear, accessible way for a science enthusiast.

    **Simulation Parameters:**
    - Number of Particles: ${params.particleCount}
    - Heat Input Level: ${params.heat.toFixed(4)} (a proxy for energy injection at the hot wall)

    **Observed System Data:**
    - System State: ${data.systemState}
    - Entropy Production Rate (proxy): ${data.entropyProduction.toFixed(4)}
    - Temperature Gradient: The system is hotter on one side and colder on the other, as shown by the data. The average "temperature" (kinetic energy) across ${data.temperatureGradient.length} slices from cold to hot is: [${data.temperatureGradient.map(t => t.toFixed(4)).join(', ')}]

    **Your Task:**
    Explain what is happening in this simulation. Cover the following concepts based on the provided data:
    1.  **Far-From-Equilibrium Thermodynamics:** Briefly explain why this system is "far-from-equilibrium".
    2.  **Energy Flow (Heat Flux):** Describe how energy is flowing from the hot wall to the cold wall through particle collisions.
    3.  **Temperature Gradient:** Explain what the temperature gradient data signifies.
    4.  **Entropy Production:** Explain the concept of entropy production in this context. Why is it non-zero when there's a heat flow? How does it relate to the Second Law of Thermodynamics in an open system?
    5.  **Emergent Structure (${data.systemState} state):** Describe what the current system state means. If it's a "Steady State," explain that this is a stable, organized state maintained by constant energy flow, unlike the disorganized state of thermal equilibrium.
    
    Structure your answer in a readable format. Be concise but informative.
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API call failed:", error);
    throw new Error("Failed to communicate with the Gemini API.");
  }
}
