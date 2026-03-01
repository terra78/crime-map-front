/**
 * 犯罪種別の正典定義（backend/crime_types.py と同期すること）
 *
 * 第1階層 (crime_law)    : 刑法犯 / 特別法犯 / 重点犯罪
 * 第2階層 (crime_category): 凶悪犯 / 粗暴犯 / 窃盗犯 / 知能犯 / 風俗犯 /
 *                          その他の刑法犯 / 特別法犯 / 重点犯罪
 * 第3階層 (incident_type): 個別罪名
 */

export type CrimeHierarchy = {
  [law: string]: {
    [category: string]: string[]
  }
}

export const CRIME_HIERARCHY: CrimeHierarchy = {
  刑法犯: {
    凶悪犯:       ['殺人', '強盗', '放火', '強制性交等'],
    粗暴犯:       ['暴行', '傷害', '脅迫', '恐喝'],
    窃盗犯:       ['空き巣', '侵入盗', '車上ねらい', 'ひったくり', '自転車盗', '自動車盗', '万引き'],
    知能犯:       ['詐欺', '横領', '偽造', '背任'],
    風俗犯:       ['賭博', 'わいせつ物頒布', '公然わいせつ'],
    その他の刑法犯: ['器物損壊', '住居侵入', '業務妨害', 'その他刑法犯'],
  },
  特別法犯: {
    特別法犯: [
      '道路交通法違反',
      '覚醒剤取締法違反',
      '銃砲刀剣類所持等取締法違反',
      '軽犯罪法違反',
      '児童買春・ポルノ禁止法違反',
    ],
  },
  重点犯罪: {
    重点犯罪: [
      '特殊詐欺',
      '組織犯罪',
      'サイバー犯罪',
      'DV・ストーカー事案',
      '児童虐待関連事案',
    ],
  },
}

/** 第2階層リスト（optgroup表示順） */
export const ALL_CATEGORIES: string[] = Object.values(CRIME_HIERARCHY).flatMap(
  (cats) => Object.keys(cats),
)

/** 第3階層→第2階層 逆引きマップ */
export const INCIDENT_TO_CATEGORY: Record<string, string> = Object.values(
  CRIME_HIERARCHY,
).reduce<Record<string, string>>((acc, cats) => {
  for (const [cat, crimes] of Object.entries(cats)) {
    for (const crime of crimes) acc[crime] = cat
  }
  return acc
}, {})

/** 第3階層→第1階層 逆引きマップ */
export const INCIDENT_TO_LAW: Record<string, string> = Object.entries(
  CRIME_HIERARCHY,
).reduce<Record<string, string>>((acc, [law, cats]) => {
  for (const crimes of Object.values(cats)) {
    for (const crime of crimes) acc[crime] = law
  }
  return acc
}, {})

/** incident_type から crime_category を返す */
export function getCrimeCategory(incidentType: string): string {
  return INCIDENT_TO_CATEGORY[incidentType] ?? 'その他の刑法犯'
}

/** incident_type から crime_law を返す */
export function getCrimeLaw(incidentType: string): string {
  return INCIDENT_TO_LAW[incidentType] ?? '刑法犯'
}

/**
 * optgroup 用グループ配列を返す
 * submit フォームと編集モーダルの <select> に使う
 */
export type IncidentGroup = { label: string; options: string[] }

export function getIncidentGroups(): IncidentGroup[] {
  return Object.entries(CRIME_HIERARCHY).flatMap(([law, cats]) =>
    Object.entries(cats).map(([cat, crimes]) => ({
      label:   `${law} › ${cat}`,
      options: crimes,
    })),
  )
}

/** カテゴリ別の色定義（第2階層） */
export const CATEGORY_COLORS: Record<string, string> = {
  凶悪犯:         '#B91C1C',  // 深紅
  粗暴犯:         '#DC2626',  // 赤
  窃盗犯:         '#EF4444',  // オレンジ寄り赤
  知能犯:         '#8B5CF6',  // 紫
  風俗犯:         '#EC4899',  // ピンク
  その他の刑法犯: '#6B7280',  // グレー
  特別法犯:       '#F59E0B',  // 黄橙
  重点犯罪:       '#0EA5E9',  // 青
}

/** incident_type の色（第2階層から導出） */
export function getIncidentColor(incidentType: string): string {
  const cat = getCrimeCategory(incidentType)
  return CATEGORY_COLORS[cat] ?? '#6B7280'
}
