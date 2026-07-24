import React from 'react';
import ReactECharts from 'echarts-for-react';

export const SeoPerformanceChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#071827',
      borderColor: '#0879D9',
      borderWidth: 1,
      textStyle: { color: '#F3F0E9', fontSize: 12 },
      axisPointer: { type: 'cross', label: { backgroundColor: '#0879D9' } }
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
      axisLine: { lineStyle: { color: 'rgba(40, 169, 244, 0.3)' } },
      axisLabel: { color: '#DCEAF0', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(40, 169, 244, 0.15)', type: 'dashed' } },
      axisLabel: { color: '#DCEAF0', fontSize: 11 }
    },
    series: [
      {
        name: 'Bài Viết Đã Đăng',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#28A9F4' },
        lineStyle: { width: 3, color: '#0879D9' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(8, 121, 217, 0.45)' },
              { offset: 1, color: 'rgba(40, 169, 244, 0.02)' }
            ]
          }
        },
        data: [14, 21, 18, 28, 24, 32, 42]
      },
      {
        name: 'Điểm SEO Trung Bình',
        type: 'line',
        smooth: true,
        symbol: 'diamond',
        symbolSize: 6,
        itemStyle: { color: '#D7C8B7' },
        lineStyle: { width: 2, color: '#D7C8B7', type: 'dashed' },
        data: [93, 95, 96, 97, 98, 98, 99]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '260px', width: '100%' }} />;
};
