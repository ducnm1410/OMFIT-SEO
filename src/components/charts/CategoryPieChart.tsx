import React from 'react';
import ReactECharts from 'echarts-for-react';

export const CategoryPieChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#18181e',
      borderColor: '#c5a059',
      borderWidth: 1,
      textStyle: { color: '#f5f3ef', fontSize: 12 }
    },
    legend: {
      bottom: '0%',
      left: 'center',
      textStyle: { color: '#9a9a9a', fontSize: 11 }
    },
    series: [
      {
        name: 'Tỷ Lệ Chuyên Mục Bài Viết',
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#101014',
          borderWidth: 3
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: '#e6c687'
          }
        },
        data: [
          { value: 40, name: 'Pilates Reformer', itemStyle: { color: '#e6c687' } },
          { value: 30, name: 'Khóa Học PT Pilates', itemStyle: { color: '#c5a059' } },
          { value: 18, name: 'Sound Therapy', itemStyle: { color: '#9a7b38' } },
          { value: 12, name: 'Gym & Group X', itemStyle: { color: '#d8b26b' } }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '240px', width: '100%' }} />;
};
