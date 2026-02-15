import { FeedSource } from './types';

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  feeds: FeedSource[];
}

export const categories: Category[] = [
  {
    id: 'tech',
    name: 'Tech News (English)',
    description: 'Latest technology news and updates in English',
    icon: '💻',
    feeds: [
      {
        id: 'hn',
        url: 'https://hnrss.org/frontpage',
        title: 'Hacker News',
      },
      {
        id: 'verge',
        url: 'https://www.theverge.com/rss/index.xml',
        title: 'The Verge',
      },
      {
        id: 'ars',
        url: 'https://feeds.arstechnica.com/arstechnica/index',
        title: 'Ars Technica',
      },
      {
        id: 'techcrunch',
        url: 'https://techcrunch.com/feed/',
        title: 'TechCrunch',
      },
      {
        id: 'techradar',
        url: 'https://www.techradar.com/rss',
        title: 'TechRadar',
      },
    ],
  },
  {
    id: 'tech-zh',
    name: 'Tech News (Chinese)',
    description: 'Latest technology news and updates from China, Taiwan, and HK',
    icon: '🚀',
    feeds: [
      {
        id: '36kr',
        url: 'https://36kr.com/feed',
        title: '36Kr',
      },
      {
        id: 'sspai',
        url: 'https://sspai.com/feed',
        title: '少数派 (sspai)',
      },
      {
        id: 'inside-tw',
        url: 'https://www.inside.com.tw/feed',
        title: 'Inside 網摘 (TW)',
      },
      {
        id: 'technews-tw',
        url: 'https://technews.tw/feed/',
        title: 'TechNews 科技新報 (TW)',
      },
      {
        id: 'unwire-hk',
        url: 'https://unwire.hk/feed/',
        title: 'unwire.hk (HK)',
      },
      {
        id: 'solidot',
        url: 'https://www.solidot.org/index.rss',
        title: 'Solidot',
      },
      {
        id: 'ithome',
        url: 'https://www.ithome.com/rss/',
        title: 'IT之家',
      },
    ],
  },
  {
    id: 'world-news',
    name: 'World News (English)',
    description: 'Global news coverage in English',
    icon: '🌍',
    feeds: [
      {
        id: 'bbc',
        url: 'http://feeds.bbci.co.uk/news/rss.xml',
        title: 'BBC News',
      },
      {
        id: 'reuters',
        url: 'https://www.reutersagency.com/feed/',
        title: 'Reuters',
      },
      {
        id: 'npr',
        url: 'https://feeds.npr.org/1001/rss.xml',
        title: 'NPR News',
      },
      {
        id: 'aljazeera',
        url: 'https://www.aljazeera.com/xml/rss/all.xml',
        title: 'Al Jazeera',
      },
    ],
  },
  {
    id: 'world-news-zh',
    name: 'World News (Chinese)',
    description: 'Global and regional news coverage in Chinese',
    icon: '🏮',
    feeds: [
      {
        id: 'bbc-zh',
        url: 'https://www.bbc.com/zhongwen/simp/index.xml',
        title: 'BBC 中文',
      },
      {
        id: 'zaobao',
        url: 'https://www.zaobao.com.sg/rss/realtime/china',
        title: '联合早报',
      },
      {
        id: 'cna-tw',
        url: 'https://feeds.feedburner.com/rsscna/mainland',
        title: '中央社 CNA (TW)',
      },
      {
        id: 'storm-tw',
        url: 'http://www.stormmediagroup.com/opencms/rss/site',
        title: '風傳媒 (TW)',
      },
      {
        id: 'rthk-hk',
        url: 'https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml',
        title: '香港電台 RTHK (HK)',
      },
      {
        id: 'initium-zh',
        url: 'https://theinitium.com/newsfeed/',
        title: '端傳媒 Initium',
      },
      {
        id: 'dw-zh',
        url: 'https://rss.dw.com/rdf/rss-chi-all',
        title: '德国之声 DW',
      },
      {
        id: 'rfa-zh',
        url: 'https://www.rfa.org/mandarin/RSS',
        title: '自由亚洲电台',
      },
    ],
  },
  {
    id: 'dev',
    name: 'Developer',
    description: 'Programming and development resources',
    icon: '👨‍💻',
    feeds: [
      {
        id: 'devto',
        url: 'https://dev.to/feed',
        title: 'DEV Community',
      },
      {
        id: 'css-tricks',
        url: 'https://css-tricks.com/feed/',
        title: 'CSS-Tricks',
      },
      {
        id: 'smashing',
        url: 'https://www.smashingmagazine.com/feed/',
        title: 'Smashing Magazine',
      },
    ],
  },
  {
    id: 'science',
    name: 'Science',
    description: 'Scientific discoveries and research',
    icon: '🔬',
    feeds: [
      {
        id: 'nasa',
        url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
        title: 'NASA Breaking News',
      },
      {
        id: 'science-daily',
        url: 'https://www.sciencedaily.com/rss/all.xml',
        title: 'Science Daily',
      },
    ],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Design inspiration and resources',
    icon: '🎨',
    feeds: [
      {
        id: 'sidebar',
        url: 'https://sidebar.io/feed.xml',
        title: 'Sidebar',
      },
      {
        id: 'dribbble',
        url: 'https://dribbble.com/shots/popular.rss',
        title: 'Dribbble Popular',
      },
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Video game news and reviews',
    icon: '🎮',
    feeds: [
      {
        id: 'ign',
        url: 'https://feeds.feedburner.com/ign/all',
        title: 'IGN',
      },
      {
        id: 'kotaku',
        url: 'https://kotaku.com/rss',
        title: 'Kotaku',
      },
    ],
  },
  {
    id: 'audiophile',
    name: 'Audiophile',
    description: 'Headphones, IEMs, and audio gear discussions',
    icon: '🎧',
    feeds: [
      {
        id: 'headphones',
        url: 'https://www.reddit.com/r/headphones/.rss',
        title: 'r/headphones',
      },
      {
        id: 'iems',
        url: 'https://www.reddit.com/r/iems/.rss',
        title: 'r/iems',
      },
    ],
  },
];

export function getCategoryById(id: string): Category | undefined {
  return categories.find((cat) => cat.id === id);
}
