import Anthropic from '@anthropic-ai/sdk';
import type { Character, ActivityLog, Quest, AttributeType } from '@/types';
import { INITIAL_ATTRIBUTES } from '@/features/gamification/constants';

// Cliente Anthropic - a API key vem do .env
const getClient = () => {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_ANTHROPIC_API_KEY não configurada no .env');
  }
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // Apenas para desenvolvimento!
  });
};

export interface AIInsightData {
  character: Character;
  recentActivities: ActivityLog[];
  recentQuests: Quest[];
  attributeStats: Record<string, number>;
}

export interface GeneratedInsight {
  type: 'pattern' | 'recommendation' | 'warning' | 'celebration';
  title: string;
  content: string;
}

// Gera insights personalizados baseados nos dados do usuário
export async function generateInsights(data: AIInsightData): Promise<GeneratedInsight[]> {
  const client = getClient();

  // Preparar resumo dos dados
  const weakAttributes = Object.entries(data.character.attributes)
    .filter(([, attr]) => attr.currentValue < 30)
    .map(([key]) => INITIAL_ATTRIBUTES[key as AttributeType]?.name || key);

  const strongAttributes = Object.entries(data.character.attributes)
    .filter(([, attr]) => attr.currentValue > 70)
    .map(([key]) => INITIAL_ATTRIBUTES[key as AttributeType]?.name || key);

  const recentActivityTypes = [...new Set(data.recentActivities.map(a => a.category))];
  const completedQuestsCount = data.recentQuests.filter(q => q.status === 'completed').length;
  const failedQuestsCount = data.recentQuests.filter(q => q.status === 'failed').length;

  const prompt = `Você é um coach de produtividade gamificada. Analise os dados do usuário e gere 2-3 insights curtos e motivacionais em português brasileiro.

DADOS DO USUÁRIO:
- Nome: ${data.character.name}
- Nível: ${data.character.level}
- Streak atual: ${data.character.streak.current} dias
- XP Total: ${data.character.totalXP}
- Gold: ${data.character.gold}

ATRIBUTOS (0-100):
${Object.entries(data.character.attributes).map(([_key, attr]) =>
  `- ${attr.name}: ${Math.round(attr.currentValue)}`
).join('\n')}

ATRIBUTOS FRACOS (< 30): ${weakAttributes.length > 0 ? weakAttributes.join(', ') : 'Nenhum'}
ATRIBUTOS FORTES (> 70): ${strongAttributes.length > 0 ? strongAttributes.join(', ') : 'Nenhum'}

ATIVIDADES RECENTES (últimos 7 dias):
- Tipos: ${recentActivityTypes.join(', ') || 'Nenhuma'}
- Total: ${data.recentActivities.length} sessões

QUESTS (últimos 7 dias):
- Completadas: ${completedQuestsCount}
- Falhadas: ${failedQuestsCount}

GANHOS DE ATRIBUTOS ACUMULADOS:
${Object.entries(data.attributeStats).map(([key, gain]) => {
  const attrInfo = INITIAL_ATTRIBUTES[key as AttributeType];
  return `- ${attrInfo?.name || key}: +${gain.toFixed(1)}`;
}).join('\n') || 'Nenhum ainda'}

INSTRUÇÕES:
1. Gere 2-3 insights curtos (máximo 2 frases cada)
2. Seja motivacional mas realista
3. Sugira ações concretas quando apropriado
4. Use emojis com moderação

Responda APENAS em JSON válido neste formato:
[
  {
    "type": "pattern|recommendation|warning|celebration",
    "title": "Título curto",
    "content": "Conteúdo do insight"
  }
]`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extrair JSON da resposta
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as GeneratedInsight[];
    }

    return [{
      type: 'recommendation',
      title: 'Continue assim!',
      content: 'Continue registrando suas atividades para receber insights personalizados.',
    }];
  } catch (error) {
    console.error('Erro ao gerar insights:', error);
    throw error;
  }
}

// Gera um resumo semanal
export async function generateWeeklySummary(data: AIInsightData): Promise<string> {
  const client = getClient();

  const totalDuration = data.recentActivities.reduce((sum, a) => sum + a.duration, 0);
  const totalXP = data.recentActivities.reduce((sum, a) => sum + a.xpEarned, 0);
  const questsCompleted = data.recentQuests.filter(q => q.status === 'completed').length;

  const prompt = `Gere um resumo semanal motivacional curto (máximo 3 frases) para este usuário de um app de produtividade gamificada.

Dados da semana:
- ${data.recentActivities.length} sessões de atividade
- ${Math.floor(totalDuration / 60)}h ${totalDuration % 60}min de tempo focado
- ${totalXP} XP ganho
- ${questsCompleted} quests completadas
- Streak: ${data.character.streak.current} dias

Responda em português brasileiro, seja motivacional e use 1-2 emojis.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].type === 'text' ? response.content[0].text : 'Continue evoluindo!';
  } catch (error) {
    console.error('Erro ao gerar resumo:', error);
    throw error;
  }
}

// Verifica se a API está configurada
export function isAIConfigured(): boolean {
  return !!import.meta.env.VITE_ANTHROPIC_API_KEY;
}
