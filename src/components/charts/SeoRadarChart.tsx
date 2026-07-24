import React from 'react';
import ReactECharts from 'echarts-for-react';

export const SeoRadarChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: '#071827',
      borderColor: '#0879D9',
      borderWidth: 1,
      textStyle: { color: '#F3F0E9', fontSize: 12 }
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
      axisName: { color: '#28A9F4', fontSize: 11, fontWeight: 'bold' },
      splitLine: { lineStyle: { color: 'rgba(40, 169, 244, 0.25)' } },
      splitArea: { areaStyle: { color: ['rgba(11, 38, 61, 0.6)', 'rgba(7, 24, 39, 0.8)'] } },
      axisLine: { lineStyle: { color: 'rgba(40, 169, 244, 0.3)' } }
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
            itemStyle: { color: '#28A9F4' },
            lineStyle: { color: '#0879D9', width: 2 },
            areaStyle: { color: 'rgba(8, 121, 217, 0.35)' }
          }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '260px', width: '100%' }} />;
};
