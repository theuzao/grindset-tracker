import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { Attribute, AttributeType } from '@/types';

interface AttributeRadarProps {
  attributes: Record<AttributeType, Attribute>;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { height: 200, fontSize: 10 },
  md: { height: 280, fontSize: 11 },
  lg: { height: 350, fontSize: 12 },
};

export function AttributeRadar({ attributes, size = 'md' }: AttributeRadarProps) {
  const config = sizeConfig[size];

  const data = Object.values(attributes).map((attr) => ({
    attribute: attr.name,
    value: Math.round(attr.currentValue),
    fullMark: 100,
  }));

  return (
    <div style={{ height: config.height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid
            stroke="#2D2D2D"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="attribute"
            tick={{
              fill: '#9CA3AF',
              fontSize: config.fontSize,
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#6B7280', fontSize: 9 }}
            tickCount={5}
            axisLine={false}
          />
          <Radar
            name="Atributos"
            dataKey="value"
            stroke="#2e2ed1"
            strokeWidth={2}
            fill="#2e2ed1"
            fillOpacity={0.25}
            dot={{
              r: 4,
              fill: '#2e2ed1',
              strokeWidth: 2,
              stroke: '#0D0D0D',
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-bg-secondary border border-border rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-white font-medium">{data.attribute}</p>
                    <p className="text-accent text-sm">{data.value} / 100</p>
                  </div>
                );
              }
              return null;
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AttributeListProps {
  attributes: Record<AttributeType, Attribute>;
}

export function AttributeList({ attributes }: AttributeListProps) {
  return (
    <div className="space-y-3">
      {Object.values(attributes).map((attr) => {
        const roundedValue = Math.round(attr.currentValue);
        return (
          <div key={attr.type} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: `${attr.color}20`, color: attr.color }}
            >
              {roundedValue}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-300">{attr.name}</span>
                <span className="text-xs text-gray-500">{roundedValue}/100</span>
              </div>
              <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, roundedValue)}%`,
                    backgroundColor: attr.color,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
