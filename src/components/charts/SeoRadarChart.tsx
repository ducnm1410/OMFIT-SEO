import React from 'react';
import ReactECharts from 'echarts-for-react';

export const SeoRadarChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: '#18181e',
      borderColor: '#c5a059',
      borderWidth: 1,
      textStyle: { color: '#f5f3ef', fontSize: 12 }
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
      axisName: { color: '#e6c687', fontSize: 11, fontWeight: 'bold' },
      splitLine: { lineStyle: { color: 'rgba(197, 160, 89, 0.25)' } },
      splitArea: { areaStyle: { color: ['rgba(24, 24, 30, 0.6)', 'rgba(16, 16, 20, 0.8)'] } },
      axisLine: { lineStyle: { color: 'rgba(197, 160, 89, 0.3)' } }
    },
    series: [
      {
        name: 'Đánh Giá SEO Bài Viết OM FIT',
        type: 'radar',
        data: [
          {
            value: [96, 94, 98, 95, 99, 97],
            name: 'Tiêu Chuẩn OM FIT SEO',
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#e6c687' },
            lineStyle: { color: '#c5a059', width: 2 },
            areaStyle: { color: 'rgba(197, 160, 89, 0.35)' }
          }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '260px', width: '100%' }} />;
};
