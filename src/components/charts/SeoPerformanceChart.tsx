import React from 'react';
import ReactECharts from 'echarts-for-react';

export const SeoPerformanceChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#18181e',
      borderColor: '#c5a059',
      borderWidth: 1,
      textStyle: { color: '#f5f3ef', fontSize: 12 },
      axisPointer: { type: 'cross', label: { backgroundColor: '#c5a059' } }
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
      boundaryGap: false,
      data: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      axisLine: { lineStyle: { color: '#332f27' } },
      axisLabel: { color: '#9a9a9a', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#26241e', type: 'dashed' } },
      axisLabel: { color: '#9a9a9a', fontSize: 11 }
    },
    series: [
      {
        name: 'Bài Viết Đã Đăng',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#e6c687' },
        lineStyle: { width: 3, color: '#c5a059' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(197, 160, 89, 0.45)' },
              { offset: 1, color: 'rgba(197, 160, 89, 0.02)' }
            ]
          }
        },
        data: [12, 19, 15, 25, 22, 30, 38]
      },
      {
        name: 'Điểm SEO Trung Bình',
        type: 'line',
        smooth: true,
        symbol: 'diamond',
        symbolSize: 6,
        itemStyle: { color: '#f5d799' },
        lineStyle: { width: 2, color: '#f5d799', type: 'dashed' },
        data: [92, 94, 95, 96, 98, 97, 99]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '260px', width: '100%' }} />;
};
