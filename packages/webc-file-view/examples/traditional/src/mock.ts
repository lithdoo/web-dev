import { ref } from 'vue';
import { FileViewHandler } from '../../../src/components/handler';
import type { WebcFileItem, WebcFileViewProps } from '../../../src/components/interface';

// 模拟文件数据
const mockFiles: WebcFileItem[] = [
  {
    name: '文档',
    path: '/documents',
    type: 'directory',
    size: 0,
    lastModified: Date.now() - 86400000,
    metadata: {
      '创建时间': {
        type: 'text',
        value: '2024-01-01'
      }
    }
  },
  {
    name: '图片',
    path: '/images',
    type: 'directory',
    size: 0,
    lastModified: Date.now() - 172800000,
    metadata: {
      '创建时间': {
        type: 'text',
        value: '2024-01-02'
      }
    }
  },
  {
    name: '报告.pdf',
    path: '/documents/report.pdf',
    type: 'file',
    size: 1024 * 1024 * 2,
    lastModified: Date.now() - 3600000,
    thumbnail: 'https://via.placeholder.com/150',
    metadata: {
      '作者': {
        type: 'text',
        value: '张三'
      },
      '创建时间': {
        type: 'text',
        value: '2024-01-03'
      },
      '下载链接': {
        type: 'url',
        title: '下载报告',
        value: 'https://example.com/report.pdf'
      },
      '操作': {
        type: 'action',
        title: '查看详情',
        value: 'view_details'
      }
    },
    metadataGroup: [
      {
        name: '基本信息',
        description: '文件的基本属性',
        items: {
          '作者': '张三',
          '大小': '2.00 MB'
        }
      }
    ]
  },
  {
    name: 'README.md',
    path: '/README.md',
    type: 'file',
    size: 1024,
    lastModified: Date.now(),
    metadata: {
      '语言': {
        type: 'text',
        value: 'Markdown'
      },
      '查看文档': {
        type: 'url',
        title: 'Markdown文档',
        value: 'https://markdown.com'
      }
    }
  },
  {
    name: '照片.jpg',
    path: '/images/photo.jpg',
    type: 'file',
    size: 1024 * 1024 * 5,
    lastModified: Date.now() - 7200000,
    thumbnail: 'https://via.placeholder.com/150/333333/FFFFFF?text=Photo',
    metadata: {
      '分辨率': {
        type: 'text',
        value: '1920x1080'
      },
      '拍摄时间': {
        type: 'text',
        value: '2024-01-04'
      },
      '查看大图': {
        type: 'action',
        title: '查看大图',
        value: 'view_large'
      }
    }
  }
];

// 创建视图属性配置
const viewProps: WebcFileViewProps = {
  src: '/',
  viewType: 'list',
  list: mockFiles
};

// 创建并导出文件视图处理器
export const fileViewHandler = ref(new FileViewHandler(viewProps));

// 为处理器添加操作事件处理
fileViewHandler.value.onDetailItemAction = (value: string) => {
  console.log('执行操作:', value);
  // 可以根据不同的操作值执行不同的逻辑
  switch (value) {
    case 'view_details':
      console.log('查看详情操作');
      break;
    case 'view_large':
      console.log('查看大图操作');
      break;
    default:
      console.log('未知操作:', value);
  }
};
