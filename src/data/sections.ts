// 全站版块名称/入口URL的唯一数据源。
// 底部导航栏（Base.astro）、各版块页面的面包屑（经由 Breadcrumb.astro）都从这里取值，
// 以后要改版块名称，只需要改这一个文件。
//
// 注：rescue/medical/career 目前都只覆盖简体中文（zh）——
// rescue和medical在 Base.astro 的 navLabels 里另外维护了多语言版本（因为这两个版块本身有多语言页面），
// 这里的 SECTIONS 是给"只有简体中文场景"（面包屑、career的nav标签）用的单一中文名。

export interface SectionInfo {
  label: string;
  url: string;
}

export const SECTIONS: Record<'rescue' | 'medical' | 'career', SectionInfo> = {
  rescue:  { label: '生活日语学习', url: '/' },
  medical: { label: '日本就医指南', url: '/medical/' },
  career:  { label: '日本就职转职指南', url: '/career/' }
};