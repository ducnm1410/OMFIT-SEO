import React from 'react';
import ReactECharts from 'echarts-for-react';

export const CategoryPieChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#071827',
      borderColor: '#0879D9',
      borderWidth: 1,
      textStyle: { color: '#F3F0E9', fontSize: 12 }
    },
    legend: {
      bottom: '0%',
      left: 'center',
      textStyle: { color: '#DCEAF0', fontSize: 11 }
    },
    series: [
      {
        name: 'Tỷ Lệ Chuyên Mục OMFIT',
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#0B263D',
          borderWidth: 3
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: '#28A9F4'
          }
        },
        data: [
          { value: 35, name: 'OMFIT PILATES', itemStyle: { color: '#0879D9' } },
          { value: 30, name: 'OMFIT FITNESS', itemStyle: { color: '#28A9F4' } },
          { value: 20, name: 'OMFIT WELLNESS', itemStyle: { color: '#D7C8B7' } },
          { value: 15, name: 'Cộng Đồng / News', itemStyle: { color: '#DCEAF0' } }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '240px', width: '100%' }} />;
};
