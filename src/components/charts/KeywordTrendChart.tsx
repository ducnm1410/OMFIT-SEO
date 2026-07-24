import React from 'react';
import ReactECharts from 'echarts-for-react';

export const KeywordTrendChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#071827',
      borderColor: '#0879D9',
      borderWidth: 1,
      textStyle: { color: '#F3F0E9', fontSize: 12 }
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
      axisLine: { lineStyle: { color: 'rgba(40, 169, 244, 0.3)' } },
      axisLabel: { color: '#28A9F4', fontSize: 11, fontWeight: '600' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(40, 169, 244, 0.15)', type: 'dashed' } },
      axisLabel: { color: '#DCEAF0', fontSize: 11 }
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
              { offset: 0, color: '#28A9F4' },
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
