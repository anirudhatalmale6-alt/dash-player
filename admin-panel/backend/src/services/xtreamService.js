const axios = require('axios');

class XtreamService {
  constructor(url, username, password) {
    this.baseUrl = url;
    this.username = username;
    this.password = password;
  }

  static fromPlaylist(playlist) {
    return new XtreamService(playlist.xtream_url, playlist.xtream_username, playlist.xtream_password);
  }

  static fromEnv() {
    return new XtreamService(
      process.env.XTREAM_API_URL,
      process.env.XTREAM_USERNAME,
      process.env.XTREAM_PASSWORD
    );
  }

  async authenticate() {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: { username: this.username, password: this.password }
    });
    return res.data;
  }

  async getLiveCategories() {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: { username: this.username, password: this.password, action: 'get_live_categories' }
    });
    return res.data;
  }

  async getLiveStreams(categoryId = null) {
    const params = { username: this.username, password: this.password, action: 'get_live_streams' };
    if (categoryId) params.category_id = categoryId;
    const res = await axios.get(`${this.baseUrl}/player_api.php`, { params });
    return res.data;
  }

  async getVodCategories() {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: { username: this.username, password: this.password, action: 'get_vod_categories' }
    });
    return res.data;
  }

  async getVodStreams(categoryId = null) {
    const params = { username: this.username, password: this.password, action: 'get_vod_streams' };
    if (categoryId) params.category_id = categoryId;
    const res = await axios.get(`${this.baseUrl}/player_api.php`, { params });
    return res.data;
  }

  async getSeriesCategories() {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: { username: this.username, password: this.password, action: 'get_series_categories' }
    });
    return res.data;
  }

  async getSeries(categoryId = null) {
    const params = { username: this.username, password: this.password, action: 'get_series' };
    if (categoryId) params.category_id = categoryId;
    const res = await axios.get(`${this.baseUrl}/player_api.php`, { params });
    return res.data;
  }

  async getSeriesInfo(seriesId) {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: { username: this.username, password: this.password, action: 'get_series_info', series_id: seriesId }
    });
    return res.data;
  }

  async getEPG(streamId) {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: { username: this.username, password: this.password, action: 'get_short_epg', stream_id: streamId }
    });
    return res.data;
  }

  async getFullEPG(streamId) {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: { username: this.username, password: this.password, action: 'get_simple_data_table', stream_id: streamId }
    });
    return res.data;
  }

  async getCatchupStreams(streamId, start, end) {
    const res = await axios.get(`${this.baseUrl}/player_api.php`, {
      params: {
        username: this.username, password: this.password,
        action: 'get_short_epg', stream_id: streamId, limit: 100
      }
    });
    return res.data;
  }

  getLiveStreamUrl(streamId, extension = 'ts') {
    return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  getVodStreamUrl(streamId, extension = 'mp4') {
    return `${this.baseUrl}/movie/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  getSeriesStreamUrl(streamId, extension = 'mp4') {
    return `${this.baseUrl}/series/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  getCatchupUrl(streamId, start, duration) {
    return `${this.baseUrl}/timeshift/${this.username}/${this.password}/${duration}/${start}/${streamId}.ts`;
  }

  getXmltvUrl() {
    return `${this.baseUrl}/xmltv.php?username=${this.username}&password=${this.password}`;
  }
}

module.exports = XtreamService;
