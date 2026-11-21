import type { AnnualRecord } from '../../utils/herbarium'

// 仅录入可追溯事实；缺失的年度手记不自动生成。
export const records: Record<number, AnnualRecord> = {
  2023: {
    year: 2023, title: null, letter: null,
    milestones: [{ id: 'founded', date: '2023-03-12', type: 'launch', title: '网站建站纪念日', description: 'Vesper 采用的官方建站纪念日期；并不代表现存仓库的首个 Git 提交日。', sourceUrls: ['https://yenchiu.com/about'], verification: 'manual' }]
  },
  2024: { year: 2024, title: null, letter: null, milestones: [] },
  2025: { year: 2025, title: null, letter: null, milestones: [] },
  2026: { year: 2026, title: null, letter: null, milestones: [] }
}
