import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { GeneratedArticle } from '../../types';

interface CategoryPieChartProps {
  articles: GeneratedArticle[];
}

const colors = ['#0879D9', '#0284C7', '#38BDF8', '#0EA5E9', '#64748B', '#94A3B8'];

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ articles }) => {
  const categoryCounts = new Map<string, number>();
  articles.forEach((article) => {
    article.categories.forEach((category) => {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
  });

  const data = [...categoryCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name, value], index) => ({
      name,
      value,
      itemStyle: { color: colors[index % colors.length] }
    }));

  if (data.length === 0) {
    return (
      <div className="grid h-[280px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
        <p className="text-xs font-medium text-slate-400">Chưa có dữ liệu chuyên mục thực tế.</p>
      </div>
    );
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: {
      bottom: 0,
      left: 'center',
      type: 'scroll',
      textStyle: { color: '#475569', fontSize: 10 }
    },
    series: [{
      name: 'Số bài viết',
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '43%'],
      itemStyle: { borderRadius: 8, borderColor: '#FFFFFF', borderWidth: 3 },
      label: { show: false },
      data
    }]
  };

  return <ReactECharts option={option} style={{ height: '280px', width: '100%' }} />;
};
