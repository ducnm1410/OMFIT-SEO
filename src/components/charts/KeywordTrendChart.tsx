import React from 'react';
import ReactECharts from 'echarts-for-react';

export const KeywordTrendChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#FFFFFF',
      borderColor: '#0879D9',
      borderWidth: 1,
      textStyle: { color: '#071827', fontSize: 12 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['Pilates Reformer', 'PT Course', 'Sound Therapy', 'Gym & Functional', 'Yoga & GroupX'],
      axisLine: { lineStyle: { color: '#CBD5E1' } },
      axisLabel: { color: '#0879D9', fontSize: 11, fontWeight: 'bold' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
      axisLabel: { color: '#475569', fontSize: 11 }
    },
    series: [
      {
        name: 'Volume Tìm Kiếm (K)',
        type: 'bar',
        barWidth: '40%',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#0284C7' },
              { offset: 1, color: '#0879D9' }
            ]
          },
          borderRadius: [6, 6, 0, 0]
        },
        data: [26.4, 18.2, 12.8, 20.1, 14.5]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '240px', width: '100%' }} />;
};
