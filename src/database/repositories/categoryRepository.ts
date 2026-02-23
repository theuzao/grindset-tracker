import { v4 as uuid } from 'uuid';
import { db } from '../db';
import type { CustomActivityCategory, ActivityConfig, AttributeType, CustomAttributeImpact } from '@/types';
import { ACTIVITY_CONFIGS } from '@/features/gamification/constants';

interface CreateCategoryInput {
  key: string;
  name: string;
  icon: string;
  color: string;
  baseXP: number;
  xpPerMinute: number;
  goldPerSession: number;
  // Legacy
  primaryAttribute?: AttributeType;
  secondaryAttribute?: AttributeType;
  // Novo
  attributeImpacts?: CustomAttributeImpact[];
}

export const categoryRepository = {
  async getAll(): Promise<CustomActivityCategory[]> {
    try {
      return await db.customCategories.toArray();
    } catch {
      return [];
    }
  },

  async getActive(): Promise<CustomActivityCategory[]> {
    try {
      const all = await db.customCategories.toArray();
      return all.filter(c => c.isActive === true);
    } catch {
      return [];
    }
  },

  async getByKey(key: string): Promise<CustomActivityCategory | undefined> {
    try {
      return await db.customCategories.where('key').equals(key).first();
    } catch {
      return undefined;
    }
  },

  async getById(id: string): Promise<CustomActivityCategory | undefined> {
    try {
      return await db.customCategories.get(id);
    } catch {
      return undefined;
    }
  },

  async create(input: CreateCategoryInput): Promise<CustomActivityCategory> {
    // Verificar se key já existe
    const existing = await this.getByKey(input.key);
    if (existing) {
      throw new Error(`Categoria com key "${input.key}" já existe`);
    }

    // Verificar se key não conflita com categorias padrão
    if (input.key in ACTIVITY_CONFIGS) {
      throw new Error(`"${input.key}" é uma categoria padrão do sistema`);
    }

    const now = new Date().toISOString();
    const category: CustomActivityCategory = {
      id: uuid(),
      key: input.key,
      name: input.name,
      icon: input.icon,
      color: input.color,
      baseXP: input.baseXP,
      xpPerMinute: input.xpPerMinute,
      goldPerSession: input.goldPerSession,
      primaryAttribute: input.primaryAttribute,
      secondaryAttribute: input.secondaryAttribute,
      attributeImpacts: input.attributeImpacts,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.customCategories.add(category);
    return category;
  },

  async update(id: string, input: Partial<CreateCategoryInput>): Promise<CustomActivityCategory> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Categoria não encontrada');
    }

    // Se key está sendo alterada, verificar conflitos
    if (input.key && input.key !== existing.key) {
      const keyExists = await this.getByKey(input.key);
      if (keyExists) {
        throw new Error(`Categoria com key "${input.key}" já existe`);
      }
      if (input.key in ACTIVITY_CONFIGS) {
        throw new Error(`"${input.key}" é uma categoria padrão do sistema`);
      }
    }

    const updated: CustomActivityCategory = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    await db.customCategories.put(updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    await db.customCategories.delete(id);
  },

  async toggleActive(id: string): Promise<CustomActivityCategory> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Categoria não encontrada');
    }

    const updated: CustomActivityCategory = {
      ...existing,
      isActive: !existing.isActive,
      updatedAt: new Date().toISOString(),
    };

    await db.customCategories.put(updated);
    return updated;
  },

  // Converte categoria customizada para ActivityConfig
  toActivityConfig(category: CustomActivityCategory): ActivityConfig {
    let attributeImpacts: ActivityConfig['attributeImpacts'];

    // Usar novo formato se disponível
    if (category.attributeImpacts && category.attributeImpacts.length > 0) {
      // Calcular weight baseado na quantidade de atributos
      const totalAttrs = category.attributeImpacts.length;
      attributeImpacts = category.attributeImpacts.map((impact, index) => ({
        attribute: impact.attribute,
        weight: totalAttrs === 1 ? 1.0 : (index === 0 ? 0.4 : (1 - 0.4) / (totalAttrs - 1)),
        gainPerMinute: impact.gainPerMinute,
      }));
    } else if (category.primaryAttribute) {
      // Fallback para formato legado
      attributeImpacts = [
        {
          attribute: category.primaryAttribute,
          weight: 0.6,
          gainPerMinute: 0.08,
        },
      ];

      if (category.secondaryAttribute) {
        attributeImpacts.push({
          attribute: category.secondaryAttribute,
          weight: 0.4,
          gainPerMinute: 0.04,
        });
      }
    } else {
      // Default se nada configurado
      attributeImpacts = [];
    }

    // Calcular check-in rewards baseado nos valores legacy
    const checkInXP = Math.round(category.baseXP * 2);
    const checkInGold = Math.round(category.goldPerSession * 1.5);
    const checkInAttributeGain = 1.0;

    return {
      category: category.key,
      name: category.name,
      icon: category.icon,
      color: category.color,
      baseXP: category.baseXP,
      xpPerMinute: category.xpPerMinute,
      goldPerSession: category.goldPerSession,
      checkInXP,
      checkInGold,
      checkInAttributeGain,
      attributeImpacts,
    };
  },

  // Retorna todas as configs (padrão + customizadas ativas)
  async getAllActivityConfigs(): Promise<Record<string, ActivityConfig>> {
    const customCategories = await this.getActive();
    const configs: Record<string, ActivityConfig> = { ...ACTIVITY_CONFIGS };

    for (const category of customCategories) {
      configs[category.key] = this.toActivityConfig(category);
    }

    return configs;
  },
};
