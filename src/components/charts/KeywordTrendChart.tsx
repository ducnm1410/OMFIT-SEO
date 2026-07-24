import React from 'react';
import ReactECharts from 'echarts-for-react';

export const KeywordTrendChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#18181e',
      borderColor: '#c5a059',
      borderWidth: 1,
      textStyle: { color: '#f5f3ef', fontSize: 12 }
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
      data: ['Pilates', 'PT Course', 'Sound Therapy', 'Gym Q7', 'Group X'],
      axisLine: { lineStyle: { color: '#332f27' } },
      axisLabel: { color: '#e6c687', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#26241e', type: 'dashed' } },
      axisLabel: { color: '#9a9a9a', fontSize: 11 }
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
              { offset: 0, color: '#f5d799' },
              { offset: 1, color: '#9a7b38' }
            ]
          },
          borderRadius: [6, 6, 0, 0]
        },
        data: [24.8, 16.4, 11.2, 18.5, 12.5]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '240px', width: '100%' }} />;
};
