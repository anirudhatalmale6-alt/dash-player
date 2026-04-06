import axios from 'axios';

class XtreamApi {
  constructor(url, username, password) {
    this.baseUrl = url.replace(/\/$/, '');
    this.username = username;
    this.password = password;
  }

  async request(action, params = {}) {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: { username: this.username, password: this.password, action, ...params }
    });
    return res.data;
  }

  async authenticate() { return this.request(); }
  async getLiveCategories() { return this.request('get_live_categories'); }
  async getLiveStreams(categoryId) { return this.request('get_live_streams', categoryId ? { category_id: categoryId } : {}); }
  async getVodCategories() { return this.request('get_vod_categories'); }
  async getVodStreams(categoryId) { return this.request('get_vod_streams', categoryId ? { category_id: categoryId } : {}); }
  async getSeriesCategories() { return this.request('get_series_categories'); }
  async getSeries(categoryId) { return this.request('get_series', categoryId ? { category_id: categoryId } : {}); }
  async getSeriesInfo(seriesId) { return this.request('get_series_info', { series_id: seriesId }); }
  async getEPG(streamId) { return this.request('get_short_epg', { stream_id: streamId }); }
  async getFullEPG(streamId) { return this.request('get_simple_data_table', { stream_id: streamId }); }

  getLiveUrl(streamId, ext = 'ts') { return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.${ext}`; }
  getVodUrl(streamId, ext = 'mp4') { return `${this.baseUrl}/movie/${this.username}/${this.password}/${streamId}.${ext}`; }
  getSeriesUrl(streamId, ext = 'mp4') { return `${this.baseUrl}/series/${this.username}/${this.password}/${streamId}.${ext}`; }
  getCatchupUrl(streamId, start, duration) { return `${this.baseUrl}/timeshift/${this.username}/${this.password}/${duration}/${start}/${streamId}.ts`; }
}

// Mock data for development
export const mockData = {
  categories: [
    { category_id: '1', category_name: 'News', parent_id: 0 },
    { category_id: '2', category_name: 'Sports', parent_id: 0 },
    { category_id: '3', category_name: 'Entertainment', parent_id: 0 },
    { category_id: '4', category_name: 'Movies', parent_id: 0 },
    { category_id: '5', category_name: 'Kids', parent_id: 0 },
    { category_id: '6', category_name: 'Music', parent_id: 0 },
    { category_id: '7', category_name: 'Documentary', parent_id: 0 },
    { category_id: '8', category_name: 'Lifestyle', parent_id: 0 },
  ],
  channels: Array.from({ length: 50 }, (_, i) => {
    const cats = ['News', 'Sports', 'Entertainment', 'Movies', 'Kids', 'Music', 'Documentary', 'Lifestyle'];
    const catId = String((i % 8) + 1);
    const names = [
      'CNN International', 'BBC World', 'Sky News', 'Al Jazeera', 'Fox News',
      'ESPN', 'Sky Sports', 'beIN Sports', 'Eurosport', 'NBA TV',
      'HBO', 'Netflix Live', 'Comedy Central', 'AMC', 'TNT',
      'Cinemax', 'Star Movies', 'Film4', 'TCM', 'Paramount',
      'Cartoon Network', 'Disney Channel', 'Nickelodeon', 'Baby TV', 'CBeebies',
      'MTV', 'VH1', 'CMT', 'Trace Urban', 'Music Box',
      'Discovery', 'National Geographic', 'History', 'Animal Planet', 'BBC Earth',
      'TLC', 'HGTV', 'Food Network', 'Travel Channel', 'E!',
      'Bloomberg', 'CNBC', 'RT', 'France 24', 'DW News',
      'Premier League TV', 'Champions League', 'La Liga TV', 'Serie A', 'Bundesliga'
    ];
    return {
      num: i + 1,
      name: names[i] || `Channel ${i + 1}`,
      stream_id: 1000 + i,
      stream_icon: '',
      epg_channel_id: `ch${i + 1}`,
      category_id: catId,
      category_name: cats[parseInt(catId) - 1],
      is_adult: 0,
      added: '1700000000',
    };
  }),
  generateEPG(channelNum) {
    const programs = [];
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const titles = [
      'Morning News', 'Breakfast Show', 'Talk of the Town', 'Market Watch', 'Health Hour',
      'Sports Center', 'Movie Premiere', 'Comedy Hour', 'Drama Series', 'Documentary Special',
      'Evening News', 'Prime Time Show', 'Late Night Talk', 'Music Hits', 'World Report',
      'Kids Zone', 'Nature Explorer', 'Tech Today', 'Cooking Master', 'Travel Diaries',
      'News Update', 'Sports Highlights', 'Film Classic', 'Reality Check', 'Night Owl'
    ];
    for (let h = 0; h < 24; h++) {
      const start = new Date(startOfDay);
      start.setHours(h);
      const end = new Date(start);
      end.setHours(h + 1);
      programs.push({
        id: `${channelNum}_${h}`,
        title: titles[h % titles.length],
        description: `Episode ${Math.floor(Math.random() * 100) + 1} - A great show to watch.`,
        start: start.toISOString(),
        end: end.toISOString(),
        start_timestamp: Math.floor(start.getTime() / 1000),
        stop_timestamp: Math.floor(end.getTime() / 1000),
      });
    }
    return programs;
  },
  vodCategories: [
    { category_id: '101', category_name: 'Action' },
    { category_id: '102', category_name: 'Comedy' },
    { category_id: '103', category_name: 'Drama' },
    { category_id: '104', category_name: 'Thriller' },
    { category_id: '105', category_name: 'Sci-Fi' },
  ],
  vodStreams: Array.from({ length: 30 }, (_, i) => {
    const titles = [
      'The Last Stand', 'Road Warriors', 'City of Gold', 'Dark Horizon', 'Silent Echo',
      'Laugh Factory', 'Happy Days', 'The Joker', 'Fun Times', 'Comedy Nights',
      'Broken Dreams', 'The Promise', 'Sunset Boulevard', 'Deep Waters', 'The Choice',
      'Night Runner', 'Cold Blood', 'The Spy', 'Edge of Fear', 'Shadow Play',
      'Star Command', 'Time Loop', 'Planet X', 'Neural Link', 'The Matrix Reimagined',
      'Fast Track', 'Iron Will', 'The Recruit', 'Ocean Deep', 'Mountain Peak'
    ];
    const catIds = ['101', '102', '103', '104', '105'];
    return {
      num: i + 1,
      name: titles[i] || `Movie ${i + 1}`,
      stream_id: 2000 + i,
      stream_icon: '',
      rating: (Math.random() * 3 + 6).toFixed(1),
      category_id: catIds[i % 5],
      container_extension: 'mp4',
      added: '1700000000',
    };
  }),
  seriesCategories: [
    { category_id: '201', category_name: 'Drama Series' },
    { category_id: '202', category_name: 'Comedy Series' },
    { category_id: '203', category_name: 'Action Series' },
  ],
  series: Array.from({ length: 15 }, (_, i) => {
    const titles = [
      'Breaking Point', 'The Crown Jewels', 'Riverdale Heights', 'Dark Secrets', 'The Office Remix',
      'Friends Forever', 'Lost Island', 'Game of Empires', 'Stranger Days', 'The Mandalore',
      'Black Mirror Plus', 'Westworld Redux', 'The Witcher Tales', 'House of Cards', 'Peaky Stars'
    ];
    const catIds = ['201', '202', '203'];
    return {
      num: i + 1,
      name: titles[i],
      series_id: 3000 + i,
      cover: '',
      category_id: catIds[i % 3],
      rating: (Math.random() * 3 + 6).toFixed(1),
      last_modified: '1700000000',
    };
  }),
};

export default XtreamApi;
