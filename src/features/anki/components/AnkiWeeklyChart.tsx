import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ankiRepository } from '@/database/repositories/ankiRepository';

interface ChartData {
  date: string;
  label: string;
  count: number;
  timeSpent: number;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function AnkiWeeklyChart() {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    ankiRepository.getWeeklyData().then(weekly => {
      setData(
        weekly.map(d => {
          const dayOfWeek = new Date(d.date + 'T12:00:00').getDay();
          return {
            date: d.date,
            label: DAY_NAMES[dayOfWeek],
            count: d.count,
            timeSpent: d.timeSpent,
          };
        }),
      );
    });
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Sem dados de revisão ainda
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1a2e',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
          }}
          formatter={(value) => {
            return [value ?? 0, 'Cards revisados'];
          }}
          labelFormatter={(label) => `${label}`}
        />
        <Bar
          dataKey="count"
          fill="var(--color-accent, #6366f1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
