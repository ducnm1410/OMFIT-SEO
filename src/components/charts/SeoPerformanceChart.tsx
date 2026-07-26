import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { GeneratedArticle } from '../../types';

interface SeoPerformanceChartProps {
  articles: GeneratedArticle[];
}

export const SeoPerformanceChart: React.FC<SeoPerformanceChartProps> = ({ articles }) => {
  if (articles.length === 0) {
    return <ChartEmptyState message="Chưa có bài viết để lập biểu đồ hiệu suất." />;
  }

  const dayFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });

  const publishedByDay = days.map((day) => articles.filter((article) => {
    const createdAt = new Date(article.createdAt);
    return article.status === 'published'
      && createdAt.getFullYear() === day.getFullYear()
      && createdAt.getMonth() === day.getMonth()
      && createdAt.getDate() === day.getDate();
  }).length);

  const seoScoreByDay = days.map((day) => {
    const scores = articles
      .filter((article) => {
        const createdAt = new Date(article.createdAt);
        return article.seoScore > 0
          && createdAt.getFullYear() === day.getFullYear()
          && createdAt.getMonth() === day.getMonth()
          && createdAt.getDate() === day.getDate();
      })
      .map((article) => article.seoScore);
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { color: '#475569', fontSize: 11 } },
    grid: { left: '3%', right: '4%', bottom: 42, top: 18, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: days.map((day) => dayFormatter.format(day)),
      axisLine: { lineStyle: { color: '#CBD5E1' } },
      axisLabel: { color: '#475569', fontSize: 11 }
    },
    yAxis: [
      {
        type: 'value',
        minInterval: 1,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
        axisLabel: { color: '#475569', fontSize: 11 }
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        show: false
      }
    ],
    series: [
      {
        name: 'Bài đã đăng',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        itemStyle: { color: '#0879D9' },
        lineStyle: { width: 3, color: '#0879D9' },
        data: publishedByDay
      },
      {
        name: 'Điểm SEO',
        type: 'line',
        yAxisIndex: 1,
        connectNulls: false,
        symbol: 'diamond',
        itemStyle: { color: '#0284C7' },
        lineStyle: { width: 2, color: '#0284C7', type: 'dashed' },
        data: seoScoreByDay
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '280px', width: '100%' }} />;
};

const ChartEmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="grid h-[280px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
    <p className="text-xs font-medium text-slate-400">{message}</p>
  </div>
);
