import { Message } from '../providers/adapters.js';
import { route } from './router.js';

export async function orchestrate(
  messages: Message[],
  provider: string,
  agentMode: string,
  onToken: (t: string) => void
): Promise<string> {
  const lastMsg = messages[messages.length - 1].content;
  
  // If Mono-Agent, skip orchestration planning overhead
  if (agentMode === 'mono') {
    return provider;
  }

  // Multi-Agent: Architect Planner
  const isComplex = lastMsg.length > 50 || lastMsg.toLowerCase().includes('refactor') || lastMsg.toLowerCase().includes('implement') || lastMsg.toLowerCase().includes('create');
  
  if (isComplex) {
    onToken("\n*Orchestrator [Multi-Agent]: Architect Agent is planning...*\n");
    const planningPrompt: Message[] = [
      { role: 'system', content: 'You are the Yazıcı Architect Agent. Analyze the request and output a concise, actionable numbered plan. Do not write code or use tools here.' },
      ...messages
    ];
    let plan = '';
    await route(planningPrompt, provider, (t) => { plan += t; onToken(t); }, () => {}, { strict: false });
    
    onToken("\n*Orchestrator [Multi-Agent]: Passing plan to Execution Agent...*\n\n");
    messages[messages.length - 1].content += `\n\n[ARCHITECT PLAN]\n${plan}`;
  }

  return provider;
}
