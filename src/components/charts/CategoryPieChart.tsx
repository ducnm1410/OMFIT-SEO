import React from 'react';
import ReactECharts from 'echarts-for-react';

export const CategoryPieChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#FFFFFF',
      borderColor: '#0879D9',
      borderWidth: 1,
      textStyle: { color: '#071827', fontSize: 12 }
    },
    legend: {
      bottom: '0%',
      left: 'center',
      textStyle: { color: '#475569', fontSize: 11 }
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
          borderColor: '#FFFFFF',
          borderWidth: 3
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: '#0879D9'
          }
        },
        data: [
          { value: 35, name: 'OMFIT PILATES', itemStyle: { color: '#0879D9' } },
          { value: 30, name: 'OMFIT FITNESS', itemStyle: { color: '#0284C7' } },
          { value: 20, name: 'OMFIT WELLNESS', itemStyle: { color: '#38BDF8' } },
          { value: 15, name: 'Cộng Đồng / News', itemStyle: { color: '#94A3B8' } }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '240px', width: '100%' }} />;
};
