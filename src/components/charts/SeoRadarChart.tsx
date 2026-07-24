import React from 'react';
import ReactECharts from 'echarts-for-react';

export const SeoRadarChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: '#FFFFFF',
      borderColor: '#0879D9',
      borderWidth: 1,
      textStyle: { color: '#071827', fontSize: 12 }
    },
    radar: {
      indicator: [
        { name: 'Mật độ từ khóa', max: 100 },
        { name: 'Độ đọc dễ (Readability)', max: 100 },
        { name: 'Cấu trúc H2/H3', max: 100 },
        { name: 'Alt Text & Media', max: 100 },
        { name: 'Meta Title & Desc', max: 100 },
        { name: 'Schema Markup', max: 100 }
      ],
      shape: 'polygon',
      splitNumber: 4,
      axisName: { color: '#0879D9', fontSize: 11, fontWeight: 'bold' },
      splitLine: { lineStyle: { color: 'rgba(8, 121, 217, 0.2)' } },
      splitArea: { areaStyle: { color: ['rgba(240, 249, 255, 0.6)', 'rgba(255, 255, 255, 0.8)'] } },
      axisLine: { lineStyle: { color: 'rgba(8, 121, 217, 0.3)' } }
    },
    series: [
      {
        name: 'Đánh Giá SEO Bài Viết OMFIT',
        type: 'radar',
        data: [
          {
            value: [96, 95, 98, 96, 99, 97],
            name: 'Tiêu Chuẩn OMFIT SEO',
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#0879D9' },
            lineStyle: { color: '#0879D9', width: 2 },
            areaStyle: { color: 'rgba(8, 121, 217, 0.25)' }
          }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '260px', width: '100%' }} />;
};
