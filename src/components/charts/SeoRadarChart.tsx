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
      center: ['50%', '51%'],
      radius: '53%',
      indicator: [
        { name: 'Mật độ\ntừ khóa', max: 100 },
        { name: 'Độ dễ đọc', max: 100 },
        { name: 'Cấu trúc\nH2/H3', max: 100 },
        { name: 'Ảnh & văn bản\nthay thế', max: 100 },
        { name: 'Tiêu đề &\nmô tả meta', max: 100 },
        { name: 'Dữ liệu\ncó cấu trúc', max: 100 }
      ],
      shape: 'polygon',
      splitNumber: 4,
      axisNameGap: 8,
      axisName: {
        color: '#0879D9',
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: 10,
        lineHeight: 14,
        fontWeight: 'bold',
        align: 'center'
      },
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

  return <ReactECharts option={option} style={{ height: '320px', width: '100%' }} />;
};
