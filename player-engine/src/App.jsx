import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { mockData } from './services/xtreamApi';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import Hls from 'hls.js';
import './styles.css';

/* ── Translations ── */
const TRANSLATIONS = {
  en: {
    greeting_morning: 'Good Morning',
    greeting_afternoon: 'Good Afternoon',
    greeting_evening: 'Good Evening',
    what_to_watch: 'What would you like to watch today?',
    live_tv: 'Live TV',
    movies: 'Movies',
    series: 'Series',
    radio: 'Radio',
    favorites: 'Favorites',
    search: 'Search',
    settings: 'Settings',
    playlists: 'Playlists',
    speed_test: 'Speed Test',
    tv_guide: 'TV Guide',
    multi_screen: 'Multi Screen',
    catch_up: 'Catch Up',
    channels: 'channels',
    titles: 'titles',
    shows: 'shows',
    stations: 'stations',
    live_channels: 'LIVE CHANNELS',
    no_playlists: 'No Playlists Yet',
    add_playlist: 'Add Playlist',
    refresh: 'Refresh',
    language: 'Language',
    home: 'Home',
    back: 'Back',
    search_channels: 'Search channels...',
    search_movies: 'Search movies...',
    search_series: 'Search series...',
    search_stations: 'Search stations...',
    search_catchup: 'Search catch-up...',
    search_all: 'Search channels, movies, series...',
    loading: 'Loading...',
    loading_channels: 'Loading channels...',
    loading_radio: 'Loading radio stations...',
    loading_catchup: 'Loading catch-up channels...',
    no_results: 'No results for',
    start_test: 'Start Test',
    test_again: 'Test Again',
    testing: 'Testing...',
    download: 'Download',
    ping: 'Ping',
    data_downloaded: 'Data Downloaded',
    status: 'Status',
    connected: 'Connected',
    vpn_status: 'VPN Status',
    vpn_server: 'VPN Server',
    your_ip: 'Your IP',
    vpn_ip: 'VPN IP',
    hostname_isp: 'Hostname / ISP',
    location: 'Location',
    refresh_ip: 'Refresh IP Info',
    enabled: 'ENABLED',
    disabled: 'DISABLED',
    checking: 'Checking...',
    unknown: 'Unknown',
    recently_watched: 'Recently Watched',
    movie: 'Movie',
    account: 'Account',
    parental_control: 'Parental Control',
    vpn: 'VPN',
    device_info: 'Device Info',
    about: 'About',
    add_channel: 'Add Channel',
    select_channel: 'Select Channel for Screen',
    close: 'Close',
    no_radio: 'No Radio Streams',
    no_radio_desc: 'This server does not have radio categories available.',
    no_catchup: 'No catch-up channels in this category',
    catchup_channels: 'channels with catch-up',
    custom_groups: 'Custom Groups',
    new_group: '+ New Group',
    group_name: 'Group name',
    create: 'Create',
    rename: 'Rename',
    delete: 'Delete',
    save: 'Save',
    confirm_delete: 'Confirm',
    no_groups_yet: 'No custom groups yet',
    no_groups_desc: 'Create groups and add your favorite channels to organize them',
    select_channel_epg: 'Select a channel to view EPG',
    connecting: 'Connecting',
    no_history: 'No watch history yet',
    default_sort: 'Default',
    sort_az: 'A-Z',
    sort_number: 'By Number',
    sort_rating: 'Rating',
    no_playlists_yet: 'No playlists configured yet. Add one above to get started.',
    account_info: 'Account Information',
    account_info_desc: 'Your Xtream Codes subscription details.',
    expires: 'Expires',
    unlimited: 'Unlimited',
    max_connections: 'Max Connections',
    active: 'Active',
    subscription_details: 'Subscription Details',
    username: 'Username',
    created: 'Created',
    trial: 'Trial',
    user_agent: 'User Agent',
    yes: 'Yes',
    no: 'No',
    pin_lock: 'Adult Content PIN Lock',
    pin_lock_desc: 'Set a 4-digit PIN to protect adult channels.',
    pin_set: 'PIN is currently set. You can change or disable it.',
    new_pin: 'New PIN',
    confirm_pin: 'Confirm',
    change_pin: 'Change PIN',
    disable_pin: 'Disable PIN',
    set_pin: 'Set PIN',
    four_digit_pin: '4-digit PIN',
    lang_desc: 'Select the display language for the player interface.',
    lang_apply: 'Language changes apply immediately to the home screen and main navigation.',
    vpn_config: 'VPN Configuration',
    vpn_config_desc: 'Configure VPN to secure your connection. Enable VPN and select your preferred protocol.',
    enable_vpn: 'Enable VPN',
    enable: 'Enable',
    disable: 'Disable',
    protocol_server: 'Protocol & Server',
    protocol_server_desc: 'Route all player traffic through a proxy server. Use SOCKS5 or HTTP proxy.',
    protocol: 'Protocol',
    server_address: 'Server Address',
    port: 'Port',
    authentication: 'Authentication',
    auth_desc: 'Enter your VPN credentials if required.',
    password_label: 'Password',
    save_vpn: 'Save VPN Settings',
    device_information: 'Device Information',
    mac_address: 'MAC Address',
    device_key: 'Device Key',
    app_version: 'App Version',
    reset_device_key: 'Reset Device Key',
    reset_desc: 'Generate a new device key. This will deactivate the current device.',
    reset_confirm: 'Are you sure? This will require re-activation.',
    yes_reset: 'Yes, Reset',
    cancel: 'Cancel',
    version: 'Version',
    support: 'Support',
  },
  nl: {
    greeting_morning: 'Goedemorgen',
    greeting_afternoon: 'Goedemiddag',
    greeting_evening: 'Goedenavond',
    what_to_watch: 'Wat wil je vandaag kijken?',
    live_tv: 'Live TV',
    movies: 'Films',
    series: 'Series',
    radio: 'Radio',
    favorites: 'Favorieten',
    search: 'Zoeken',
    settings: 'Instellingen',
    playlists: 'Afspeellijsten',
    speed_test: 'Snelheidstest',
    tv_guide: 'TV Gids',
    multi_screen: 'Multi Scherm',
    catch_up: 'Terugkijken',
    channels: 'kanalen',
    titles: 'titels',
    shows: 'shows',
    stations: 'stations',
    live_channels: 'LIVE KANALEN',
    no_playlists: 'Nog geen afspeellijsten',
    add_playlist: 'Afspeellijst toevoegen',
    refresh: 'Vernieuwen',
    language: 'Taal',
    home: 'Startpagina',
    back: 'Terug',
    search_channels: 'Kanalen zoeken...',
    search_movies: 'Films zoeken...',
    search_series: 'Series zoeken...',
    search_stations: 'Stations zoeken...',
    search_catchup: 'Terugkijken zoeken...',
    search_all: 'Zoek kanalen, films, series...',
    loading: 'Laden...',
    loading_channels: 'Kanalen laden...',
    loading_radio: 'Radiostations laden...',
    loading_catchup: 'Terugkijk-kanalen laden...',
    no_results: 'Geen resultaten voor',
    start_test: 'Test starten',
    test_again: 'Opnieuw testen',
    testing: 'Testen...',
    download: 'Download',
    ping: 'Ping',
    data_downloaded: 'Data gedownload',
    status: 'Status',
    connected: 'Verbonden',
    vpn_status: 'VPN Status',
    vpn_server: 'VPN Server',
    your_ip: 'Uw IP',
    vpn_ip: 'VPN IP',
    hostname_isp: 'Hostname / ISP',
    location: 'Locatie',
    refresh_ip: 'IP-info vernieuwen',
    enabled: 'INGESCHAKELD',
    disabled: 'UITGESCHAKELD',
    checking: 'Controleren...',
    unknown: 'Onbekend',
    recently_watched: 'Recent bekeken',
    movie: 'Film',
    account: 'Account',
    parental_control: 'Ouderlijk toezicht',
    vpn: 'VPN',
    device_info: 'Apparaatinfo',
    about: 'Over',
    add_channel: 'Kanaal toevoegen',
    select_channel: 'Selecteer kanaal voor scherm',
    close: 'Sluiten',
    no_radio: 'Geen radiostations',
    no_radio_desc: 'Deze server heeft geen radiocategorieen beschikbaar.',
    no_catchup: 'Geen terugkijk-kanalen in deze categorie',
    catchup_channels: 'kanalen met terugkijken',
    custom_groups: 'Aangepaste groepen',
    new_group: '+ Nieuwe groep',
    group_name: 'Groepsnaam',
    create: 'Aanmaken',
    rename: 'Hernoemen',
    delete: 'Verwijderen',
    save: 'Opslaan',
    confirm_delete: 'Bevestigen',
    no_groups_yet: 'Nog geen groepen',
    no_groups_desc: 'Maak groepen aan en voeg je favoriete kanalen toe',
    select_channel_epg: 'Selecteer een kanaal om EPG te bekijken',
    connecting: 'Verbinden',
    no_history: 'Nog geen kijkgeschiedenis',
    default_sort: 'Standaard',
    sort_az: 'A-Z',
    sort_number: 'Op nummer',
    sort_rating: 'Beoordeling',
    no_playlists_yet: 'Nog geen afspeellijsten. Voeg er hierboven een toe om te beginnen.',
    account_info: 'Accountinformatie',
    account_info_desc: 'Uw Xtream Codes abonnementsgegevens.',
    expires: 'Verloopt',
    unlimited: 'Onbeperkt',
    max_connections: 'Max verbindingen',
    active: 'Actief',
    subscription_details: 'Abonnementsgegevens',
    username: 'Gebruikersnaam',
    created: 'Aangemaakt',
    trial: 'Proefversie',
    user_agent: 'User Agent',
    yes: 'Ja',
    no: 'Nee',
    pin_lock: 'PIN-vergrendeling voor volwassenen',
    pin_lock_desc: 'Stel een 4-cijferige PIN in om kanalen voor volwassenen te beschermen.',
    pin_set: 'PIN is ingesteld. U kunt deze wijzigen of uitschakelen.',
    new_pin: 'Nieuwe PIN',
    confirm_pin: 'Bevestigen',
    change_pin: 'PIN wijzigen',
    disable_pin: 'PIN uitschakelen',
    set_pin: 'PIN instellen',
    four_digit_pin: '4-cijferige PIN',
    lang_desc: 'Selecteer de weergavetaal voor de spelerinterface.',
    lang_apply: 'Taalwijzigingen zijn direct van toepassing op het startscherm en de hoofdnavigatie.',
    vpn_config: 'VPN-configuratie',
    vpn_config_desc: 'Configureer VPN om uw verbinding te beveiligen.',
    enable_vpn: 'VPN inschakelen',
    enable: 'Inschakelen',
    disable: 'Uitschakelen',
    protocol_server: 'Protocol & Server',
    protocol_server_desc: 'Routeer al het verkeer via een proxyserver. Gebruik SOCKS5 of HTTP proxy.',
    protocol: 'Protocol',
    server_address: 'Serveradres',
    port: 'Poort',
    authentication: 'Authenticatie',
    auth_desc: 'Voer uw VPN-inloggegevens in indien vereist.',
    password_label: 'Wachtwoord',
    save_vpn: 'VPN-instellingen opslaan',
    device_information: 'Apparaatinformatie',
    mac_address: 'MAC-adres',
    device_key: 'Apparaatsleutel',
    app_version: 'App-versie',
    reset_device_key: 'Apparaatsleutel resetten',
    reset_desc: 'Genereer een nieuwe apparaatsleutel. Dit deactiveert het huidige apparaat.',
    reset_confirm: 'Weet u het zeker? Dit vereist heractivering.',
    yes_reset: 'Ja, resetten',
    cancel: 'Annuleren',
    version: 'Versie',
    support: 'Ondersteuning',
  },
  tr: {
    greeting_morning: 'Gunaydin',
    greeting_afternoon: 'Iyi gunler',
    greeting_evening: 'Iyi aksamlar',
    what_to_watch: 'Bugun ne izlemek istersiniz?',
    live_tv: 'Canli TV',
    movies: 'Filmler',
    series: 'Diziler',
    radio: 'Radyo',
    favorites: 'Favoriler',
    search: 'Ara',
    settings: 'Ayarlar',
    playlists: 'Oynatma Listeleri',
    speed_test: 'Hiz Testi',
    tv_guide: 'TV Rehberi',
    multi_screen: 'Coklu Ekran',
    catch_up: 'Tekrar Izle',
    channels: 'kanal',
    titles: 'baslik',
    shows: 'dizi',
    stations: 'istasyon',
    live_channels: 'CANLI KANALLAR',
    no_playlists: 'Henuz oynatma listesi yok',
    add_playlist: 'Oynatma Listesi Ekle',
    refresh: 'Yenile',
    language: 'Dil',
    home: 'Ana Sayfa',
    back: 'Geri',
    search_channels: 'Kanal ara...',
    search_movies: 'Film ara...',
    search_series: 'Dizi ara...',
    search_stations: 'Istasyon ara...',
    search_catchup: 'Tekrar izle ara...',
    search_all: 'Kanal, film, dizi ara...',
    loading: 'Yukleniyor...',
    loading_channels: 'Kanallar yukleniyor...',
    loading_radio: 'Radyo istasyonlari yukleniyor...',
    loading_catchup: 'Tekrar izle kanallari yukleniyor...',
    no_results: 'Sonuc bulunamadi:',
    start_test: 'Testi Baslat',
    test_again: 'Tekrar Test Et',
    testing: 'Test ediliyor...',
    download: 'Indirme',
    ping: 'Ping',
    data_downloaded: 'Indirilen veri',
    status: 'Durum',
    connected: 'Bagli',
    vpn_status: 'VPN Durumu',
    vpn_server: 'VPN Sunucusu',
    your_ip: 'IP Adresiniz',
    vpn_ip: 'VPN IP',
    hostname_isp: 'Ana Bilgisayar / ISS',
    location: 'Konum',
    refresh_ip: 'IP Bilgisini Yenile',
    enabled: 'ETKIN',
    disabled: 'DEVRE DISI',
    checking: 'Kontrol ediliyor...',
    unknown: 'Bilinmiyor',
    recently_watched: 'Son Izlenenler',
    movie: 'Film',
    account: 'Hesap',
    parental_control: 'Ebeveyn Kontrolu',
    vpn: 'VPN',
    device_info: 'Cihaz Bilgisi',
    about: 'Hakkinda',
    add_channel: 'Kanal Ekle',
    select_channel: 'Ekran icin kanal sec',
    close: 'Kapat',
    no_radio: 'Radyo Yayini Yok',
    no_radio_desc: 'Bu sunucuda radyo kategorisi bulunmamaktadir.',
    no_catchup: 'Bu kategoride tekrar izle kanali yok',
    catchup_channels: 'tekrar izle kanali',
    custom_groups: 'Ozel Gruplar',
    new_group: '+ Yeni Grup',
    group_name: 'Grup adi',
    create: 'Olustur',
    rename: 'Yeniden Adlandir',
    delete: 'Sil',
    save: 'Kaydet',
    confirm_delete: 'Onayla',
    no_groups_yet: 'Henuz grup yok',
    no_groups_desc: 'Gruplar olusturun ve favori kanallarinizi ekleyin',
    select_channel_epg: 'EPG goruntulmek icin bir kanal secin',
    connecting: 'Baglaniyor',
    no_history: 'Henuz izleme gecmisi yok',
    default_sort: 'Varsayilan',
    sort_az: 'A-Z',
    sort_number: 'Numaraya Gore',
    sort_rating: 'Puan',
    no_playlists_yet: 'Henuz oynatma listesi yok. Baslamak icin yukaridan bir tane ekleyin.',
    account_info: 'Hesap Bilgileri',
    account_info_desc: 'Xtream Codes abonelik bilgileriniz.',
    expires: 'Bitis tarihi',
    unlimited: 'Sinirsiz',
    max_connections: 'Maks baglanti',
    active: 'Aktif',
    subscription_details: 'Abonelik Detaylari',
    username: 'Kullanici adi',
    created: 'Olusturulma',
    trial: 'Deneme',
    user_agent: 'User Agent',
    yes: 'Evet',
    no: 'Hayir',
    pin_lock: 'Yetiskin Icerigi PIN Kilidi',
    pin_lock_desc: 'Yetiskin kanallari korumak icin 4 haneli bir PIN ayarlayin.',
    pin_set: 'PIN ayarli. Degistirebilir veya devre disi birakabilirsiniz.',
    new_pin: 'Yeni PIN',
    confirm_pin: 'Onayla',
    change_pin: 'PIN Degistir',
    disable_pin: 'PIN Devre Disi Birak',
    set_pin: 'PIN Ayarla',
    four_digit_pin: '4 haneli PIN',
    lang_desc: 'Oynatici arayuzu icin goruntuleme dilini secin.',
    lang_apply: 'Dil degisiklikleri ana ekran ve ana gezinme icin hemen uygulanir.',
    vpn_config: 'VPN Yapilandirmasi',
    vpn_config_desc: 'Baglantinizi guvenli hale getirmek icin VPN yapilandirin.',
    enable_vpn: 'VPN Etkinlestir',
    enable: 'Etkinlestir',
    disable: 'Devre disi birak',
    protocol_server: 'Protokol & Sunucu',
    protocol_server_desc: 'Tum trafigi bir proxy sunucusu uzerinden yonlendirin.',
    protocol: 'Protokol',
    server_address: 'Sunucu Adresi',
    port: 'Port',
    authentication: 'Kimlik Dogrulama',
    auth_desc: 'Gerekli ise VPN kimlik bilgilerinizi girin.',
    password_label: 'Sifre',
    save_vpn: 'VPN Ayarlarini Kaydet',
    device_information: 'Cihaz Bilgileri',
    mac_address: 'MAC Adresi',
    device_key: 'Cihaz Anahtari',
    app_version: 'Uygulama Surumu',
    reset_device_key: 'Cihaz Anahtarini Sifirla',
    reset_desc: 'Yeni bir cihaz anahtari olusturun. Bu, mevcut cihazi devre disi birakacaktir.',
    reset_confirm: 'Emin misiniz? Bu, yeniden aktivasyon gerektirecektir.',
    yes_reset: 'Evet, Sifirla',
    cancel: 'Iptal',
    version: 'Surum',
    support: 'Destek',
  }
};

function getCurrentLanguage() {
  return localStorage.getItem('dash_language') || 'en';
}
function setCurrentLanguage(lang) {
  localStorage.setItem('dash_language', lang);
}
function t(key) {
  const lang = getCurrentLanguage();
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}

/* ── Favorites helper (persisted in localStorage) ── */
function getFavorites(type) {
  try { return JSON.parse(localStorage.getItem(`dash_fav_${type}`) || '[]'); } catch { return []; }
}
function setFavorites(type, items) {
  localStorage.setItem(`dash_fav_${type}`, JSON.stringify(items));
}
function toggleFavorite(type, id) {
  const favs = getFavorites(type);
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1); else favs.push(id);
  setFavorites(type, favs);
  return favs;
}
function isFavorite(type, id) {
  return getFavorites(type).includes(id);
}

/* ── Playlist management helper (localStorage) ── */
function getPlaylists() {
  try { return JSON.parse(localStorage.getItem('dash_playlists') || '[]'); } catch { return []; }
}
function savePlaylists(playlists) {
  localStorage.setItem('dash_playlists', JSON.stringify(playlists));
  // Sync to backend
  syncPlaylistsToBackend(playlists);
}

async function syncPlaylistsToBackend(playlists) {
  try {
    const device = getDeviceIdentity();
    const apiBase = 'https://management.dashplayer.eu/api';
    // Fetch current backend playlists
    const res = await axios.post(`${apiBase}/device/lookup`, { mac_address: device.mac, device_key: device.key });
    const backendPlaylists = res.data?.playlists || [];
    const backendIds = new Set(backendPlaylists.map(p => p.id));
    // Add new playlists that don't exist in backend
    for (const pl of playlists) {
      const normUrl = (u) => (u || '').replace(/\/+$/, '').toLowerCase();
      const exists = backendPlaylists.find(bp => normUrl(bp.server_url) === normUrl(pl.server_url) && bp.username === pl.username);
      if (!exists) {
        await axios.post(`${apiBase}/device/playlists`, {
          mac_address: device.mac, device_key: device.key,
          name: pl.name || 'My Playlist', server_url: pl.server_url,
          username: pl.username, password: pl.password,
          output_format: pl.output_format || 'm3u8',
        }).catch(() => {});
      }
    }
  } catch (e) { /* silent fail */ }
}
function getDefaultPlaylist() {
  const pls = getPlaylists();
  return pls.find(p => p.is_default) || pls[0] || null;
}

async function fetchPlaylistsFromBackend() {
  try {
    const device = getDeviceIdentity();
    const apiBase = 'https://management.dashplayer.eu/api';
    const res = await axios.post(`${apiBase}/device/lookup`, { mac_address: device.mac, device_key: device.key });
    const backendPlaylists = res.data?.playlists || [];
    // Backend is the ONLY source of truth - if backend returns empty, playlists are empty
    // This ensures hard reset and playlist deletion from admin/website work correctly
    const localPlaylists = getPlaylists();
    const merged = backendPlaylists.map(bp => {
      // Preserve local password if backend doesn't include it
      let password = bp.password;
      if (!password) {
        const normUrl = (u) => (u || '').replace(/\/+$/, '').toLowerCase();
        const localMatch = localPlaylists.find(lp => normUrl(lp.server_url) === normUrl(bp.server_url) && lp.username === bp.username);
        if (localMatch) password = localMatch.password;
      }
      return {
        id: bp.id || Date.now() + Math.random(),
        name: bp.name || 'My Playlist',
        server_url: bp.server_url,
        username: bp.username,
        password: password,
        output_format: bp.output_format || 'm3u8',
        is_default: bp.is_default === 1 || bp.is_default === true,
        pin: bp.pin || '',
      };
    });
    // Ensure one default
    if (merged.length > 0 && !merged.find(p => p.is_default)) {
      merged[0].is_default = true;
    }
    localStorage.setItem('dash_playlists', JSON.stringify(merged));
    return merged;
  } catch (e) {
    return getPlaylists();
  }
}

/* ── Custom groups helper (persisted in localStorage) ── */
function getCustomGroups() {
  try { return JSON.parse(localStorage.getItem('dash_custom_groups') || '[]'); } catch { return []; }
}
function saveCustomGroups(groups) {
  localStorage.setItem('dash_custom_groups', JSON.stringify(groups));
}

/* ── Watch history helper ── */
function getWatchHistory() {
  try { return JSON.parse(localStorage.getItem('dash_history') || '[]'); } catch { return []; }
}
function addToHistory(item) {
  const hist = getWatchHistory().filter(h => h.id !== item.id);
  hist.unshift({ ...item, watchedAt: Date.now() });
  if (hist.length > 50) hist.length = 50;
  localStorage.setItem('dash_history', JSON.stringify(hist));
}

/* ── Xtream API helper ── */
function createXtreamApi(url, username, password, outputFormat = 'm3u8') {
  const baseUrl = url.replace(/\/$/, '');
  // Determine live stream extension based on output format
  const liveExt = outputFormat === 'ts' ? 'ts' : 'm3u8';
  const req = async (action, params = {}) => {
    try {
      const queryParams = { username, password, ...params };
      if (action) queryParams.action = action;
      const res = await axios.get(`${baseUrl}/player_api.php`, {
        params: queryParams,
        timeout: 60000,
      });
      // Some servers return HTML error pages (Cloudflare etc.)
      if (typeof res.data === 'string' && res.data.includes('<!DOCTYPE')) {
        console.warn('Xtream API blocked (HTML response):', action);
        return null;
      }
      return res.data;
    } catch (e) {
      console.warn('Xtream API error:', action, e.message, e.code || '', e.response?.status || '');
      return null;
    }
  };
  return {
    authenticate: () => req(),
    getLiveCategories: () => req('get_live_categories'),
    getLiveStreams: (catId) => req('get_live_streams', catId ? { category_id: catId } : {}),
    getVodCategories: () => req('get_vod_categories'),
    getVodStreams: (catId) => req('get_vod_streams', catId ? { category_id: catId } : {}),
    getSeriesCategories: () => req('get_series_categories'),
    getSeries: (catId) => req('get_series', catId ? { category_id: catId } : {}),
    getSeriesInfo: (seriesId) => req('get_series_info', { series_id: seriesId }),
    getVodInfo: (vodId) => req('get_vod_info', { vod_id: vodId }),
    getRadioCategories: () => req('get_radio_categories'),
    getRadioStreams: (catId) => req('get_radio_streams', catId ? { category_id: catId } : {}),
    getEPG: (streamId) => req('get_short_epg', { stream_id: streamId }),
    getFullEPG: (streamId) => req('get_simple_data_table', { stream_id: streamId }),
    getLiveUrl: (streamId) => `${baseUrl}/live/${username}/${password}/${streamId}.${liveExt}`,
    getRadioUrl: (streamId) => `${baseUrl}/live/${username}/${password}/${streamId}.mp3`,
    getRadioUrls: (streamId) => [
      `${baseUrl}/radio/${username}/${password}/${streamId}.mp3`,
      `${baseUrl}/live/${username}/${password}/${streamId}.mp3`,
      `${baseUrl}/live/${username}/${password}/${streamId}.${liveExt}`,
    ],
    getVodUrl: (streamId, ext = 'mp4') => `${baseUrl}/movie/${username}/${password}/${streamId}.${ext}`,
    getSeriesUrl: (streamId, ext = 'mp4') => `${baseUrl}/series/${username}/${password}/${streamId}.${ext}`,
    getTimeshiftUrl: (streamId, start, duration) => `${baseUrl}/timeshift/${username}/${password}/${duration}/${start}/${streamId}.${liveExt}`,
    outputFormat,
    liveExt,
  };
}

/* ── Generate a persistent device identity ── */
function getDeviceIdentity() {
  let stored = localStorage.getItem('dash_device');
  if (stored) return JSON.parse(stored);
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
  const mac = `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
  const key = Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
  const device = { mac, key };
  localStorage.setItem('dash_device', JSON.stringify(device));
  return device;
}

/* ── Base64 to UTF-8 decoder (handles Turkish/special chars) ── */
function b64decode(str) {
  try {
    return decodeURIComponent(atob(str).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
  } catch (e) {
    try { return atob(str); } catch (e2) { return str; }
  }
}

/* ══════ ACTIVATION SCREEN ══════ */
function ActivationScreen({ onActivated }) {
  const [device] = useState(() => getDeviceIdentity());
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showQuickConnect, setShowQuickConnect] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectError, setConnectError] = useState('');
  const [m3uInput, setM3uInput] = useState('');
  const [outputFormat, setOutputFormat] = useState('m3u8');
  const panelUrl = 'https://dashplayer.eu';

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const parseM3uUrl = (url) => {
    try {
      const u = new URL(url);
      const params = u.searchParams;
      const user = params.get('username');
      const pass = params.get('password');
      if (user && pass) {
        const base = `${u.protocol}//${u.host}`;
        return { url: base, username: user, password: pass };
      }
    } catch (e) {}
    return null;
  };

  const handleM3uPaste = (val) => {
    setM3uInput(val);
    const parsed = parseM3uUrl(val.trim());
    if (parsed) {
      setServerUrl(parsed.url);
      setUsername(parsed.username);
      setPassword(parsed.password);
      setConnectError('');
    }
  };

  const handleQuickConnect = async () => {
    if (!serverUrl || !username || !password) {
      setConnectError('Please fill in all fields or paste an M3U URL');
      return;
    }
    setChecking(true);
    setConnectError('');
    try {
      const api = createXtreamApi(serverUrl, username, password, outputFormat);
      const data = await api.authenticate();
      if (data && data.user_info) {
        onActivated({ url: serverUrl, username, password, output_format: outputFormat });
      } else {
        setConnectError('Could not authenticate. Check your credentials.');
      }
    } catch (e) {
      setConnectError('Connection failed: ' + e.message);
    }
    setChecking(false);
  };

  const handleReload = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      onActivated({ url: 'http://demo', username: 'demo', password: 'demo' });
    }, 1500);
  };

  const qrSize = 140;

  return (
    <div className="activation-screen">
      <div className="activation-container">
        <div className="activation-info">
          <div className="activation-info-inner">
            <p className="activation-instruction">
              To add/manage playlists, use the following<br />values on the admin panel:
            </p>
            <a href={panelUrl} className="activation-url">{panelUrl}</a>
            <div className="activation-field">
              <label className="activation-label">Mac Address</label>
              <div className="activation-value-row">
                <span className="activation-value">{device.mac}</span>
                <button className="activation-copy" onClick={() => copyToClipboard(device.mac, 'mac')}>
                  {copied === 'mac' ? '\u2713' : '\u29C9'}
                </button>
              </div>
            </div>
            <div className="activation-field">
              <label className="activation-label">Device Key</label>
              <div className="activation-value-row">
                <span className="activation-value">{device.key}</span>
                <button className="activation-copy" onClick={() => copyToClipboard(device.key, 'key')}>
                  {copied === 'key' ? '\u2713' : '\u29C9'}
                </button>
              </div>
            </div>
            <div className="activation-buttons">
              <button className="activation-btn activation-btn-reload" onClick={handleReload} disabled={checking}>
                {checking ? 'Checking...' : 'RELOAD'}
              </button>
              <button className="activation-btn activation-btn-reload" onClick={() => setShowQuickConnect(!showQuickConnect)}>
                {showQuickConnect ? 'HIDE' : 'ADD PLAYLIST'}
              </button>
            </div>
            {showQuickConnect && (
              <div className="quick-connect-section">
                <div className="activation-field">
                  <label className="activation-label">Paste M3U URL or Xtream Login</label>
                  <input className="quick-connect-input" placeholder="http://server:port/get.php?username=...&password=..." value={m3uInput} onChange={e => handleM3uPaste(e.target.value)} />
                </div>
                <div className="quick-connect-fields">
                  <div className="activation-field">
                    <label className="activation-label">Server URL</label>
                    <input className="quick-connect-input" placeholder="http://server:port" value={serverUrl} onChange={e => setServerUrl(e.target.value)} />
                  </div>
                  <div className="quick-connect-row">
                    <div className="activation-field" style={{flex: 1}}>
                      <label className="activation-label">Username</label>
                      <input className="quick-connect-input" placeholder="username" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                    <div className="activation-field" style={{flex: 1}}>
                      <label className="activation-label">Password</label>
                      <input className="quick-connect-input" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="activation-field">
                  <label className="activation-label">Output Format</label>
                  <select className="quick-connect-input" value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={{cursor:'pointer'}}>
                    <option value="m3u8">HLS (M3U8)</option>
                    <option value="ts">MPEG-TS</option>
                  </select>
                </div>
                <button className="activation-btn activation-btn-reload" onClick={handleQuickConnect} disabled={checking} style={{marginTop: 8, width: '100%'}}>
                  {checking ? 'Connecting...' : 'CONNECT'}
                </button>
                {connectError && <p style={{color: '#ef4444', fontSize: 12, marginTop: 6}}>{connectError}</p>}
              </div>
            )}
          </div>
        </div>
        <div className="activation-brand">
          <div className="activation-logo">D</div>
          <div className="activation-app-name">Dash Player</div>
          <div className="activation-qr">
            <div className="activation-qr-placeholder" style={{background:'#fff',borderRadius:12,padding:8}}>
              <QRCodeSVG value={`https://dashplayer.eu/#activate?mac=${encodeURIComponent(device.mac)}&key=${encodeURIComponent(device.key)}`} size={qrSize} fgColor="#8b5cf6" bgColor="#ffffff" level="M" />
            </div>
          </div>
          <p className="activation-qr-text">Scan QR to add playlist</p>
        </div>
      </div>
    </div>
  );
}

/* ══════ VIDEO PLAYER COMPONENT ══════ */
function VideoPlayer({ url, onClose, title, inline }) {
  const videoRef = useRef(null);
  const retryTimerRef = useRef(null);
  const stallTimerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentFormat, setCurrentFormat] = useState('');
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
  const [showTrackMenu, setShowTrackMenu] = useState(null); // 'audio' | 'subtitle' | null
  const [usingFfmpeg, setUsingFfmpeg] = useState(false);
  const [probing, setProbing] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState([]); // parsed VTT cues
  const [currentSubText, setCurrentSubText] = useState(''); // current subtitle text to display
  const probedRef = useRef(false); // track if we already probed this URL
  const subTimerRef = useRef(null); // subtitle sync timer
  const hlsRef = useRef(null); // HLS.js instance for mobile playback
  const mountedRef = useRef(true);
  const generationRef = useRef(0); // increments on each channel change to prevent stale handlers
  const savedTimeRef = useRef(0); // persisted playback time (survives FFmpeg restarts)
  const subAbortRef = useRef(null); // AbortController for pending subtitle fetch

  const cleanup = useCallback(() => {
    // Increment generation to invalidate any pending error handlers from previous playback
    generationRef.current++;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (stallTimerRef.current) { clearInterval(stallTimerRef.current); stallTimerRef.current = null; }
    // Destroy HLS.js instance if active (mobile playback)
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch(e) {}
      hlsRef.current = null;
    }
    // Stop FFmpeg first (before clearing src to avoid error handler race)
    if (window.dashPlayer?.ffmpegStop) {
      window.dashPlayer.ffmpegStop().catch(() => {});
    }
    // Clear video source to close HTTP connection
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch(e) {}
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    // Stop subtitle overlay sync
    if (subTimerRef.current) { clearInterval(subTimerRef.current); subTimerRef.current = null; }
    setUsingFfmpeg(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Track current playback time so it survives FFmpeg restarts
    const video = videoRef.current;
    const onTimeUpdate = () => { if (video && video.currentTime > 0) savedTimeRef.current = video.currentTime; };
    if (video) video.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      mountedRef.current = false;
      if (video) video.removeEventListener('timeupdate', onTimeUpdate);
      cleanup();
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; videoRef.current.load(); }
    };
  }, []);

  useEffect(() => {
    if (!url || !videoRef.current) return;
    setError(null);
    setLoading(true);
    cleanup();
    savedTimeRef.current = 0; // reset on new URL/channel
    const video = videoRef.current;
    const isLive = url.includes('/live/') || url.includes('/timeshift/');
    const baseUrl = url.replace(/\.\w+$/, '');

    const setupStallDetection = () => {
      if (stallTimerRef.current) clearInterval(stallTimerRef.current);
      let lastTime = 0;
      let stallCount = 0;
      stallTimerRef.current = setInterval(() => {
        if (!video || video.paused || video.ended) return;
        if (video.currentTime === lastTime && video.readyState < 3) {
          stallCount++;
          if (stallCount >= 3) {
            stallCount = 0;
            if (isLive) {
              try {
                const buffered = video.buffered;
                if (buffered.length > 0) video.currentTime = buffered.end(buffered.length - 1) - 0.5;
              } catch(e) {}
            }
          }
        } else { stallCount = 0; }
        lastTime = video.currentTime;
      }, 3000);
    };

    const onPlaying = () => {
      if (!mountedRef.current) return;
      setLoading(false);
      setError(null);
      setupStallDetection();
    };

    let playbackStarted = false;

    // Don't auto-probe on mount - probe on demand when user opens track menu
    probedRef.current = false;

    // Detect platform: Electron (desktop) uses FFmpeg, mobile uses direct playback
    const isElectron = !!window.dashPlayer?.ffmpegTranscodeUrl;
    const streamUrl = isLive
      ? (isElectron ? baseUrl + '.ts' : baseUrl + '.m3u8')
      : url;

    // Mobile/web: use HLS.js for .m3u8 streams (Android WebView doesn't support HLS natively)
    if (!isElectron) {
      const mobileUrl = isLive ? baseUrl + '.m3u8' : url;
      console.log('[DashPlayer] Mobile playback:', mobileUrl);
      setCurrentFormat('HLS');

      // Try HLS.js first (works on Android WebView with MSE support)
      if (isLive && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          startFragPrefetch: true,
        });
        hlsRef.current = hls;
        hls.loadSource(mobileUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          playbackStarted = true;
          video.play().catch(() => {});
          onPlaying();
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.log('[DashPlayer] HLS error:', data.type, data.details);
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Try .ts direct fallback
              console.log('[DashPlayer] HLS fatal network error, trying .ts fallback');
              hls.destroy();
              hlsRef.current = null;
              video.src = baseUrl + '.ts';
              video.load();
              video.play().catch(() => {});
              video.addEventListener('loadeddata', () => { playbackStarted = true; onPlaying(); }, { once: true });
            } else {
              hls.destroy();
              hlsRef.current = null;
              setError('Stream unavailable');
              setLoading(false);
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari/native HLS support
        video.src = mobileUrl;
        video.load();
        video.addEventListener('loadeddata', () => { playbackStarted = true; onPlaying(); }, { once: true });
        video.addEventListener('canplay', () => { playbackStarted = true; onPlaying(); }, { once: true });
        setTimeout(() => { if (video && mountedRef.current) video.play().catch(() => {}); }, 300);
      } else {
        // Fallback: try .ts direct
        console.log('[DashPlayer] No HLS support, trying .ts direct');
        video.src = isLive ? baseUrl + '.ts' : url;
        video.load();
        video.addEventListener('loadeddata', () => { playbackStarted = true; onPlaying(); }, { once: true });
        setTimeout(() => { if (video && mountedRef.current) video.play().catch(() => {}); }, 300);
      }
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || playbackStarted) return;
        setError('Stream timeout - try another channel');
        setLoading(false);
      }, 15000);
      return;
    }

    const startFfmpeg = async () => {
      if (!window.dashPlayer?.ffmpegTranscodeUrl) {
        setError('FFmpeg not available - please install FFmpeg');
        setLoading(false);
        return;
      }
      // Capture current generation - if it changes, this playback session is stale
      const myGen = generationRef.current;
      console.log('[DashPlayer] FFmpeg playing:', streamUrl, 'gen:', myGen);
      setCurrentFormat('FFmpeg');
      try {
        const result = await window.dashPlayer.ffmpegTranscodeUrl({ url: streamUrl });
        if (myGen !== generationRef.current) return; // stale - channel changed
        if (!result.success || !result.url) {
          console.log('[DashPlayer] FFmpeg URL failed');
          setError('Failed to start playback');
          setLoading(false);
          return;
        }
        console.log('[DashPlayer] FFmpeg local URL:', result.url);
        setUsingFfmpeg(true);
        video.src = result.url;
        video.load();

        video.addEventListener('loadeddata', () => {
          if (myGen !== generationRef.current) return;
          console.log('[DashPlayer] FFmpeg loadeddata, readyState:', video.readyState);
          playbackStarted = true;
          onPlaying();
        }, { once: true });
        video.addEventListener('canplay', () => {
          if (myGen !== generationRef.current) return;
          playbackStarted = true;
          onPlaying();
        }, { once: true });

        // Error handling with auto-reconnect
        let reconnecting = false;
        const handleError = async () => {
          // CRITICAL: ignore errors from stale playback sessions (e.g. cleanup cleared src)
          if (!mountedRef.current || myGen !== generationRef.current) return;
          const errMsg = video.error?.message || '';
          console.log('[DashPlayer] FFmpeg playback error:', errMsg, 'gen:', myGen);

          // Auto-reconnect once for live streams
          if (playbackStarted && isLive && !reconnecting) {
            reconnecting = true;
            console.log('[DashPlayer] Reconnecting FFmpeg...');
            if (window.dashPlayer?.ffmpegStop) await window.dashPlayer.ffmpegStop().catch(() => {});
            if (myGen !== generationRef.current) return;
            const r2 = await window.dashPlayer.ffmpegTranscodeUrl({ url: streamUrl });
            if (r2.success && r2.url && mountedRef.current && myGen === generationRef.current) {
              video.src = r2.url;
              video.load();
              video.play().catch(() => {});
            } else if (myGen === generationRef.current) {
              setError('Stream connection lost');
            }
            return;
          }

          if (!playbackStarted) {
            setError('Stream unavailable');
            setLoading(false);
          }
        };
        video.addEventListener('error', handleError, { once: true });

        setTimeout(() => { if (video && mountedRef.current && myGen === generationRef.current) video.play().catch(() => {}); }, 300);

        // Timeout
        retryTimerRef.current = setTimeout(() => {
          if (!mountedRef.current || playbackStarted || myGen !== generationRef.current) return;
          console.log('[DashPlayer] FFmpeg timeout, readyState:', video.readyState);
          setError('Stream timeout - try another channel');
          setLoading(false);
        }, 15000);
      } catch (e) {
        if (myGen !== generationRef.current) return;
        console.log('[DashPlayer] FFmpeg error:', e);
        setError('Playback error: ' + e.message);
        setLoading(false);
      }
    };

    // Start FFmpeg player
    startFfmpeg();

    return () => {
      mountedRef.current = false; // mark as unmounted BEFORE cleanup to prevent error handlers from firing
      cleanup();
      if (video) { video.src = ''; video.load(); }
      mountedRef.current = true; // reset for next mount
    };
  }, [url]);

  const handleAudioChange = async (trackId) => {
    setSelectedAudio(trackId);
    setShowTrackMenu(null);
    // Cancel any pending subtitle extraction (it uses a 2nd IPTV connection)
    if (subAbortRef.current) { subAbortRef.current.abort(); subAbortRef.current = null; }
    setCurrentSubText('');
    const isElectron = !!window.dashPlayer?.ffmpegTranscodeUrl;
    if (isElectron && url) {
      // Use savedTimeRef (persisted) instead of videoRef.currentTime (may be 0 after restart)
      const currentTime = savedTimeRef.current || videoRef.current?.currentTime || 0;
      const isLive = url.includes('/live/') || url.includes('/timeshift/');
      const streamUrl = isLive ? url.replace(/\.\w+$/, '.ts') : url;
      console.log('[DashPlayer] Switching audio track to', trackId, 'at position', currentTime, 'url:', streamUrl);
      try { await window.dashPlayer.ffmpegStop(); } catch(e) {}
      await new Promise(r => setTimeout(r, 100));
      const result = await window.dashPlayer.ffmpegTranscodeUrl({
        url: streamUrl, audioTrack: trackId,
        seek: !isLive && currentTime > 1 ? Math.floor(currentTime) : undefined,
      });
      console.log('[DashPlayer] Audio switch result:', result.success, result.url ? 'has url' : 'no url');
      if (result.success && result.url && videoRef.current) {
        setUsingFfmpeg(true);
        videoRef.current.src = result.url;
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      }
    }
  };

  // Parse WebVTT text into array of {start, end, text} cues
  const parseVTT = (vttText) => {
    const cues = [];
    // Support both HH:MM:SS.mmm and MM:SS.mmm formats
    const timePattern = /(\d{1,2}:?\d{2}:\d{2}[.,]\d{2,3})\s*-->\s*(\d{1,2}:?\d{2}:\d{2}[.,]\d{2,3})/;
    const blocks = vttText.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      for (let i = 0; i < lines.length; i++) {
        const timeMatch = lines[i].match(timePattern);
        if (timeMatch) {
          const parseTime = (t) => {
            const p = t.replace(',', '.').split(':');
            if (p.length === 3) return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2]);
            if (p.length === 2) return parseFloat(p[0]) * 60 + parseFloat(p[1]);
            return parseFloat(p[0]);
          };
          const text = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
          if (text) {
            cues.push({ start: parseTime(timeMatch[1]), end: parseTime(timeMatch[2]), text });
          }
          break;
        }
      }
    }
    console.log(`[DashPlayer] Parsed ${cues.length} subtitle cues from ${vttText.length} bytes`);
    return cues;
  };

  // Start subtitle sync timer - uses subtitleCues state (updated as more cues stream in)
  const subtitleCuesRef = useRef([]);
  const startSubtitleSync = (cues) => {
    if (subTimerRef.current) clearInterval(subTimerRef.current);
    subtitleCuesRef.current = cues;
    setSubtitleCues(cues);
    subTimerRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.paused) return;
      const t = videoRef.current.currentTime;
      const activeCues = subtitleCuesRef.current;
      const cue = activeCues.find(c => t >= c.start && t <= c.end);
      setCurrentSubText(cue ? cue.text : '');
    }, 200);
  };

  const stopSubtitleSync = () => {
    if (subTimerRef.current) { clearInterval(subTimerRef.current); subTimerRef.current = null; }
    setSubtitleCues([]);
    setCurrentSubText('');
  };

  const handleSubtitleChange = async (trackId) => {
    setSelectedSubtitle(trackId);
    setShowTrackMenu(null);

    if (trackId === -1) {
      stopSubtitleSync();
      return;
    }

    const isElectron = !!window.dashPlayer?.ffmpegSubtitleUrl;
    if (trackId >= 0 && isElectron && url) {
      console.log('[DashPlayer] Loading subtitle track', trackId);
      setCurrentSubText('Loading subtitles...');

      // Extract subtitles in parallel - video keeps playing (no connection limit issue)
      const subUrl = url;
      const result = await window.dashPlayer.ffmpegSubtitleUrl({ url: subUrl, subIndex: trackId });
      if (result.success && result.url) {
        try {
          if (subAbortRef.current) subAbortRef.current.abort();
          const controller = new AbortController();
          subAbortRef.current = controller;
          const timeout = setTimeout(() => controller.abort(), 120000);
          const resp = await fetch(result.url, { signal: controller.signal });
          clearTimeout(timeout);
          subAbortRef.current = null;
          const vttText = await resp.text();
          console.log('[DashPlayer] Subtitle VTT length:', vttText.length, 'first 200 chars:', vttText.substring(0, 200));
          const cues = parseVTT(vttText);
          if (cues.length > 0) {
            console.log(`[DashPlayer] Loaded ${cues.length} subtitle cues`);
            startSubtitleSync(cues);
          } else {
            console.log('[DashPlayer] No cues found in VTT data');
            setCurrentSubText('No subtitle data in this track');
            setTimeout(() => setCurrentSubText(''), 3000);
          }
        } catch(e) {
          console.log('[DashPlayer] Subtitle fetch error:', e.message);
          setCurrentSubText(e.name === 'AbortError' ? 'Subtitle loading timed out' : 'Subtitle extraction failed');
          setTimeout(() => setCurrentSubText(''), 3000);
        }
      } else {
        setCurrentSubText('Subtitles not available');
        setTimeout(() => setCurrentSubText(''), 3000);
      }
    }
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) video.requestFullscreen();
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
  };

  // Probe tracks on demand (only when user clicks Tracks button)
  const probeTracksOnDemand = async () => {
    if (probedRef.current || probing || !url || !window.dashPlayer?.ffmpegProbe) return;
    const isLive = url.includes('/live/') || url.includes('/timeshift/');
    if (isLive) return;
    setProbing(true);
    console.log('[DashPlayer] Probing tracks on demand...');
    try {
      const probeResult = await window.dashPlayer.ffmpegProbe({ url });
      if (!probeResult?.success || !mountedRef.current) {
        console.log('[DashPlayer] Probe failed:', probeResult?.error);
        setProbing(false);
        probedRef.current = true;
        return;
      }
      console.log('[DashPlayer] FFprobe result:', probeResult);
      if (probeResult.audio && probeResult.audio.length > 1) {
        setAudioTracks(probeResult.audio.map((t, i) => ({
          id: i, label: t.title || t.lang || `Audio ${i + 1}`, lang: t.lang || '', codec: t.codec,
        })));
      }
      let foundSubTracks = [];
      if (probeResult.subtitle && probeResult.subtitle.length > 0) {
        const bitmapCodecs = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'pgssub', 'dvdsub', 'dvbsub'];
        const textSubs = probeResult.subtitle.filter(t => !bitmapCodecs.includes(t.codec?.toLowerCase()));
        if (textSubs.length > 0) {
          foundSubTracks = textSubs;
          setSubtitleTracks(textSubs.map((t, i) => ({
            id: t.index, label: t.title || t.lang || `Subtitle ${t.index + 1}`, lang: t.lang || '', codec: t.codec,
          })));
        } else {
          console.log('[DashPlayer] Only bitmap subtitles found - not supported');
        }
      }
      probedRef.current = true;
      // Tracks are now shown in UI - user can select audio/subtitle from the menu
      // No FFmpeg restart here - subtitles will be extracted on-demand when user selects one
    } catch (e) {
      console.log('[DashPlayer] Probe error:', e);
    }
    setProbing(false);
  };

  const TrackMenus = () => {
    const hasAudio = audioTracks.length > 1;
    const hasSubs = subtitleTracks.length > 0;
    const isLive = url?.includes('/live/') || url?.includes('/timeshift/');
    const isVod = !isLive;
    const canProbe = isVod && window.dashPlayer?.ffmpegProbe && !probedRef.current;

    // Show Tracks button for VOD content even before probing
    if (!hasAudio && !hasSubs && !canProbe) return null;

    return (
      <div className="track-controls" style={{ display: 'flex', gap: 6, position: 'relative' }}>
        {/* Show probe button for VOD if not yet probed */}
        {canProbe && !hasAudio && !hasSubs && (
          <button className="track-btn" onClick={probeTracksOnDemand} disabled={probing}
            title="Detect audio & subtitle tracks" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 4, padding: '4px 8px', cursor: probing ? 'wait' : 'pointer', fontSize: 12 }}>
            {probing ? 'Scanning...' : 'Tracks'}
          </button>
        )}
        {hasAudio && (
          <div style={{ position: 'relative' }}>
            <button className="track-btn" onClick={() => setShowTrackMenu(showTrackMenu === 'audio' ? null : 'audio')}
              title="Audio tracks" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
              &#127911; {audioTracks[selectedAudio]?.label || 'Audio'}
            </button>
            {showTrackMenu === 'audio' && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: 4, minWidth: 140, marginBottom: 4, zIndex: 100 }}>
                {audioTracks.map(t => (
                  <div key={t.id} onClick={() => handleAudioChange(t.id)}
                    style={{ padding: '6px 10px', cursor: 'pointer', color: selectedAudio === t.id ? '#a78bfa' : '#fff', background: selectedAudio === t.id ? 'rgba(167,139,250,0.15)' : 'transparent', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {selectedAudio === t.id ? '✓ ' : '  '}{t.label}{t.lang ? ` (${t.lang})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {hasSubs && (
          <div style={{ position: 'relative' }}>
            <button className="track-btn" onClick={() => setShowTrackMenu(showTrackMenu === 'subtitle' ? null : 'subtitle')}
              title="Subtitles" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
              CC {selectedSubtitle >= 0 ? (subtitleTracks.find(t => t.id === selectedSubtitle)?.label || 'On') : 'Off'}
            </button>
            {showTrackMenu === 'subtitle' && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: 4, minWidth: 140, marginBottom: 4, zIndex: 100 }}>
                <div onClick={() => handleSubtitleChange(-1)}
                  style={{ padding: '6px 10px', cursor: 'pointer', color: selectedSubtitle === -1 ? '#a78bfa' : '#fff', background: selectedSubtitle === -1 ? 'rgba(167,139,250,0.15)' : 'transparent', borderRadius: 4, fontSize: 12 }}>
                  {selectedSubtitle === -1 ? '✓ ' : '  '}Off
                </div>
                {subtitleTracks.map(t => (
                  <div key={t.id} onClick={() => handleSubtitleChange(t.id)}
                    style={{ padding: '6px 10px', cursor: 'pointer', color: selectedSubtitle === t.id ? '#a78bfa' : '#fff', background: selectedSubtitle === t.id ? 'rgba(167,139,250,0.15)' : 'transparent', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {selectedSubtitle === t.id ? '✓ ' : '  '}{t.label}{t.lang ? ` (${t.lang})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Subtitle overlay style
  const subtitleOverlayStyle = {
    position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
    maxWidth: '80%', textAlign: 'center', pointerEvents: 'none', zIndex: 10,
  };
  const subtitleTextStyle = {
    display: 'inline', background: 'rgba(0,0,0,0.75)', color: '#fff',
    fontSize: '20px', fontFamily: 'Arial, sans-serif', fontWeight: 'bold',
    padding: '4px 12px', borderRadius: '4px', lineHeight: '1.5',
    textShadow: '1px 1px 2px #000, -1px -1px 2px #000',
    boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
  };

  const SubtitleOverlay = () => {
    if (!currentSubText) return null;
    return (
      <div style={subtitleOverlayStyle}>
        {currentSubText.split('\n').map((line, i) => (
          <div key={i}><span style={subtitleTextStyle}>{line}</span></div>
        ))}
      </div>
    );
  };

  if (inline) {
    return (
      <div className="inline-player">
        {loading && !error && <div className="inline-player-loading">Connecting{currentFormat ? ` (${currentFormat})` : ''}...</div>}
        {error && <div className="inline-player-error">{error}</div>}
        <div style={{ position: 'relative' }}>
          <video ref={videoRef} className="inline-video-element" controls autoPlay playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture />
          <SubtitleOverlay />
        </div>
        {!loading && !error && (
          <div className="inline-player-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrackMenus />
            <button className="fullscreen-btn" onClick={handleFullscreen} title="Fullscreen">&#x26F6;</button>
          </div>
        )}
      </div>
    );
  }

  const handleClose = () => {
    cleanup();
    onClose?.();
  };

  return (
    <div className="video-player-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="video-player-container">
        <div className="video-player-header">
          <span className="video-title">{title || 'Playing'}</span>
          <div className="video-header-actions">
            <button className="video-fullscreen-btn" onClick={handleFullscreen} title="Fullscreen">&#x26F6;</button>
            <button className="video-close-btn" onClick={handleClose}>&#10005;</button>
          </div>
        </div>
        {loading && !error && <div className="video-loading">Connecting{currentFormat ? ` (${currentFormat})` : ''}...</div>}
        {error && <div className="video-error">{error}</div>}
        <div style={{ position: 'relative' }}>
          <video ref={videoRef} className="video-element" controls autoPlay playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture />
          <SubtitleOverlay />
        </div>
        {!loading && !error && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
            <TrackMenus />
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════ HOME SCREEN (Interactive) ══════ */
function HomeScreen({ onNavigate, credentials, playerLicense, contentStats, loadingStats, statsError }) {
  const [time, setTime] = useState(new Date());
  const [device] = useState(() => getDeviceIdentity());
  const history = getWatchHistory();

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const dateLocale = getCurrentLanguage() === 'nl' ? 'nl-NL' : getCurrentLanguage() === 'tr' ? 'tr-TR' : 'en-US';
  const formatDate = (d) => d.toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const greeting = () => {
    const h = time.getHours();
    if (h < 12) return t('greeting_morning');
    if (h < 18) return t('greeting_afternoon');
    return t('greeting_evening');
  };

  return (
    <div className="home-screen">
      <div className="home-topbar">
        <div className="home-brand">
          <div className="home-brand-logo">D</div>
          <span className="home-brand-name">Dash Player</span>
        </div>
        <div className="home-clock">
          <div className="home-clock-time">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="home-clock-date">{formatDate(time)}</div>
        </div>
        <div className="home-topbar-actions">
          <button className="home-search-btn" onClick={() => onNavigate('search')}>&#128269; {t('search')}</button>
          <button className="home-notification-btn" onClick={() => onNavigate('multiscreen')} title="Multi Screen">
            &#9638;
            <div className="home-notification-dot" style={{display:'none'}} />
          </button>
        </div>
      </div>

      <div className="home-content">
        {/* Welcome */}
        <div className="home-welcome">
          <div className="home-welcome-text">{greeting()}</div>
          <div className="home-welcome-sub">{t('what_to_watch')}</div>
        </div>

        {/* Loading / Error */}
        {loadingStats && <div style={{ textAlign: 'center', padding: '10px 20px', color: '#7c3aed', fontSize: 14 }}>Loading content...</div>}
        {statsError && (
          <div style={{ textAlign: 'center', padding: '14px 20px', color: '#ef4444', fontSize: 13, background: 'rgba(239,68,68,0.08)', borderRadius: 8, margin: '0 20px 10px' }}>
            <div>{statsError}</div>
            {statsError.toLowerCase().includes('auth') && (
              <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
                <div>MAC Address: <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{device.mac}</span></div>
                <div style={{ marginTop: 4 }}>Server: <span style={{ color: '#e2e8f0' }}>{credentials?.url || 'N/A'}</span> | User: <span style={{ color: '#e2e8f0' }}>{credentials?.username || 'N/A'}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        <div className="home-stats">
          <div className="home-stat" onClick={() => onNavigate('live')}>
            <div className="home-stat-icon">&#128250;</div>
            <div className="home-stat-value">{contentStats.live || 0}</div>
            <div className="home-stat-label">{t('live_channels')}</div>
          </div>
          <div className="home-stat" onClick={() => onNavigate('vod')}>
            <div className="home-stat-icon">&#127910;</div>
            <div className="home-stat-value">{contentStats.vod || 0}</div>
            <div className="home-stat-label">{t('movies').toUpperCase()}</div>
          </div>
          <div className="home-stat" onClick={() => onNavigate('series')}>
            <div className="home-stat-icon">&#127916;</div>
            <div className="home-stat-value">{contentStats.series || 0}</div>
            <div className="home-stat-label">{t('series').toUpperCase()}</div>
          </div>
          <div className="home-stat" onClick={() => onNavigate('favorites')}>
            <div className="home-stat-icon">&#9733;</div>
            <div className="home-stat-value">{getFavorites('live').length + getFavorites('vod').length + getFavorites('series').length}</div>
            <div className="home-stat-label">{t('favorites').toUpperCase()}</div>
          </div>
        </div>

        {/* Main Cards */}
        <div className="home-cards-main">
          <div className="home-card home-card-live" onClick={() => onNavigate('live')}>
            <div className="home-card-icon">&#128250;</div>
            <div className="home-card-label">{t('live_tv')}</div>
            <div className="home-card-count">{contentStats.live || 0} {t('channels')}</div>
          </div>
          <div className="home-card home-card-movies" onClick={() => onNavigate('vod')}>
            <div className="home-card-icon">&#127910;</div>
            <div className="home-card-label">{t('movies')}</div>
            <div className="home-card-count">{contentStats.vod || 0} {t('titles')}</div>
          </div>
          <div className="home-card home-card-series" onClick={() => onNavigate('series')}>
            <div className="home-card-icon">&#127916;</div>
            <div className="home-card-label">{t('series')}</div>
            <div className="home-card-count">{contentStats.series || 0} {t('shows')}</div>
          </div>
          <div className="home-card home-card-radio" onClick={() => onNavigate('radio')}>
            <div className="home-card-icon">&#127911;</div>
            <div className="home-card-label">{t('radio')}</div>
            <div className="home-card-count">{contentStats.radio || 0} {t('stations')}</div>
          </div>
        </div>

        {/* Secondary Cards */}
        <div className="home-cards-secondary">
          <div className="home-card-sm" onClick={() => onNavigate('catchup')}>
            <span className="home-card-sm-icon">&#9202;</span>
            <span>{t('catch_up')}</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('favorites')}>
            <span className="home-card-sm-icon">&#9733;</span>
            <span>{t('favorites')}</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('epg')}>
            <span className="home-card-sm-icon">&#128203;</span>
            <span>{t('tv_guide')}</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('multiscreen')}>
            <span className="home-card-sm-icon">&#9638;</span>
            <span>{t('multi_screen')}</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('playlists')}>
            <span className="home-card-sm-icon">&#128220;</span>
            <span>{t('playlists')}</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('speedtest')}>
            <span className="home-card-sm-icon">&#128246;</span>
            <span>{t('speed_test')}</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('settings')}>
            <span className="home-card-sm-icon">&#9881;</span>
            <span>{t('settings')}</span>
          </div>
        </div>

        {/* Recently Watched */}
        {history.length > 0 && (
          <div className="home-recently">
            <div className="home-section-title">{t('recently_watched')}</div>
            <div className="home-recently-scroll">
              {history.slice(0, 12).map(item => (
                <div key={item.id} className="home-recently-card" onClick={() => {
                  const section = item.type === 'live' ? 'live' : item.type === 'vod' ? 'vod' : 'series';
                  onNavigate(section, item);
                }}>
                  <div className="home-recently-poster" style={item.icon ? { backgroundImage: `url(${item.icon})` } : {}}>
                    {!item.icon && (item.type === 'live' ? '\u{1F4FA}' : item.type === 'vod' ? '\u{1F3AC}' : '\u{1F3A5}')}
                  </div>
                  <div className="home-recently-info">
                    <div className="home-recently-name">{item.name}</div>
                    <div className="home-recently-meta">{item.type === 'live' ? t('live_tv') : item.type === 'vod' ? t('movie') : t('series')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="home-bottombar">
        <div className="home-playlist-info">
          MAC: <strong>{device.mac}</strong>
        </div>
        <div className="home-version">{playerLicense.type === 'trial' ? 'Trial: ' : 'Activated: '}<strong>{getPlayerStatusText(playerLicense)}</strong></div>
      </div>
    </div>
  );
}

/* ══════ LIVE TV SCREEN ══════ */
function LiveTVScreen({ onBack, api, autoPlayItem, onConsumeAutoPlay }) {
  const [categories, setCategories] = useState([{ category_id: 'all', category_name: 'All Channels' }]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [playingChannel, setPlayingChannel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [epgData, setEpgData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channelLoading, setChannelLoading] = useState(false);
  const [favs, setFavs] = useState(() => getFavorites('live'));
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [showEpgOverlay, setShowEpgOverlay] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCats = async () => {
      setLoading(true);
      if (api) {
        const cats = await api.getLiveCategories();
        if (!cancelled && cats && Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
          setSelectedCategory(cats[0].category_id);
        } else if (!cancelled) {
          setCategories(mockData.categories);
          setSelectedCategory(mockData.categories[0]?.category_id);
        }
      } else {
        setCategories(mockData.categories);
        setSelectedCategory('all');
        setChannels(mockData.channels);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCats();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchStreams = async () => {
      setChannelLoading(true);
      const streams = await api.getLiveStreams(selectedCategory);
      if (!cancelled && streams && Array.isArray(streams)) setChannels(streams);
      if (!cancelled) setChannelLoading(false);
    };
    fetchStreams();
    return () => { cancelled = true; };
  }, [selectedCategory, api]);

  // Auto-play a channel from Recently Watched
  useEffect(() => {
    if (!autoPlayItem || !autoPlayItem.streamId || !channels.length) return;
    const streamId = autoPlayItem.streamId.toString().replace('live_', '');
    const ch = channels.find(c => String(c.stream_id) === streamId);
    if (ch) {
      setSelectedChannel(ch);
      setPlayingChannel(ch);
      if (onConsumeAutoPlay) onConsumeAutoPlay();
    } else if (!channelLoading) {
      // Channel not in current category - switch to 'all' to find it
      if (selectedCategory !== 'all') {
        setSelectedCategory('all');
      } else if (onConsumeAutoPlay) {
        onConsumeAutoPlay(); // Channel not found at all
      }
    }
  }, [autoPlayItem, channels, channelLoading]);

  const filtered = useMemo(() => {
    let list = channels.filter(ch => {
      const matchSearch = !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFav = !showFavsOnly || favs.includes(ch.stream_id);
      return matchSearch && matchFav;
    });
    if (sortBy === 'name') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortBy === 'num') list = [...list].sort((a, b) => (a.num || a.stream_id) - (b.num || b.stream_id));
    return list;
  }, [channels, searchQuery, showFavsOnly, favs, sortBy]);

  const handleToggleFav = (e, streamId) => {
    e.stopPropagation();
    setFavs(toggleFavorite('live', streamId));
  };

  useEffect(() => {
    if (selectedChannel && api) {
      api.getEPG(selectedChannel.stream_id).then(data => {
        if (data && data.epg_listings && data.epg_listings.length > 0) {
          setEpgData(data.epg_listings.map((e, i) => ({
            id: e.id || i,
            title: e.title ? b64decode(e.title) : 'No Title',
            description: e.description ? b64decode(e.description) : '',
            start: e.start, end: e.end,
          })));
        } else {
          setEpgData([]);
        }
      });
    }
  }, [selectedChannel, api]);

  const isCurrentProgram = (p) => { const n = new Date(); return new Date(p.start) <= n && new Date(p.end) > n; };
  const isPastProgram = (p) => new Date(p.end) < new Date();
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const getProgress = (p) => { const n = new Date(); return Math.min(100, Math.max(0, ((n - new Date(p.start)) / (new Date(p.end) - new Date(p.start))) * 100)); };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('live_tv')}</h1>
        <div className="section-header-right">
          <button className={`header-filter-btn ${showFavsOnly ? 'active' : ''}`} onClick={() => setShowFavsOnly(!showFavsOnly)} title={t('favorites')}>&#9733;</button>
          <select className="header-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="default">{t('default_sort')}</option>
            <option value="name">{t('sort_az')}</option>
            <option value="num">{t('sort_number')}</option>
          </select>
          <span className="channel-count">{filtered.length} {t('channels')}</span>
        </div>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search">
            <input placeholder={t('search_channels')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}>
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>
        {!playingChannel ? (
          <>
            <div className="section-channel-list">
              {(loading || channelLoading) && <div className="loading-indicator">{t('loading_channels')}</div>}
              {!loading && !channelLoading && filtered.map(ch => (
                <div key={ch.stream_id} className={`ch-item ${selectedChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel(ch); setPlayingChannel(ch); addToHistory({ id: `live_${ch.stream_id}`, name: ch.name, type: 'live', streamId: ch.stream_id, icon: ch.stream_icon }); }}>
                  <span className="ch-num">{ch.num || ch.stream_id}</span>
                  {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" onError={e => { e.target.style.display = 'none'; if(e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }} /> : null}
                  <div className="ch-icon" style={ch.stream_icon ? { display: 'none' } : {}}>{(ch.name || '?').charAt(0)}</div>
                  <div className="ch-info">
                    <div className="ch-name">{ch.name}</div>
                    <div className="ch-prog">{ch.epg_channel_id || ''}</div>
                  </div>
                  <button className={`ch-fav-btn ${favs.includes(ch.stream_id) ? 'active' : ''}`} onClick={(e) => handleToggleFav(e, ch.stream_id)} title="Favorite">&#9733;</button>
                  <button className="ch-play-btn" onClick={(e) => { e.stopPropagation(); setSelectedChannel(ch); setPlayingChannel(ch); }} title="Play">&#9654;</button>
                  {selectedChannel?.stream_id === ch.stream_id && <div className="ch-live-dot" />}
                </div>
              ))}
            </div>
            <div className="section-epg">
              {selectedChannel ? (
                <>
                  <div className="epg-top">
                    <div>
                      <div className="epg-ch-name">{selectedChannel.name}</div>
                      <div className="epg-ch-cat">{selectedChannel.category_name}</div>
                    </div>
                    <button className="epg-play-btn" onClick={() => setPlayingChannel(selectedChannel)}>&#9654; Play</button>
                    <div className="epg-live-badge">LIVE</div>
                  </div>
                  <div className="epg-programs">
                    {epgData.map((prog, idx) => (
                      <div key={prog.id} className={`epg-prog ${idx % 2 === 1 ? 'epg-purple' : ''} ${isCurrentProgram(prog) ? 'current' : ''} ${isPastProgram(prog) ? 'past' : ''}`}>
                        <div className="epg-prog-time">{formatTime(prog.start)}</div>
                        <div className="epg-prog-details">
                          <div className="epg-prog-title">{prog.title}</div>
                          <div className="epg-prog-desc">{prog.description}</div>
                          {isCurrentProgram(prog) && (
                            <div className="epg-prog-progress"><div className="epg-prog-bar" style={{ width: `${getProgress(prog)}%` }} /></div>
                          )}
                        </div>
                      </div>
                    ))}
                    {epgData.length === 0 && <div className="epg-empty"><p>No EPG data available for this channel</p></div>}
                  </div>
                </>
              ) : (
                <div className="epg-empty">
                  <div style={{ fontSize: 48 }}>&#128250;</div>
                  <p>{t('select_channel_epg')}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="live-player-area">
            <div className="live-player-main">
              <div className="live-player-top">
                <div className="live-player-info">
                  <span className="live-player-channel-name">{playingChannel.name}</span>
                  <span className="epg-live-badge">LIVE</span>
                </div>
                <div className="live-player-actions">
                  <button className="back-btn" onClick={() => setPlayingChannel(null)}>&#9632; Stop</button>
                </div>
              </div>
              <div className="live-player-video">
                {api && <VideoPlayer key={playingChannel.stream_id} url={api.getLiveUrl(playingChannel.stream_id)} title={playingChannel.name} onClose={() => setPlayingChannel(null)} inline={true} />}
              </div>
              <div className="live-player-epg-bar" onClick={() => epgData.length > 0 && setShowEpgOverlay(v => !v)}>
                {epgData.length > 0 ? epgData.filter(p => isCurrentProgram(p) || !isPastProgram(p)).slice(0, 4).map((prog, idx) => (
                  <div key={prog.id} className={`live-epg-item ${isCurrentProgram(prog) ? 'current' : ''}`}>
                    <span className="live-epg-time">{formatTime(prog.start)}</span>
                    <span className="live-epg-title">{prog.title}</span>
                    {isCurrentProgram(prog) && (
                      <div className="epg-prog-progress" style={{ marginTop: 4 }}><div className="epg-prog-bar" style={{ width: `${getProgress(prog)}%` }} /></div>
                    )}
                  </div>
                )) : <div className="live-epg-item"><span className="live-epg-title" style={{ opacity: 0.5 }}>No EPG data available</span></div>}
              </div>
              {showEpgOverlay && epgData.length > 0 && (
                <div className="live-epg-overlay">
                  <div className="live-epg-overlay-close">
                    <h3>Program Guide</h3>
                    <button onClick={(e) => { e.stopPropagation(); setShowEpgOverlay(false); }}>&times;</button>
                  </div>
                  {epgData.map((prog, idx) => (
                    <div key={prog.id} className={`epg-prog ${idx % 2 === 1 ? 'epg-purple' : ''} ${isCurrentProgram(prog) ? 'current' : ''} ${isPastProgram(prog) ? 'past' : ''}`}>
                      <div className="epg-prog-time">{formatTime(prog.start)}</div>
                      <div className="epg-prog-details">
                        <div className="epg-prog-title">{prog.title}</div>
                        <div className="epg-prog-desc">{prog.description}</div>
                        {isCurrentProgram(prog) && (
                          <div className="epg-prog-progress"><div className="epg-prog-bar" style={{ width: `${getProgress(prog)}%` }} /></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="live-player-channels">
              {filtered.slice(0, 50).map(ch => (
                <div key={ch.stream_id} className={`ch-item ${playingChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel(ch); setPlayingChannel(ch); addToHistory({ id: `live_${ch.stream_id}`, name: ch.name, type: 'live', streamId: ch.stream_id, icon: ch.stream_icon }); }}>
                  <span className="ch-num">{ch.num || ch.stream_id}</span>
                  {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" style={{ width: 28, height: 28 }} onError={e => { e.target.style.display = 'none'; }} /> : null}
                  <div className="ch-info" style={{ minWidth: 0 }}>
                    <div className="ch-name" style={{ fontSize: 11 }}>{ch.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════ MEDIA SCREEN (Movies / Series) ══════ */
function MediaScreen({ type, onBack, api, autoPlayItem, onConsumeAutoPlay }) {
  const isVod = type === 'vod';
  const title = isVod ? t('movies') : t('series');
  const [categories, setCategories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [playingItem, setPlayingItem] = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [epPage, setEpPage] = useState(0);
  const EP_PER_PAGE = 20;
  const favType = isVod ? 'vod' : 'series';
  const [favs, setFavs] = useState(() => getFavorites(favType));
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [sortBy, setSortBy] = useState('default');

  const handleToggleFav = (e, itemId) => { e.stopPropagation(); setFavs(toggleFavorite(favType, itemId)); };

  useEffect(() => {
    let cancelled = false;
    const fetchCats = async () => {
      setLoading(true);
      const fallbackCats = isVod ? mockData.vodCategories : mockData.seriesCategories;
      if (api) {
        const cats = isVod ? await api.getVodCategories() : await api.getSeriesCategories();
        if (!cancelled) {
          const catList = cats && Array.isArray(cats) && cats.length > 0 ? cats : fallbackCats;
          setCategories(catList);
          setSelectedCategory(catList[0]?.category_id);
        }
      } else {
        setCategories(fallbackCats);
        setSelectedCategory(fallbackCats[0]?.category_id);
        setAllItems(isVod ? mockData.vodStreams : mockData.series);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCats();
    return () => { cancelled = true; };
  }, [api, type]);

  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchItems = async () => {
      setItemsLoading(true);
      const items = isVod ? await api.getVodStreams(selectedCategory) : await api.getSeries(selectedCategory);
      if (!cancelled && items && Array.isArray(items)) setAllItems(items);
      if (!cancelled) setItemsLoading(false);
    };
    fetchItems();
    return () => { cancelled = true; };
  }, [selectedCategory, api, type]);

  const filtered = useMemo(() => {
    const itemId = (i) => i.stream_id || i.series_id;
    let list = allItems.filter(item => {
      const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFav = !showFavsOnly || favs.includes(itemId(item));
      return matchSearch && matchFav;
    });
    if (sortBy === 'name') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortBy === 'rating') list = [...list].sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    return list;
  }, [allItems, searchQuery, showFavsOnly, favs, sortBy]);

  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(0);
  const gridRef = useRef(null);
  useEffect(() => { setCurrentPage(0); }, [selectedCategory, searchQuery]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visibleItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const goToPage = (page) => { setCurrentPage(page); if (gridRef.current) gridRef.current.scrollTop = 0; };

  // Auto-play item from Recently Watched
  useEffect(() => {
    if (!autoPlayItem || !autoPlayItem.streamId || !allItems.length || itemsLoading) return;
    const streamId = autoPlayItem.streamId.toString().replace('vod_', '');
    if (isVod) {
      const item = allItems.find(i => String(i.stream_id) === streamId);
      if (item && api) {
        setPlayingItem(item);
        if (onConsumeAutoPlay) onConsumeAutoPlay();
      }
    }
    if (onConsumeAutoPlay) onConsumeAutoPlay();
  }, [autoPlayItem, allItems, itemsLoading]);

  const handleSeriesClick = async (item) => {
    if (isVod) return;
    setSelectedSeries(item);
    setSeriesLoading(true);
    if (api) {
      const info = await api.getSeriesInfo(item.series_id);
      if (info) setSeriesInfo(info);
    }
    setSeriesLoading(false);
  };

  // Series detail view
  if (selectedSeries && !isVod) {
    const seasons = seriesInfo?.episodes ? Object.keys(seriesInfo.episodes).sort((a, b) => Number(a) - Number(b)) : [];
    const currentSeason = activeSeason || seasons[0];
    const allEpisodes = currentSeason && seriesInfo?.episodes?.[currentSeason] ? seriesInfo.episodes[currentSeason] : [];
    const totalEpPages = Math.ceil(allEpisodes.length / EP_PER_PAGE);
    const currentEpisodes = allEpisodes.slice(epPage * EP_PER_PAGE, (epPage + 1) * EP_PER_PAGE);

    // If an episode is playing, show Live TV-style layout
    if (playingItem && api) {
      return (
        <div className="section-screen" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <div className="section-header" style={{ flexShrink: 0 }}>
            <button className="back-btn" onClick={() => setPlayingItem(null)}>&#8592; {t('back')}</button>
            <h1 className="section-title">{selectedSeries.name}</h1>
          </div>
          <div className="live-player-area" style={{ flex: 1 }}>
            <div className="live-player-main">
              <div className="live-player-top">
                <div className="live-player-info">
                  <span className="live-player-channel-name">{playingItem.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>S{currentSeason}</span>
                </div>
                <div className="live-player-actions">
                  <button className="back-btn" onClick={() => setPlayingItem(null)}>&#9632; Stop</button>
                </div>
              </div>
              <div className="live-player-video" style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
                <VideoPlayer
                  key={playingItem.stream_id}
                  url={api.getSeriesUrl(playingItem.stream_id, playingItem.container_extension || 'mp4')}
                  title={playingItem.name}
                  onClose={() => setPlayingItem(null)}
                  inline={true}
                />
              </div>
              {/* Season tabs at bottom of player */}
              <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: 'var(--card-bg)', borderTop: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0, zIndex: 10 }}>
                {seasons.map(season => (
                  <button key={season} className={`season-tab ${(currentSeason === season) ? 'active' : ''}`}
                    onClick={() => { setActiveSeason(season); setEpPage(0); }}
                    style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '4px 10px' }}>
                    S{season}
                    <span className="season-tab-count" style={{ marginLeft: 4 }}>{seriesInfo.episodes[season].length}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Episodes list on right side */}
            <div className="live-player-channels" style={{ overflowY: 'auto' }}>
              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                {allEpisodes.length} episodes
                {totalEpPages > 1 && (
                  <span style={{ float: 'right' }}>
                    <button className="ep-page-btn" disabled={epPage === 0} onClick={() => setEpPage(p => p - 1)} style={{ fontSize: 10, padding: '1px 6px' }}>&#8592;</button>
                    <span style={{ margin: '0 4px' }}>{epPage + 1}/{totalEpPages}</span>
                    <button className="ep-page-btn" disabled={epPage >= totalEpPages - 1} onClick={() => setEpPage(p => p + 1)} style={{ fontSize: 10, padding: '1px 6px' }}>&#8594;</button>
                  </span>
                )}
              </div>
              {currentEpisodes.map(ep => (
                <div key={ep.id} className={`ch-item ${playingItem?.stream_id === ep.id ? 'active' : ''}`}
                  onClick={() => setPlayingItem({
                    stream_id: ep.id, name: ep.title || `Episode ${ep.episode_num}`,
                    container_extension: ep.container_extension || 'mp4', isSeries: true
                  })}>
                  <span className="ch-num" style={{ fontSize: 10, minWidth: 28 }}>E{ep.episode_num}</span>
                  <div className="ch-info" style={{ minWidth: 0 }}>
                    <div className="ch-name" style={{ fontSize: 11 }}>{ep.title || `Episode ${ep.episode_num}`}</div>
                    {ep.info?.duration && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{ep.info.duration}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Series detail view (no episode playing yet)
    return (
      <div className="section-screen">
        <div className="section-header">
          <button className="back-btn" onClick={() => { setSelectedSeries(null); setSeriesInfo(null); setActiveSeason(null); setEpPage(0); }}>&#8592; {t('back')}</button>
          <h1 className="section-title">{selectedSeries.name}</h1>
        </div>
        <div className="section-body">
          <div className="series-detail">
            <div className="series-detail-top">
              {(selectedSeries.cover || selectedSeries.stream_icon) && (
                <img className="series-detail-cover" src={selectedSeries.cover || selectedSeries.stream_icon} alt="" />
              )}
              <div className="series-detail-info">
                <h2>{selectedSeries.name}</h2>
                {seriesInfo?.info?.plot && <p className="series-plot">{seriesInfo.info.plot}</p>}
                {seriesInfo?.info?.genre && <p className="series-meta">Genre: {seriesInfo.info.genre}</p>}
                {seriesInfo?.info?.releaseDate && <p className="series-meta">Released: {seriesInfo.info.releaseDate}</p>}
                {selectedSeries.rating && selectedSeries.rating !== '0' && <p className="series-meta">Rating: {selectedSeries.rating}</p>}
              </div>
            </div>
            {seriesLoading && <div className="loading-indicator">Loading episodes...</div>}
            {!seriesLoading && seasons.length > 0 && (
              <>
                <div className="season-tabs">
                  {seasons.map(season => (
                    <button key={season} className={`season-tab ${(currentSeason === season) ? 'active' : ''}`}
                      onClick={() => { setActiveSeason(season); setEpPage(0); }}>
                      Season {season}
                      <span className="season-tab-count">{seriesInfo.episodes[season].length}</span>
                    </button>
                  ))}
                </div>
                <div className="ep-pagination-header">
                  <span className="ep-count">{allEpisodes.length} episodes</span>
                  {totalEpPages > 1 && (
                    <div className="ep-pagination">
                      <button className="ep-page-btn" disabled={epPage === 0} onClick={() => setEpPage(p => p - 1)}>&#8592; Prev</button>
                      <span className="ep-page-info">Page {epPage + 1} of {totalEpPages}</span>
                      <button className="ep-page-btn" disabled={epPage >= totalEpPages - 1} onClick={() => setEpPage(p => p + 1)}>Next &#8594;</button>
                    </div>
                  )}
                </div>
                <div className="series-episodes">
                  {currentEpisodes.map(ep => (
                    <div key={ep.id} className="series-episode" onClick={() => setPlayingItem({
                      stream_id: ep.id, name: ep.title || `Episode ${ep.episode_num}`,
                      container_extension: ep.container_extension || 'mp4', isSeries: true
                    })}>
                      <span className="ep-num">E{ep.episode_num}</span>
                      <div className="ep-info">
                        <div className="ep-title">{ep.title || `Episode ${ep.episode_num}`}</div>
                        {ep.info?.duration && <span className="ep-duration">{ep.info.duration}</span>}
                      </div>
                      <span className="ep-play">&#9654;</span>
                    </div>
                  ))}
                </div>
                {totalEpPages > 1 && (
                  <div className="ep-pagination" style={{justifyContent: 'center', marginTop: 12}}>
                    <button className="ep-page-btn" disabled={epPage === 0} onClick={() => setEpPage(p => p - 1)}>&#8592; Prev</button>
                    <span className="ep-page-info">Page {epPage + 1} of {totalEpPages}</span>
                    <button className="ep-page-btn" disabled={epPage >= totalEpPages - 1} onClick={() => setEpPage(p => p + 1)}>Next &#8594;</button>
                  </div>
                )}
              </>
            )}
            {!seriesLoading && seasons.length === 0 && <div className="loading-indicator">No episode data available</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{title}</h1>
        <div className="section-header-right">
          <button className={`header-filter-btn ${showFavsOnly ? 'active' : ''}`} onClick={() => setShowFavsOnly(!showFavsOnly)} title={t('favorites')}>&#9733;</button>
          <select className="header-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="default">{t('default_sort')}</option>
            <option value="name">{t('sort_az')}</option>
            <option value="rating">{t('sort_rating')}</option>
          </select>
          <span className="channel-count">{filtered.length} {t('titles')}</span>
        </div>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search">
            <input placeholder={isVod ? t('search_movies') : t('search_series')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}>
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="section-media-grid" ref={gridRef}>
          {(loading || itemsLoading) && <div className="loading-indicator">Loading {title.toLowerCase()}...</div>}
          {!loading && !itemsLoading && visibleItems.map(item => {
            const posterUrl = item.stream_icon || item.cover || '';
            const itemName = item.name || item.title || '?';
            const itemId = item.stream_id || item.series_id;
            const catName = categories.find(c => String(c.category_id) === String(item.category_id))?.category_name || '';
            return (
              <div key={itemId} className="media-card" onClick={() => {
                if (isVod) { setPlayingItem(item); addToHistory({ id: `vod_${item.stream_id}`, name: item.name, type: 'vod', streamId: item.stream_id, icon: posterUrl }); }
                else handleSeriesClick(item);
              }}>
                <div className="media-poster" style={posterUrl ? { backgroundImage: `url(${posterUrl})`, backgroundSize: 'cover', backgroundPosition: 'center top' } : {}}>
                  {!posterUrl && <span className="media-poster-letter">{itemName.charAt(0)}</span>}
                </div>
                {item.rating && item.rating !== '0' && String(item.rating) !== '0' && <div className="media-card-rating">&#9733; {item.rating}</div>}
                <button className={`media-fav-btn ${favs.includes(itemId) ? 'active' : ''}`} onClick={(e) => handleToggleFav(e, itemId)}>&#9733;</button>
                <div className="media-play-overlay">&#9654;</div>
                <div className="media-caption">
                  <div className="media-caption-inner">
                    <div className="media-caption-lines" />
                    <div className="media-card-title">{itemName}</div>
                    {catName && <span className="media-card-category">{catName}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && !itemsLoading && filtered.length > 0 && (
            <div className="media-pagination" style={{gridColumn: '1 / -1'}}>
              <button className="media-page-btn" disabled={currentPage === 0} onClick={() => goToPage(currentPage - 1)}>&#8592; Prev</button>
              <div className="media-page-numbers">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page;
                  if (totalPages <= 7) page = i;
                  else if (currentPage < 4) page = i;
                  else if (currentPage >= totalPages - 4) page = totalPages - 7 + i;
                  else page = currentPage - 3 + i;
                  return (
                    <button key={page} className={`media-page-num ${currentPage === page ? 'active' : ''}`} onClick={() => goToPage(page)}>{page + 1}</button>
                  );
                })}
              </div>
              <button className="media-page-btn" disabled={currentPage >= totalPages - 1} onClick={() => goToPage(currentPage + 1)}>Next &#8594;</button>
              <span className="media-page-info">{filtered.length} titles</span>
            </div>
          )}
        </div>
      </div>
      {/* VOD Live TV-style player */}
      {playingItem && api && isVod && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button className="back-btn" onClick={() => setPlayingItem(null)}>&#8592; {t('back')}</button>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{playingItem.name || playingItem.title}</h2>
          </div>
          <div className="live-player-area" style={{ flex: 1 }}>
            <div className="live-player-main">
              <div className="live-player-top">
                <div className="live-player-info">
                  <span className="live-player-channel-name">{playingItem.name || playingItem.title}</span>
                </div>
                <div className="live-player-actions">
                  <button className="back-btn" onClick={() => setPlayingItem(null)}>&#9632; Stop</button>
                </div>
              </div>
              <div className="live-player-video">
                <VideoPlayer
                  key={playingItem.stream_id}
                  url={api.getVodUrl(playingItem.stream_id, playingItem.container_extension || 'mp4')}
                  title={playingItem.name || playingItem.title}
                  onClose={() => setPlayingItem(null)}
                  inline={true}
                />
              </div>
            </div>
            {/* Movies list on right side */}
            <div className="live-player-channels" style={{ overflowY: 'auto' }}>
              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{filtered.length} {t('titles')}</span>
                {totalPages > 1 && (
                  <span>
                    <button className="ep-page-btn" disabled={currentPage === 0} onClick={() => goToPage(currentPage - 1)} style={{ fontSize: 10, padding: '1px 6px' }}>&#8592;</button>
                    <span style={{ margin: '0 4px' }}>{currentPage + 1}/{totalPages}</span>
                    <button className="ep-page-btn" disabled={currentPage >= totalPages - 1} onClick={() => goToPage(currentPage + 1)} style={{ fontSize: 10, padding: '1px 6px' }}>&#8594;</button>
                  </span>
                )}
              </div>
              {visibleItems.map(item => {
                const posterUrl = item.stream_icon || item.cover || '';
                const itemName = item.name || item.title || '?';
                return (
                  <div key={item.stream_id} className={`ch-item ${playingItem?.stream_id === item.stream_id ? 'active' : ''}`}
                    onClick={() => { setPlayingItem(item); addToHistory({ id: `vod_${item.stream_id}`, name: item.name, type: 'vod', streamId: item.stream_id, icon: posterUrl }); }}>
                    {posterUrl ? <img className="ch-icon-img" src={posterUrl} alt="" style={{ width: 28, height: 38, objectFit: 'cover', borderRadius: 3 }} onError={e => { e.target.style.display = 'none'; }} /> : <span style={{ fontSize: 14 }}>{'\u{1F3AC}'}</span>}
                    <div className="ch-info" style={{ minWidth: 0 }}>
                      <div className="ch-name" style={{ fontSize: 11 }}>{itemName}</div>
                      {item.rating && item.rating !== '0' && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>&#9733; {item.rating}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Series episode popup fallback (for non-inline series) */}
      {playingItem && api && playingItem.isSeries && (
        <VideoPlayer url={api.getSeriesUrl(playingItem.stream_id, playingItem.container_extension || 'mp4')} title={playingItem.name || playingItem.title} onClose={() => setPlayingItem(null)} />
      )}
    </div>
  );
}

/* ══════ RADIO SCREEN ══════ */
function RadioScreen({ onBack, api }) {
  // No static radio stations - only show real streams from Xtream API

  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [playing, setPlaying] = useState(null);
  const [playingUrl, setPlayingUrl] = useState(null);
  const [apiCategories, setApiCategories] = useState([]);
  const [apiStations, setApiStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingApi, setUsingApi] = useState(false);

  // Try to load radio streams from Xtream API (dedicated radio endpoint first, then fallback to live categories)
  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const isRadioCategory = (name) => {
      if (!name) return false;
      const n = name.toLowerCase();
      const keywords = ['radio', 'radyo', 'fm ', ' fm', 'muziek', 'musik', 'music', 'müzik'];
      return keywords.some(k => n.includes(k)) || /\bfm\b/i.test(name) || /\bam\b/i.test(name);
    };
    const fetchRadio = async () => {
      setLoading(true);
      try {
        // Method 1: Try dedicated radio API endpoints (some Xtream servers support this)
        const radioCatsApi = await api.getRadioCategories();
        if (radioCatsApi && Array.isArray(radioCatsApi) && radioCatsApi.length > 0) {
          console.log('[DashPlayer] Dedicated radio categories found:', radioCatsApi.map(c => `${c.category_id}:${c.category_name}`));
          let allStreams = [];
          // First try: fetch all radio streams at once (no category filter)
          const allRadio = await api.getRadioStreams();
          if (allRadio && Array.isArray(allRadio) && allRadio.length > 0) {
            console.log('[DashPlayer] All radio streams fetched:', allRadio.length);
            const catMap = {};
            radioCatsApi.forEach(c => { catMap[String(c.category_id)] = c.category_name; });
            allStreams = allRadio.map(s => ({ ...s, _category_name: catMap[String(s.category_id)] || 'Radio' }));
          }
          // Second try: fetch per category
          if (allStreams.length === 0) {
            for (const cat of radioCatsApi) {
              const streams = await api.getRadioStreams(cat.category_id);
              console.log(`[DashPlayer] Radio streams for ${cat.category_name}:`, streams?.length || 0);
              if (streams && Array.isArray(streams)) {
                streams.forEach(s => allStreams.push({ ...s, _category_name: cat.category_name }));
              }
            }
          }
          // Third try: maybe radio streams are served via live streams endpoint with radio category IDs
          if (allStreams.length === 0) {
            for (const cat of radioCatsApi) {
              const streams = await api.getLiveStreams(cat.category_id);
              console.log(`[DashPlayer] Live streams for radio cat ${cat.category_name}:`, streams?.length || 0);
              if (streams && Array.isArray(streams)) {
                streams.forEach(s => allStreams.push({ ...s, _category_name: cat.category_name }));
              }
            }
          }
          if (!cancelled && allStreams.length > 0) {
            setApiCategories([{ category_id: 'all', category_name: t('all_stations') || 'All Stations' }, ...radioCatsApi]);
            setApiStations(allStreams);
            setSelectedCat('all');
            setUsingApi(true);
            setLoading(false);
            return;
          }
          console.log('[DashPlayer] Radio categories found but no streams could be fetched');
        }

        // Method 2: Fallback - search live categories for radio-related names
        const cats = await api.getLiveCategories();
        if (!cats || !Array.isArray(cats)) { setLoading(false); return; }
        console.log('[DashPlayer] All live categories:', cats.map(c => `${c.category_id}:${c.category_name}`).join(', '));
        const radioCats = cats.filter(c => isRadioCategory(c.category_name));
        console.log('[DashPlayer] Radio categories from live:', radioCats.map(c => c.category_name));
        if (radioCats.length === 0) { setLoading(false); return; }
        const allStreams = [];
        for (const cat of radioCats) {
          const streams = await api.getLiveStreams(cat.category_id);
          if (streams && Array.isArray(streams)) {
            streams.forEach(s => allStreams.push({ ...s, _category_name: cat.category_name }));
          }
        }
        if (!cancelled && allStreams.length > 0) {
          setApiCategories([{ category_id: 'all', category_name: t('all_stations') || 'All Stations' }, ...radioCats]);
          setApiStations(allStreams);
          setSelectedCat('all');
          setUsingApi(true);
        }
      } catch (e) { console.warn('[DashPlayer] Radio fetch error:', e); }
      if (!cancelled) setLoading(false);
    };
    fetchRadio();
    return () => { cancelled = true; };
  }, [api]);

  const filtered = apiStations.filter(s => {
    const matchCat = selectedCat === 'all' || String(s.category_id) === String(selectedCat);
    const matchSearch = !searchQuery || (s.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const audioRef = useRef(null);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState(null);
  const [radioElapsed, setRadioElapsed] = useState(0);

  // Cleanup audio AND FFmpeg on unmount (prevents radio audio leaking into other sections)
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
      if (window.dashPlayer?.ffmpegStop) window.dashPlayer.ffmpegStop().catch(() => {});
    };
  }, []);

  // Update elapsed time every second while radio is playing
  useEffect(() => {
    if (!playing || radioLoading || radioError) return;
    const interval = setInterval(() => {
      if (playing._startTime) setRadioElapsed(Math.floor((Date.now() - playing._startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [playing, radioLoading, radioError]);

  const handlePlay = (station) => {
    if (!api) return;
    // Stop previous audio AND FFmpeg process (prevents audio leakage from previous station)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    if (window.dashPlayer?.ffmpegStop) window.dashPlayer.ffmpegStop().catch(() => {});
    setPlaying(station);
    setRadioLoading(true);
    setRadioError(null);
    setPlayingUrl(null);

    // Try radio-specific MP3 URLs first (HTML5 Audio), then fall back to FFmpeg
    const urls = api.getRadioUrls(station.stream_id);
    let tried = 0;
    let settled = false;

    const tryUrl = () => {
      if (settled) return;
      if (tried >= urls.length) {
        // All direct audio URLs failed - use FFmpeg radio mode (audio-only MP3 output)
        settled = true;
        const liveUrl = api.getLiveUrl(station.stream_id);
        const isElectron = !!window.dashPlayer?.ffmpegRadioUrl;
        if (isElectron) {
          // Try .ts first, then .m3u8 if that fails
          const tryFFmpegRadio = async (streamUrl) => {
            console.log('[DashPlayer] Using FFmpeg radio for stream:', streamUrl);
            const result = await window.dashPlayer.ffmpegRadioUrl({ url: streamUrl });
            if (!result.success || !result.url) return false;

            return new Promise((resolve) => {
              const audio = new Audio();
              audioRef.current = audio;
              let resolved = false;

              const succeed = () => {
                if (resolved) return;
                resolved = true;
                station._startTime = Date.now();
                setRadioLoading(false);
                setRadioError(null);
                audio.play().catch(() => {});
                resolve(true);
              };

              const fail = () => {
                if (resolved) return;
                resolved = true;
                audio.pause();
                audio.src = '';
                resolve(false);
              };

              audio.addEventListener('canplay', succeed, { once: true });
              audio.addEventListener('playing', succeed, { once: true });
              audio.addEventListener('error', fail, { once: true });
              // 6 second timeout per attempt
              setTimeout(() => { if (!resolved) fail(); }, 6000);

              audio.src = result.url;
              audio.load();
            });
          };

          // Sequential: try .ts, then .m3u8
          (async () => {
            const tsUrl = liveUrl.replace(/\.\w+$/, '.ts');
            if (await tryFFmpegRadio(tsUrl)) return;
            // Stop previous FFmpeg before retrying with different URL
            if (window.dashPlayer?.ffmpegStop) await window.dashPlayer.ffmpegStop().catch(() => {});
            const m3u8Url = liveUrl.replace(/\.\w+$/, '.m3u8');
            if (await tryFFmpegRadio(m3u8Url)) return;
            setRadioLoading(false);
            setRadioError('Stream unavailable');
          })();
        } else {
          // Mobile: use HLS for radio
          console.log('[DashPlayer] Using HLS for radio stream');
          setRadioLoading(false);
          setPlayingUrl(liveUrl);
        }
        return;
      }
      const url = urls[tried++];
      console.log(`[DashPlayer] Trying radio URL ${tried}/${urls.length}: ${url}`);
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;

      const onSuccess = () => {
        if (settled) return;
        settled = true;
        station._startTime = Date.now();
        setRadioLoading(false);
        setRadioError(null);
      };

      const onFail = () => {
        if (settled) return;
        audio.pause();
        audio.src = '';
        tryUrl();
      };

      audio.addEventListener('canplay', () => {
        onSuccess();
        audio.play().catch(() => {});
      }, { once: true });

      audio.addEventListener('playing', () => { onSuccess(); }, { once: true });

      audio.addEventListener('error', () => { onFail(); }, { once: true });

      // Quick timeout: 4 seconds per URL, so fallback happens fast
      setTimeout(() => { if (!settled && audio === audioRef.current && audio.readyState < 2) onFail(); }, 4000);

      audio.src = url;
      audio.load();
    };
    tryUrl();
  };

  const handleStop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    // Stop FFmpeg if it was used for radio
    if (window.dashPlayer?.ffmpegStop) window.dashPlayer.ffmpegStop().catch(() => {});
    setPlaying(null);
    setPlayingUrl(null);
    setRadioLoading(false);
    setRadioError(null);
  };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('radio')}</h1>
        <div className="section-header-right"><span className="channel-count">{filtered.length} {t('stations')}</span></div>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search"><input placeholder={t('search_stations')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="sidebar-categories">
            {apiCategories.map(cat => (
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCat) === String(cat.category_id) ? 'active' : ''}`} onClick={() => setSelectedCat(cat.category_id)}>
                <span>{cat.category_name}</span>
                <span className="sidebar-cat-count">{cat.category_id === 'all' ? apiStations.length : apiStations.filter(s => String(s.category_id) === String(cat.category_id)).length}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="radio-grid">
          {loading && <div className="loading-indicator" style={{ gridColumn: '1/-1' }}>{t('loading_radio')}</div>}
          {!loading && apiStations.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#127911;</div>
              <h3>{t('no_radio')}</h3>
              <p>{t('no_radio_desc')}</p>
            </div>
          )}
          {!loading && filtered.map(station => (
            <div key={station.stream_id || station.id} className={`radio-card ${playing?.stream_id === station.stream_id && playing?.id === station.id ? 'playing' : ''}`} onClick={() => handlePlay(station)}>
              {station.stream_icon ? <img src={station.stream_icon} alt="" className="radio-icon" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: '#1a1a2e' }} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} /> : null}
              <div className="radio-icon" style={station.stream_icon ? { display: 'none' } : {}}>&#127911;</div>
              <div className="radio-info">
                <div className="radio-name">{station.name}</div>
                <div className="radio-genre">{station.genre || station._category_name || ''}</div>
              </div>
              {(playing?.stream_id === station.stream_id || playing?.id === station.id) && <div className="radio-playing-indicator"><span className="radio-bar"></span><span className="radio-bar"></span><span className="radio-bar"></span></div>}
            </div>
          ))}
        </div>
      </div>
      {/* Audio radio player bar */}
      {playing && !playingUrl && (() => {
        const mm = String(Math.floor(radioElapsed / 60)).padStart(2, '0');
        const ss = String(radioElapsed % 60).padStart(2, '0');
        return (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(135deg, #2d1b69, #4a2c8a, #6b3fa0)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, zIndex: 1000, borderTop: '2px solid rgba(138,92,246,0.4)', boxShadow: '0 -4px 20px rgba(138,92,246,0.2)' }}>
            {playing.stream_icon ? <img src={playing.stream_icon} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: 'rgba(255,255,255,0.1)', padding: 2 }} onError={e => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex'); }} /> : null}
            <span style={{ fontSize: 28, display: playing.stream_icon ? 'none' : 'flex' }}>&#127911;</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{playing.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{radioLoading ? t('connecting') + '...' : radioError ? radioError : playing._category_name || t('radio')}</div>
            </div>
            {!radioLoading && !radioError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'monospace' }}>
                <div className="radio-playing-indicator"><span className="radio-bar"></span><span className="radio-bar"></span><span className="radio-bar"></span></div>
                <span>{mm}:{ss}</span>
              </div>
            )}
            <button onClick={handleStop} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 38, height: 38, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.25)'} onMouseLeave={e => e.target.style.background='rgba(255,255,255,0.15)'}>&#9632;</button>
          </div>
        );
      })()}
      {/* VideoPlayer fallback for radio streams that don't support MP3 (e.g. .ts streams) */}
      {playingUrl && <VideoPlayer url={playingUrl} title={playing?.name || 'Radio'} onClose={() => { handleStop(); }} />}
    </div>
  );
}

/* ══════ SETTINGS SCREEN ══════ */
function SettingsScreen({ onBack, api }) {
  const [device, setDevice] = useState(() => getDeviceIdentity());
  const [pinEnabled, setPinEnabled] = useState(() => localStorage.getItem('dash_pin_enabled') === 'true');
  const [pin, setPin] = useState(() => localStorage.getItem('dash_pin') || '');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [activeTab, setActiveTab] = useState('account');
  const [accountInfo, setAccountInfo] = useState({ status: 'Active', expDate: 'Unlimited', maxConnections: 1, activeCons: 0, username: 'N/A', createdAt: 'N/A', isTrial: false });
  const [vpnEnabled, setVpnEnabled] = useState(() => localStorage.getItem('dash_vpn_enabled') === 'true');
  const [vpnProtocol, setVpnProtocol] = useState(() => localStorage.getItem('dash_vpn_protocol') || 'socks5');
  const [vpnServer, setVpnServer] = useState(() => localStorage.getItem('dash_vpn_server') || '');
  const [vpnPort, setVpnPort] = useState(() => localStorage.getItem('dash_vpn_port') || '');
  const [vpnUsername, setVpnUsername] = useState(() => localStorage.getItem('dash_vpn_username') || '');
  const [vpnPassword, setVpnPassword] = useState(() => localStorage.getItem('dash_vpn_password') || '');
  const [vpnMsg, setVpnMsg] = useState('');

  useEffect(() => {
    if (api) {
      api.authenticate().then(data => {
        if (data && data.user_info) {
          const u = data.user_info;
          const expDate = u.exp_date || 'Unlimited';
          setAccountInfo({
            status: u.status || 'Active',
            expDate: expDate === '' || expDate === '0' ? 'Unlimited' : expDate,
            maxConnections: u.max_connections || 1, activeCons: u.active_cons || 0,
            username: u.username || 'N/A', createdAt: u.created_at || 'N/A',
            isTrial: u.is_trial === '1' || u.is_trial === 1,
          });
        }
      });
    }
  }, [api]);

  const handleSetPin = () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { setPinMsg('PIN must be exactly 4 digits'); return; }
    if (newPin !== confirmPin) { setPinMsg('PINs do not match'); return; }
    localStorage.setItem('dash_pin', newPin);
    localStorage.setItem('dash_pin_enabled', 'true');
    setPin(newPin); setPinEnabled(true); setNewPin(''); setConfirmPin('');
    setPinMsg('PIN set successfully!');
    setTimeout(() => setPinMsg(''), 3000);
  };

  const handleDisablePin = () => {
    localStorage.removeItem('dash_pin');
    localStorage.setItem('dash_pin_enabled', 'false');
    setPin(''); setPinEnabled(false);
    setPinMsg('PIN protection disabled');
    setTimeout(() => setPinMsg(''), 3000);
  };

  const handleVpnSave = async () => {
    localStorage.setItem('dash_vpn_enabled', vpnEnabled.toString());
    localStorage.setItem('dash_vpn_protocol', vpnProtocol);
    localStorage.setItem('dash_vpn_server', vpnServer);
    localStorage.setItem('dash_vpn_port', vpnPort);
    localStorage.setItem('dash_vpn_username', vpnUsername);
    localStorage.setItem('dash_vpn_password', vpnPassword);

    // Apply proxy in Electron
    if (window.dashPlayer?.isElectron && window.dashPlayer?.setProxy) {
      if (vpnEnabled && vpnServer && vpnPort) {
        const proxyProto = vpnProtocol === 'socks5' ? 'socks5' : vpnProtocol === 'http' ? 'http' : 'socks5';
        const result = await window.dashPlayer.setProxy({
          protocol: proxyProto,
          server: vpnServer,
          port: vpnPort,
          username: vpnUsername,
          password: vpnPassword,
        });
        if (result.success) {
          setVpnMsg('VPN proxy connected! All traffic is now routed through ' + vpnServer);
        } else {
          setVpnMsg('Failed to set proxy: ' + (result.error || 'Unknown error'));
        }
      } else if (!vpnEnabled) {
        await window.dashPlayer.clearProxy();
        setVpnMsg('VPN disconnected. Direct connection restored.');
      } else {
        setVpnMsg('VPN settings saved. Enter server and port to connect.');
      }
    } else {
      setVpnMsg('VPN settings saved successfully!');
    }
    setTimeout(() => setVpnMsg(''), 5000);
  };

  const handleResetDeviceKey = () => {
    const newKey = Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
    const newDevice = { ...device, key: newKey };
    localStorage.setItem('dash_device', JSON.stringify(newDevice));
    setDevice(newDevice); setShowResetConfirm(false);
    setResetMsg('Device Key has been reset. You will need to re-activate this device.');
    setTimeout(() => setResetMsg(''), 5000);
  };

  const [currentLang, setCurrentLang] = useState(() => getCurrentLanguage());

  const handleLanguageChange = (lang) => {
    setCurrentLanguage(lang);
    setCurrentLang(lang);
  };

  const tabs = [
    { id: 'account', label: t('account'), icon: '\u{1F464}' },
    { id: 'parental', label: t('parental_control'), icon: '\u{1F512}' },
    { id: 'language', label: t('language'), icon: '\uD83C\uDF0D' },
    { id: 'vpn', label: t('vpn'), icon: '\u{1F6E1}' },
    { id: 'device', label: t('device_info'), icon: '\u{1F4F1}' },
    { id: 'about', label: t('about'), icon: '\u{2139}' },
  ];

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('settings')}</h1>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-categories" style={{ paddingTop: 12 }}>
            {tabs.map(tab => (
              <div key={tab.id} className={`sidebar-cat-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span>{tab.icon} {tab.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="settings-content">
          {activeTab === 'account' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">{t('account_info')}</h3>
                <p className="settings-card-desc">{t('account_info_desc')}</p>
                <div className="settings-account-grid">
                  <div className="settings-account-item">
                    <div className="settings-account-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>&#10003;</div>
                    <div className="settings-account-detail"><span className="settings-account-label">{t('status')}</span><span className="settings-account-value" style={{ color: '#10b981' }}>{accountInfo.status.toUpperCase()}</span></div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128197;</div>
                    <div className="settings-account-detail"><span className="settings-account-label">{t('expires')}</span><span className="settings-account-value">{accountInfo.expDate === 'Unlimited' ? t('unlimited') : accountInfo.expDate}</span></div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128279;</div>
                    <div className="settings-account-detail"><span className="settings-account-label">{t('max_connections')}</span><span className="settings-account-value">{accountInfo.maxConnections}</span></div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128101;</div>
                    <div className="settings-account-detail"><span className="settings-account-label">{t('active')}</span><span className="settings-account-value">{accountInfo.activeCons} / {accountInfo.maxConnections}</span></div>
                  </div>
                </div>
              </div>
              <div className="settings-card">
                <h3 className="settings-card-title">{t('subscription_details')}</h3>
                <div className="settings-device-info">
                  <div className="settings-device-row"><span className="settings-device-label">{t('username')}</span><span className="settings-device-value">{accountInfo.username}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">{t('created')}</span><span className="settings-device-value">{accountInfo.createdAt}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">{t('trial')}</span><span className="settings-device-value">{accountInfo.isTrial ? t('yes') : t('no')}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">{t('user_agent')}</span><span className="settings-device-value">DashPlayer/1.0</span></div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'parental' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">{t('pin_lock')}</h3>
                <p className="settings-card-desc">{t('pin_lock_desc')}</p>
                <div className="settings-status"><span>{t('status')}:</span><span className={`settings-badge ${pinEnabled ? 'active' : 'inactive'}`}>{pinEnabled ? t('enabled') : t('disabled')}</span></div>
                {pinEnabled ? (
                  <div className="settings-pin-section">
                    <p className="settings-pin-info">{t('pin_set')}</p>
                    <div className="settings-pin-row">
                      <input type="password" maxLength={4} placeholder={t('new_pin')} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} className="settings-pin-input" />
                      <input type="password" maxLength={4} placeholder={t('confirm_pin')} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} className="settings-pin-input" />
                      <button className="settings-btn settings-btn-primary" onClick={handleSetPin}>{t('change_pin')}</button>
                    </div>
                    <button className="settings-btn settings-btn-danger" onClick={handleDisablePin}>{t('disable_pin')}</button>
                  </div>
                ) : (
                  <div className="settings-pin-section">
                    <div className="settings-pin-row">
                      <input type="password" maxLength={4} placeholder={t('four_digit_pin')} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} className="settings-pin-input" />
                      <input type="password" maxLength={4} placeholder={t('confirm_pin')} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} className="settings-pin-input" />
                      <button className="settings-btn settings-btn-primary" onClick={handleSetPin}>{t('set_pin')}</button>
                    </div>
                  </div>
                )}
                {pinMsg && <p className={`settings-msg ${pinMsg.includes('successfully') ? 'success' : pinMsg.includes('disabled') ? 'info' : 'error'}`}>{pinMsg}</p>}
              </div>
            </div>
          )}
          {activeTab === 'language' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">{t('language')}</h3>
                <p className="settings-card-desc">{t('lang_desc')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  {[
                    { code: 'en', label: 'English', native: 'English' },
                    { code: 'nl', label: 'Dutch', native: 'Nederlands' },
                    { code: 'tr', label: 'Turkish', native: 'Turkce' },
                  ].map(lang => (
                    <div
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 18px', borderRadius: 10, cursor: 'pointer',
                        background: currentLang === lang.code ? 'rgba(139,92,246,0.15)' : 'var(--card-bg)',
                        border: currentLang === lang.code ? '2px solid #8b5cf6' : '2px solid var(--border)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{lang.code === 'en' ? '\uD83C\uDDEC\uD83C\uDDE7' : lang.code === 'nl' ? '\uD83C\uDDF3\uD83C\uDDF1' : '\uD83C\uDDF9\uD83C\uDDF7'}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{lang.native}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{lang.label}</div>
                      </div>
                      {currentLang === lang.code && (
                        <span style={{ marginLeft: 'auto', color: '#8b5cf6', fontSize: 18 }}>&#10003;</span>
                      )}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>{t('lang_apply')}</p>
              </div>
            </div>
          )}
          {activeTab === 'vpn' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">{t('vpn_config')}</h3>
                <p className="settings-card-desc">{t('vpn_config_desc')}</p>
                <div className="settings-status">
                  <span>{t('vpn_status')}:</span>
                  <span className={`settings-badge ${vpnEnabled ? 'active' : 'inactive'}`}>
                    {vpnEnabled ? t('enabled') : t('disabled')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t('enable_vpn')}</span>
                  <button
                    className={`settings-btn ${vpnEnabled ? 'settings-btn-danger' : 'settings-btn-primary'}`}
                    onClick={async () => {
                      const newVal = !vpnEnabled;
                      setVpnEnabled(newVal);
                      localStorage.setItem('dash_vpn_enabled', newVal.toString());
                      if (window.dashPlayer?.isElectron && window.dashPlayer?.setProxy) {
                        if (newVal && vpnServer && vpnPort) {
                          const proxyProto = vpnProtocol === 'socks5' ? 'socks5' : vpnProtocol === 'http' ? 'http' : 'socks5';
                          await window.dashPlayer.setProxy({ protocol: proxyProto, server: vpnServer, port: vpnPort, username: vpnUsername, password: vpnPassword });
                          setVpnMsg('VPN proxy connected!');
                        } else if (!newVal) {
                          await window.dashPlayer.clearProxy();
                          setVpnMsg('VPN disconnected.');
                        }
                        setTimeout(() => setVpnMsg(''), 3000);
                      }
                    }}
                  >
                    {vpnEnabled ? t('disable') : t('enable')}
                  </button>
                </div>
              </div>
              <div className="settings-card">
                <h3 className="settings-card-title">{t('protocol_server')}</h3>
                <p className="settings-card-desc">{t('protocol_server_desc')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>{t('protocol')}</label>
                    <select
                      value={vpnProtocol}
                      onChange={e => setVpnProtocol(e.target.value)}
                      className="header-sort-select"
                      style={{ width: '100%', padding: '10px 14px', fontSize: 13 }}
                    >
                      <option value="socks5">SOCKS5 Proxy</option>
                      <option value="http">HTTP/HTTPS Proxy</option>
                    </select>
                  </div>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>{t('server_address')}</label>
                    <input
                      type="text"
                      placeholder="e.g., vpn.example.com"
                      value={vpnServer}
                      onChange={e => setVpnServer(e.target.value)}
                      className="quick-connect-input"
                    />
                  </div>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>{t('port')}</label>
                    <input
                      type="text"
                      placeholder="e.g., 1194"
                      value={vpnPort}
                      onChange={e => setVpnPort(e.target.value)}
                      className="quick-connect-input"
                      style={{ width: 150 }}
                    />
                  </div>
                </div>
              </div>
              <div className="settings-card">
                <h3 className="settings-card-title">{t('authentication')}</h3>
                <p className="settings-card-desc">{t('auth_desc')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>{t('username')}</label>
                    <input
                      type="text"
                      placeholder="VPN username"
                      value={vpnUsername}
                      onChange={e => setVpnUsername(e.target.value)}
                      className="quick-connect-input"
                    />
                  </div>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>{t('password_label')}</label>
                    <input
                      type="password"
                      placeholder="VPN password"
                      value={vpnPassword}
                      onChange={e => setVpnPassword(e.target.value)}
                      className="quick-connect-input"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button className="settings-btn settings-btn-primary" onClick={handleVpnSave}>{t('save_vpn')}</button>
                </div>
                {vpnMsg && <p className="settings-msg success">{vpnMsg}</p>}
              </div>
            </div>
          )}
          {activeTab === 'device' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">{t('device_information')}</h3>
                <div className="settings-device-info">
                  <div className="settings-device-row">
                    <span className="settings-device-label">{t('mac_address')}</span>
                    <span className="settings-device-value settings-device-copyable" onClick={() => { navigator.clipboard.writeText(device.mac); setCopyMsg('MAC copied!'); setTimeout(() => setCopyMsg(''), 2000); }}>
                      {device.mac} <span className="settings-copy-icon">&#128203;</span>
                    </span>
                  </div>
                  <div className="settings-device-row">
                    <span className="settings-device-label">{t('device_key')}</span>
                    <span className="settings-device-value settings-device-copyable" onClick={() => { navigator.clipboard.writeText(device.key); setCopyMsg('Key copied!'); setTimeout(() => setCopyMsg(''), 2000); }}>
                      {device.key} <span className="settings-copy-icon">&#128203;</span>
                    </span>
                  </div>
                  <div className="settings-device-row"><span className="settings-device-label">{t('app_version')}</span><span className="settings-device-value">2.0.0</span></div>
                </div>
                {copyMsg && <p className="settings-msg success" style={{ marginTop: 8 }}>{copyMsg}</p>}
              </div>
              <div className="settings-card">
                <h3 className="settings-card-title">{t('reset_device_key')}</h3>
                <p className="settings-card-desc">{t('reset_desc')}</p>
                {!showResetConfirm ? (
                  <button className="settings-btn settings-btn-danger" onClick={() => setShowResetConfirm(true)}>{t('reset_device_key')}</button>
                ) : (
                  <div className="settings-confirm-box">
                    <p className="settings-confirm-text">{t('reset_confirm')}</p>
                    <div className="settings-confirm-btns">
                      <button className="settings-btn settings-btn-danger" onClick={handleResetDeviceKey}>{t('yes_reset')}</button>
                      <button className="settings-btn settings-btn-secondary" onClick={() => setShowResetConfirm(false)}>{t('cancel')}</button>
                    </div>
                  </div>
                )}
                {resetMsg && <p className="settings-msg info">{resetMsg}</p>}
              </div>
            </div>
          )}
          {activeTab === 'about' && (
            <div className="settings-panel">
              <div className="settings-card" style={{ textAlign: 'center' }}>
                <div className="settings-about-logo">D</div>
                <h2 className="settings-about-name">Dash Player</h2>
                <p className="settings-about-version">{t('version')} 2.0.0</p>
                <p className="settings-card-desc" style={{ marginTop: 16 }}>Multi-platform IPTV player. {t('live_tv')}, {t('movies')}, {t('series')}, {t('radio')}, EPG, {t('catch_up')}, {t('multi_screen')}.</p>
                <div className="settings-about-links"><span>{t('support')}: dashplayer.eu</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════ PLAYLISTS SCREEN ══════ */
function PlaylistsScreen({ onBack, onSwitch, activePlaylist }) {
  const [playlists, setPlaylists] = useState(() => getPlaylists());

  // On mount, fetch and merge backend playlists
  useEffect(() => {
    fetchPlaylistsFromBackend().then(merged => {
      if (merged) setPlaylists(merged);
    });
  }, []);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [m3uInput, setM3uInput] = useState('');
  const [outputFormat, setOutputFormat] = useState('m3u8');
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pinPrompt, setPinPrompt] = useState(null); // { playlistId, pin, error }
  const [pinSetup, setPinSetup] = useState(null); // { playlistId, pin }

  const parseM3uUrl = (url) => {
    try {
      const u = new URL(url);
      const user = u.searchParams.get('username');
      const pass = u.searchParams.get('password');
      if (user && pass) return { url: `${u.protocol}//${u.host}`, username: user, password: pass };
    } catch {}
    return null;
  };

  const handleM3uPaste = (val) => {
    setM3uInput(val);
    const parsed = parseM3uUrl(val.trim());
    if (parsed) {
      setServerUrl(parsed.url);
      setUsername(parsed.username);
      setPassword(parsed.password);
    }
  };

  const resetForm = () => {
    setName(''); setServerUrl(''); setUsername(''); setPassword(''); setM3uInput(''); setOutputFormat('m3u8');
    setShowAdd(false); setEditId(null);
  };

  const handleSave = () => {
    if (!serverUrl || !username || !password) {
      setMsg('Server URL, username, and password are required');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    let updated;
    if (editId !== null) {
      updated = playlists.map(p => p.id === editId ? { ...p, name: name || 'My Playlist', server_url: serverUrl, username, password, output_format: outputFormat } : p);
    } else {
      const newId = Date.now();
      const isDefault = playlists.length === 0 ? true : false;
      updated = [...playlists, { id: newId, name: name || 'My Playlist', server_url: serverUrl, username, password, output_format: outputFormat, is_default: isDefault }];
    }
    savePlaylists(updated);
    setPlaylists(updated);
    resetForm();
    setMsg(editId !== null ? 'Playlist updated!' : 'Playlist added!');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleEdit = (pl) => {
    setEditId(pl.id);
    setName(pl.name);
    setServerUrl(pl.server_url);
    setUsername(pl.username);
    setPassword(pl.password);
    setOutputFormat(pl.output_format || 'm3u8');
    setShowAdd(true);
  };

  const handleDelete = (id) => {
    let updated = playlists.filter(p => p.id !== id);
    if (updated.length > 0 && !updated.find(p => p.is_default)) {
      updated[0].is_default = true;
    }
    savePlaylists(updated);
    setPlaylists(updated);
    setConfirmDelete(null);
    setMsg('Playlist deleted');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSetDefault = (id) => {
    const updated = playlists.map(p => ({ ...p, is_default: p.id === id }));
    savePlaylists(updated);
    setPlaylists(updated);
    const pl = updated.find(p => p.id === id);
    if (pl && onSwitch) onSwitch({ url: pl.server_url, username: pl.username, password: pl.password, output_format: pl.output_format || 'm3u8' });
    setMsg('Default playlist changed');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSwitchTo = (pl) => {
    if (pl.pin) {
      setPinPrompt({ playlistId: pl.id, pin: '', error: '' });
    } else {
      // Also set as default when switching
      const updated = playlists.map(p => ({ ...p, is_default: p.id === pl.id }));
      savePlaylists(updated);
      setPlaylists(updated);
      if (onSwitch) onSwitch({ url: pl.server_url, username: pl.username, password: pl.password, output_format: pl.output_format || 'm3u8' });
    }
  };

  const handlePinSubmit = () => {
    if (!pinPrompt) return;
    const pl = playlists.find(p => p.id === pinPrompt.playlistId);
    if (!pl) return;
    if (pinPrompt.pin === pl.pin) {
      setPinPrompt(null);
      // Also set as default when switching via PIN
      const updated = playlists.map(p => ({ ...p, is_default: p.id === pl.id }));
      savePlaylists(updated);
      setPlaylists(updated);
      if (onSwitch) onSwitch({ url: pl.server_url, username: pl.username, password: pl.password, output_format: pl.output_format || 'm3u8' });
    } else {
      setPinPrompt({ ...pinPrompt, error: 'Incorrect PIN. Please try again.' });
    }
  };

  const handleSetPin = (playlistId) => {
    setPinSetup({ playlistId, pin: '' });
  };

  const handleSavePin = () => {
    if (!pinSetup || pinSetup.pin.length !== 4) {
      return;
    }
    const updated = playlists.map(p => p.id === pinSetup.playlistId ? { ...p, pin: pinSetup.pin } : p);
    savePlaylists(updated);
    setPlaylists(updated);
    setPinSetup(null);
    setMsg('PIN set successfully');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleRemovePin = (playlistId) => {
    const updated = playlists.map(p => p.id === playlistId ? { ...p, pin: '' } : p);
    savePlaylists(updated);
    setPlaylists(updated);
    setMsg('PIN removed');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('playlists')}</h1>
        <button className="settings-btn settings-btn-secondary" onClick={async () => {
          const merged = await fetchPlaylistsFromBackend();
          if (merged) setPlaylists(merged);
        }} style={{ marginLeft: 'auto' }}>
          {t('refresh')}
        </button>
        <button className="settings-btn settings-btn-primary" onClick={() => { resetForm(); setShowAdd(true); }} style={{ marginLeft: 8 }}>
          + {t('add_playlist')}
        </button>
      </div>
      <div className="playlists-content" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
        {msg && <div className="settings-msg success" style={{ marginBottom: 16 }}>{msg}</div>}

        {showAdd && (
          <div className="settings-card" style={{ marginBottom: 20 }}>
            <h3 className="settings-card-title">{editId !== null ? 'Edit Playlist' : 'Add New Playlist'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Paste M3U URL (optional)</label>
                <input className="quick-connect-input" placeholder="http://server:port/get.php?username=...&password=..." value={m3uInput} onChange={e => handleM3uPaste(e.target.value)} />
              </div>
              <div>
                <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Playlist Name</label>
                <input className="quick-connect-input" placeholder="My Playlist" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Server URL</label>
                <input className="quick-connect-input" placeholder="http://server:port" value={serverUrl} onChange={e => setServerUrl(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Username</label>
                  <input className="quick-connect-input" placeholder="username" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Password</label>
                  <input className="quick-connect-input" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Output Format</label>
                <select className="quick-connect-input" value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={{cursor:'pointer'}}>
                  <option value="m3u8">HLS (M3U8)</option>
                  <option value="ts">MPEG-TS</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="settings-btn settings-btn-primary" onClick={handleSave}>{editId !== null ? 'Update' : 'Add Playlist'}</button>
                <button className="settings-btn settings-btn-secondary" onClick={resetForm}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {playlists.length === 0 && !showAdd && (
          <div className="settings-card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128220;</div>
            <h3 className="settings-card-title">No Playlists Yet</h3>
            <p className="settings-card-desc">Add your first IPTV playlist to get started.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {playlists.map(pl => {
            const isActive = activePlaylist && activePlaylist.url === pl.server_url && activePlaylist.username === pl.username;
            const isProtected = !!pl.pin;
            return (
              <div key={pl.id} className="settings-card" style={{ position: 'relative', border: pl.is_default ? '2px solid #8b5cf6' : undefined }}>
                {pl.is_default && (
                  <span style={{ position: 'absolute', top: 10, right: 12, background: '#8b5cf6', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>DEFAULT</span>
                )}
                {isActive && !pl.is_default && (
                  <span style={{ position: 'absolute', top: 10, right: 12, background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>ACTIVE</span>
                )}
                {isProtected && (
                  <span style={{ position: 'absolute', top: pl.is_default || (isActive && !pl.is_default) ? 34 : 10, right: 12, background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>&#128274; Protected</span>
                )}
                <h3 className="settings-card-title" style={{ marginBottom: 8 }}>{isProtected ? '🔒 ' : ''}{pl.name || 'My Playlist'}</h3>
                <div className="settings-device-info" style={{ marginBottom: 12 }}>
                  <div className="settings-device-row"><span className="settings-device-label">Server</span><span className="settings-device-value" style={{ wordBreak: 'break-all' }}>{pl.server_url}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">Username</span><span className="settings-device-value">{isProtected ? '*****' : pl.username}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">Format</span><span className="settings-device-value">{(pl.output_format || 'm3u8') === 'ts' ? 'MPEG-TS' : 'HLS (M3U8)'}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!isActive && (
                    <button className="settings-btn settings-btn-primary" onClick={() => handleSwitchTo(pl)} style={{ fontSize: 12 }}>Switch To</button>
                  )}
                  {!pl.is_default && (
                    <button className="settings-btn settings-btn-secondary" onClick={() => handleSetDefault(pl.id)} style={{ fontSize: 12 }}>Set Default</button>
                  )}
                  <button className="settings-btn settings-btn-secondary" onClick={() => handleEdit(pl)} style={{ fontSize: 12 }}>Edit</button>
                  {isProtected ? (
                    <button className="settings-btn settings-btn-secondary" onClick={() => handleRemovePin(pl.id)} style={{ fontSize: 12 }}>Remove PIN</button>
                  ) : (
                    <button className="settings-btn settings-btn-secondary" onClick={() => handleSetPin(pl.id)} style={{ fontSize: 12 }}>Set PIN</button>
                  )}
                  {confirmDelete === pl.id ? (
                    <>
                      <button className="settings-btn settings-btn-danger" onClick={() => handleDelete(pl.id)} style={{ fontSize: 12 }}>Confirm</button>
                      <button className="settings-btn settings-btn-secondary" onClick={() => setConfirmDelete(null)} style={{ fontSize: 12 }}>Cancel</button>
                    </>
                  ) : (
                    <button className="settings-btn settings-btn-danger" onClick={() => setConfirmDelete(pl.id)} style={{ fontSize: 12 }}>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIN Setup Dialog */}
      {pinSetup && (
        <div className="pin-overlay" onClick={() => setPinSetup(null)}>
          <div className="pin-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>&#128274;</div>
            <h3 style={{ marginBottom: 8, color: 'var(--text)' }}>Set PIN</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20 }}>Enter a 4-digit PIN to protect this playlist</p>
            <input
              className="pin-input"
              type="tel"
              maxLength={4}
              placeholder="0000"
              value={pinSetup.pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPinSetup({ ...pinSetup, pin: val });
              }}
              onKeyDown={e => { if (e.key === 'Enter' && pinSetup.pin.length === 4) handleSavePin(); }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="settings-btn settings-btn-primary" onClick={handleSavePin} disabled={pinSetup.pin.length !== 4}>Save PIN</button>
              <button className="settings-btn settings-btn-secondary" onClick={() => setPinSetup(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Prompt Dialog */}
      {pinPrompt && (
        <div className="pin-overlay" onClick={() => setPinPrompt(null)}>
          <div className="pin-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>&#128274;</div>
            <h3 style={{ marginBottom: 8, color: 'var(--text)' }}>Enter PIN</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20 }}>This playlist is PIN protected</p>
            <input
              className="pin-input"
              type="tel"
              maxLength={4}
              placeholder="0000"
              value={pinPrompt.pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPinPrompt({ ...pinPrompt, pin: val, error: '' });
              }}
              onKeyDown={e => { if (e.key === 'Enter' && pinPrompt.pin.length === 4) handlePinSubmit(); }}
              autoFocus
            />
            {pinPrompt.error && <div className="pin-error">{pinPrompt.error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="settings-btn settings-btn-primary" onClick={handlePinSubmit} disabled={pinPrompt.pin.length !== 4}>Unlock</button>
              <button className="settings-btn settings-btn-secondary" onClick={() => setPinPrompt(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════ SPEED TEST SCREEN ══════ */
function SpeedTestScreen({ onBack }) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [ipInfo, setIpInfo] = useState(null);
  const [ipLoading, setIpLoading] = useState(true);

  const vpnEnabled = localStorage.getItem('dash_vpn_enabled') === 'true';
  const vpnServer = localStorage.getItem('dash_vpn_server') || '';

  // Fetch IP info on mount and when refreshed
  const fetchIpInfo = useCallback(() => {
    setIpLoading(true);
    setIpInfo(null);
    fetch('https://ipinfo.io/json?token=', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { setIpInfo(data); setIpLoading(false); })
      .catch(() => {
        fetch('https://ipapi.co/json/', { cache: 'no-store' })
          .then(r => r.json())
          .then(data => { setIpInfo({ ip: data.ip, hostname: data.org, city: data.city, region: data.region, country: data.country_name, org: data.org }); setIpLoading(false); })
          .catch(() => setIpLoading(false));
      });
  }, []);

  useEffect(() => { fetchIpInfo(); }, []);

  const runSpeedTest = async () => {
    setTesting(true); setResults(null); setProgress(0); setError('');
    try {
      // Ping test
      const pingStart = performance.now();
      await fetch('https://speed.cloudflare.com/__down?bytes=1000', { cache: 'no-store' });
      const ping = Math.round(performance.now() - pingStart);
      setProgress(20);

      // Download test (10MB)
      const dlStart = performance.now();
      const response = await fetch('https://speed.cloudflare.com/__down?bytes=10000000', { cache: 'no-store' });
      const reader = response.body.getReader();
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        setProgress(20 + Math.round((received / 10000000) * 70));
      }
      const dlTime = (performance.now() - dlStart) / 1000;
      const dlSpeed = ((received * 8) / dlTime / 1000000).toFixed(2);
      setProgress(100);

      setResults({ ping, download: dlSpeed, bytes: received });
    } catch (e) {
      setError('Speed test failed: ' + e.message);
    }
    setTesting(false);
  };

  const formatBytes = (bytes) => {
    if (bytes >= 1000000) return (bytes / 1000000).toFixed(1) + ' MB';
    if (bytes >= 1000) return (bytes / 1000).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('speed_test')}</h1>
      </div>
      <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, overflowY: 'auto', flex: 1 }}>
        {/* Gauge area */}
        <div className="speedtest-gauge">
          <svg viewBox="0 0 200 120" width="280" height="168">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="12" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 251.3} 251.3`} style={{ transition: 'stroke-dasharray 0.3s ease' }} />
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="speedtest-gauge-value">
            {testing ? `${progress}%` : results ? `${results.download}` : '0'}
          </div>
          <div className="speedtest-gauge-unit">
            {testing ? t('testing') : results ? 'Mbps' : 'Mbps'}
          </div>
        </div>

        {/* Start button */}
        {!testing && !results && (
          <button className="settings-btn settings-btn-primary speedtest-start-btn" onClick={runSpeedTest}>
            &#128640; {t('start_test')}
          </button>
        )}

        {/* Progress animation */}
        {testing && (
          <div className="speedtest-progress-bar">
            <div className="speedtest-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Error */}
        {error && <div className="settings-msg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

        {/* Results */}
        {results && (
          <div className="speedtest-results">
            <div className="speedtest-result-card">
              <div className="speedtest-result-icon">&#128640;</div>
              <div className="speedtest-result-value">{results.download}</div>
              <div className="speedtest-result-label">{t('download')} (Mbps)</div>
            </div>
            <div className="speedtest-result-card">
              <div className="speedtest-result-icon">&#9201;</div>
              <div className="speedtest-result-value">{results.ping}</div>
              <div className="speedtest-result-label">{t('ping')} (ms)</div>
            </div>
            <div className="speedtest-result-card">
              <div className="speedtest-result-icon">&#128230;</div>
              <div className="speedtest-result-value">{formatBytes(results.bytes)}</div>
              <div className="speedtest-result-label">{t('data_downloaded')}</div>
            </div>
            <div className="speedtest-result-card">
              <div className="speedtest-result-icon">&#9989;</div>
              <div className="speedtest-result-value" style={{ color: '#10b981' }}>{t('connected')}</div>
              <div className="speedtest-result-label">{t('status')}</div>
            </div>
          </div>
        )}

        {/* Retest */}
        {results && (
          <button className="settings-btn settings-btn-secondary" onClick={runSpeedTest}>
            &#128260; {t('test_again')}
          </button>
        )}

        {/* Connection Info */}
        <div className="speedtest-connection-info">
          <div className="speedtest-info-row" style={{ borderBottom: '1px solid rgba(200,180,220,0.15)', paddingBottom: 10 }}>
            <span className="speedtest-info-label">{t('vpn_status')}</span>
            <span className={`settings-badge ${vpnEnabled ? 'active' : 'inactive'}`}>
              {vpnEnabled ? t('enabled') : t('disabled')}
            </span>
          </div>
          {vpnEnabled && vpnServer && (
            <div className="speedtest-info-row">
              <span className="speedtest-info-label">{t('vpn_server')}</span>
              <span className="speedtest-info-value">{vpnServer}</span>
            </div>
          )}
          <div className="speedtest-info-row">
            <span className="speedtest-info-label">{vpnEnabled ? t('vpn_ip') : t('your_ip')}</span>
            <span className="speedtest-info-value">{ipLoading ? t('checking') : ipInfo ? ipInfo.ip : t('unknown')}</span>
          </div>
          {ipInfo && (ipInfo.hostname || ipInfo.org) && (
            <div className="speedtest-info-row">
              <span className="speedtest-info-label">{t('hostname_isp')}</span>
              <span className="speedtest-info-value">{ipInfo.hostname || ipInfo.org || 'N/A'}</span>
            </div>
          )}
          {ipInfo && (
            <div className="speedtest-info-row">
              <span className="speedtest-info-label">{t('location')}</span>
              <span className="speedtest-info-value">{[ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(', ')}</span>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button className="settings-btn settings-btn-secondary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={fetchIpInfo}>
              &#128260; {t('refresh_ip')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════ EXPIRED SCREEN ══════ */
function ExpiredScreen({ licenseType }) {
  const [device] = useState(() => getDeviceIdentity());
  const panelUrl = 'https://dashplayer.eu';
  const isTrial = licenseType === 'trial';
  const activateUrl = `${panelUrl}/#activate?mac=${encodeURIComponent(device.mac)}&key=${encodeURIComponent(device.key)}`;
  return (
    <div className="activation-screen">
      <div className="activation-container">
        <div className="activation-info">
          <div className="activation-info-inner">
            <div className="trial-expired-icon">&#9888;</div>
            <h2 className="trial-expired-title">{isTrial ? 'Your Trial Has Ended' : 'License Expired'}</h2>
            <p className="trial-expired-desc">{isTrial ? 'Your free trial period has expired. Please activate your device.' : 'Your license has expired. Please renew to continue using the player.'}</p>
            <a href={activateUrl} className="activation-url">{panelUrl}</a>
            <div className="activation-field">
              <label className="activation-label">Mac Address</label>
              <div className="activation-value-row"><span className="activation-value">{device.mac}</span></div>
            </div>
            <div className="activation-field">
              <label className="activation-label">Device Key</label>
              <div className="activation-value-row"><span className="activation-value">{device.key}</span></div>
            </div>
          </div>
        </div>
        <div className="activation-brand">
          <div className="activation-logo">D</div>
          <div className="activation-app-name">Dash Player</div>
          <p className="activation-qr-text">Scan to {isTrial ? 'activate' : 'renew'}</p>
          <QRCodeSVG value={activateUrl} size={180} fgColor="#8b5cf6" bgColor="#ffffff" level="M" />
        </div>
      </div>
    </div>
  );
}

/* ══════ FAVORITES SCREEN ══════ */
function FavoritesScreen({ onBack, api, onNavigate }) {
  const [activeTab, setActiveTab] = useState('live');
  const [playingItem, setPlayingItem] = useState(null);
  const [groups, setGroups] = useState(() => getCustomGroups());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editGroupId, setEditGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null);
  const [groupPlayerMode, setGroupPlayerMode] = useState(null); // { group, playingChannel }
  const [groupEpg, setGroupEpg] = useState([]);
  const [showGroupEpgOverlay, setShowGroupEpgOverlay] = useState(false);
  const [liveChannels, setLiveChannels] = useState([]);
  const [vodItems, setVodItems] = useState([]);
  const [seriesItems, setSeriesItems] = useState([]);
  const [loadedFavs, setLoadedFavs] = useState(false);
  const history = getWatchHistory();

  const liveFavs = getFavorites('live');
  const vodFavs = getFavorites('vod');
  const seriesFavs = getFavorites('series');

  // Load favorite items from API
  useEffect(() => {
    if (!api || loadedFavs) return;
    const load = async () => {
      if (liveFavs.length > 0) {
        const all = await api.getLiveStreams();
        if (all && Array.isArray(all)) setLiveChannels(all.filter(ch => liveFavs.includes(ch.stream_id || ch.num)));
      }
      if (vodFavs.length > 0) {
        const all = await api.getVodStreams();
        if (all && Array.isArray(all)) setVodItems(all.filter(v => vodFavs.includes(v.stream_id || v.num)));
      }
      if (seriesFavs.length > 0) {
        const all = await api.getSeries();
        if (all && Array.isArray(all)) setSeriesItems(all.filter(s => seriesFavs.includes(s.series_id)));
      }
      setLoadedFavs(true);
    };
    load();
  }, [api, loadedFavs]);

  const tabs = [
    { id: 'live', label: t('live_tv'), icon: '\u{1F4FA}' },
    { id: 'vod', label: t('movies'), icon: '\u{1F3AC}' },
    { id: 'series', label: t('series'), icon: '\u{1F3A5}' },
    { id: 'history', label: t('recently_watched'), icon: '\u{1F554}' },
    { id: 'groups', label: t('custom_groups'), icon: '\u{1F4C1}' },
  ];

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup = { id: Date.now(), name: newGroupName.trim(), channels: [] };
    const updated = [...groups, newGroup];
    saveCustomGroups(updated);
    setGroups(updated);
    setNewGroupName('');
    setShowCreateGroup(false);
  };

  const handleRenameGroup = (id) => {
    if (!editGroupName.trim()) return;
    const updated = groups.map(g => g.id === id ? { ...g, name: editGroupName.trim() } : g);
    saveCustomGroups(updated);
    setGroups(updated);
    setEditGroupId(null);
    setEditGroupName('');
  };

  const handleDeleteGroup = (id) => {
    const updated = groups.filter(g => g.id !== id);
    saveCustomGroups(updated);
    setGroups(updated);
    setConfirmDeleteGroup(null);
  };

  const handleRemoveFromGroup = (groupId, channelId) => {
    const updated = groups.map(g => g.id === groupId ? { ...g, channels: g.channels.filter(c => c.id !== channelId) } : g);
    saveCustomGroups(updated);
    setGroups(updated);
  };

  const handleAddToGroup = (groupId, channel) => {
    const updated = groups.map(g => {
      if (g.id !== groupId) return g;
      if (g.channels.find(c => c.id === channel.id)) return g;
      return { ...g, channels: [...g.channels, channel] };
    });
    saveCustomGroups(updated);
    setGroups(updated);
  };

  const [moveTarget, setMoveTarget] = useState(null); // { item, type }

  // Fetch EPG for group player mode
  useEffect(() => {
    if (!groupPlayerMode?.playingChannel || !api) { setGroupEpg([]); return; }
    const ch = groupPlayerMode.playingChannel;
    if (ch.type !== 'live') return;
    let cancelled = false;
    api.getEPG(ch.id).then(data => {
      if (cancelled) return;
      if (data && data.epg_listings && Array.isArray(data.epg_listings)) {
        setGroupEpg(data.epg_listings.map(e => ({
          id: e.id, title: b64decode(e.title || ''), description: b64decode(e.description || ''),
          start: e.start, end: e.end,
        })));
      } else { setGroupEpg([]); }
    }).catch(() => setGroupEpg([]));
    return () => { cancelled = true; };
  }, [groupPlayerMode?.playingChannel, api]);

  const handleGroupPlay = (group, channel) => {
    setGroupPlayerMode({ group, playingChannel: channel });
    addToHistory({ id: channel.id, name: channel.name, type: channel.type, streamId: channel.id, icon: channel.icon });
  };

  const renderFavList = (items, type) => {
    if (items.length === 0) return (
      <div className="epg-empty">
        <div style={{ fontSize: 48 }}>{type === 'live' ? '\u{1F4FA}' : type === 'vod' ? '\u{1F3AC}' : '\u{1F3A5}'}</div>
        <p>No {type === 'live' ? 'channel' : type === 'vod' ? 'movie' : 'series'} favorites yet</p>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 8 }}>{type === 'live' ? t('live_tv') : type === 'vod' ? t('movies') : t('series')}</p>
      </div>
    );
    return (
      <div className="history-list">
        {items.map(item => {
          const itemId = type === 'series' ? item.series_id : (item.stream_id || item.num);
          const itemName = item.name || item.title || 'Unknown';
          const icon = item.stream_icon || item.cover || '';
          return (
            <div key={itemId} className="history-item">
              {icon ? <img className="history-icon" src={icon} alt="" onError={e => e.target.style.display='none'} /> : <div className="history-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{type === 'live' ? '\u{1F4FA}' : '\u{1F3AC}'}</div>}
              <div className="history-info" onClick={() => {
                if (type === 'live' && api) { setPlayingItem({ url: api.getLiveUrl(itemId), name: itemName }); addToHistory({ id: itemId, name: itemName, icon, type: 'live', streamId: itemId }); }
                else if (type === 'vod' && api) { setPlayingItem({ url: api.getVodUrl(itemId), name: itemName }); addToHistory({ id: itemId, name: itemName, icon, type: 'vod', streamId: itemId }); }
              }} style={{ cursor: 'pointer', flex: 1 }}>
                <div className="history-name">{itemName}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {groups.length > 0 && (
                  moveTarget && moveTarget.id === itemId ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {groups.map(g => (
                        <button key={g.id} className="settings-btn settings-btn-secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => { handleAddToGroup(g.id, { id: itemId, name: itemName, icon, type }); setMoveTarget(null); }}>{g.name}</button>
                      ))}
                      <button className="settings-btn settings-btn-secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setMoveTarget(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="settings-btn settings-btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setMoveTarget({ id: itemId, name: itemName, icon, type })} title="Add to group">{'\u{1F4C1}'}</button>
                  )
                )}
                <button className="settings-btn settings-btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => { toggleFavorite(type, itemId); setLoadedFavs(false); }} title="Remove">&times;</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('favorites')}</h1>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-categories" style={{ paddingTop: 12 }}>
            {tabs.map(tab => (
              <div key={tab.id} className={`sidebar-cat-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span>{tab.icon} {tab.label}</span>
                <span className="sidebar-cat-count">
                  {tab.id === 'live' ? liveFavs.length : tab.id === 'vod' ? vodFavs.length : tab.id === 'series' ? seriesFavs.length : tab.id === 'history' ? history.length : groups.length}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="favorites-content" style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {activeTab === 'live' && renderFavList(liveChannels, 'live')}
          {activeTab === 'vod' && renderFavList(vodItems, 'vod')}
          {activeTab === 'series' && renderFavList(seriesItems, 'series')}
          {activeTab === 'history' && (
            history.length === 0 ? (
              <div className="epg-empty"><div style={{ fontSize: 48 }}>{'\u{1F554}'}</div><p>{t('no_history')}</p></div>
            ) : (
              <div className="history-list">
                {history.map(item => (
                  <div key={item.id} className="history-item" onClick={() => {
                    if (item.type === 'live' && api) setPlayingItem({ url: api.getLiveUrl(item.streamId), name: item.name });
                    else if (item.type === 'vod' && api) setPlayingItem({ url: api.getVodUrl(item.streamId), name: item.name });
                  }}>
                    {item.icon ? <img className="history-icon" src={item.icon} alt="" onError={e => e.target.style.display='none'} /> : null}
                    <div className="history-info"><div className="history-name">{item.name}</div><div className="history-meta">{item.type === 'live' ? t('live_tv') : item.type === 'vod' ? t('movie') : t('series')} - {new Date(item.watchedAt).toLocaleDateString()}</div></div>
                    <span className="ep-play">&#9654;</span>
                  </div>
                ))}
              </div>
            )
          )}
          {activeTab === 'groups' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t('custom_groups')}</h3>
                <button className="settings-btn settings-btn-primary" onClick={() => setShowCreateGroup(true)} style={{ fontSize: 12 }}>{t('new_group')}</button>
              </div>
              {showCreateGroup && (
                <div className="settings-card" style={{ marginBottom: 16, padding: 16 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input className="quick-connect-input" placeholder={t('group_name')} value={newGroupName} onChange={e => setNewGroupName(e.target.value)} style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} />
                    <button className="settings-btn settings-btn-primary" onClick={handleCreateGroup} style={{ fontSize: 12 }}>{t('create')}</button>
                    <button className="settings-btn settings-btn-secondary" onClick={() => { setShowCreateGroup(false); setNewGroupName(''); }} style={{ fontSize: 12 }}>{t('cancel')}</button>
                  </div>
                </div>
              )}
              {groups.length === 0 && !showCreateGroup && (
                <div className="epg-empty">
                  <div style={{ fontSize: 48 }}>{'\u{1F4C1}'}</div>
                  <p>{t('no_groups_yet')}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 8 }}>{t('no_groups_desc')}</p>
                </div>
              )}
              {groups.map(group => (
                <div key={group.id} className="settings-card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    {editGroupId === group.id ? (
                      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                        <input className="quick-connect-input" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleRenameGroup(group.id)} />
                        <button className="settings-btn settings-btn-primary" onClick={() => handleRenameGroup(group.id)} style={{ fontSize: 11 }}>{t('save')}</button>
                        <button className="settings-btn settings-btn-secondary" onClick={() => setEditGroupId(null)} style={{ fontSize: 11 }}>{t('cancel')}</button>
                      </div>
                    ) : (
                      <>
                        <h3 className="settings-card-title" style={{ margin: 0 }}>{'\u{1F4C1}'} {group.name} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>({group.channels.length})</span></h3>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="settings-btn settings-btn-secondary" onClick={() => { setEditGroupId(group.id); setEditGroupName(group.name); }} style={{ fontSize: 11 }}>{t('rename')}</button>
                          {confirmDeleteGroup === group.id ? (
                            <>
                              <button className="settings-btn settings-btn-danger" onClick={() => handleDeleteGroup(group.id)} style={{ fontSize: 11 }}>{t('confirm_delete')}</button>
                              <button className="settings-btn settings-btn-secondary" onClick={() => setConfirmDeleteGroup(null)} style={{ fontSize: 11 }}>{t('cancel')}</button>
                            </>
                          ) : (
                            <button className="settings-btn settings-btn-danger" onClick={() => setConfirmDeleteGroup(group.id)} style={{ fontSize: 11 }}>{t('delete')}</button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {group.channels.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>{t('live_tv')}, {t('movies')}, {t('series')}</p>
                  ) : (
                    <div className="history-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {group.channels.map(ch => (
                        <div key={ch.id} className="history-item">
                          {ch.icon ? <img className="history-icon" src={ch.icon} alt="" onError={e => e.target.style.display='none'} /> : <div className="history-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{ch.type === 'live' ? '\u{1F4FA}' : '\u{1F3AC}'}</div>}
                          <div className="history-info" onClick={() => {
                            if (ch.type === 'live' && api) handleGroupPlay(group, ch);
                            else if (ch.type === 'vod' && api) setPlayingItem({ url: api.getVodUrl(ch.id, 'mp4'), name: ch.name });
                          }} style={{ cursor: 'pointer', flex: 1 }}>
                            <div className="history-name">{ch.name}</div>
                            <div className="history-meta" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ch.type === 'live' ? t('live_tv') : ch.type === 'vod' ? t('movie') : t('series')}</div>
                          </div>
                          <button className="settings-btn settings-btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => handleRemoveFromGroup(group.id, ch.id)}>&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {playingItem && <VideoPlayer url={playingItem.url} title={playingItem.name} onClose={() => setPlayingItem(null)} />}
      {/* Group Player Mode - Live TV style layout */}
      {groupPlayerMode && api && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
            <button className="back-btn" onClick={() => { setGroupPlayerMode(null); setGroupEpg([]); setShowGroupEpgOverlay(false); }}>&#8592; {t('back')}</button>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{groupPlayerMode.group.name}</h2>
          </div>
          <div className="live-player-area" style={{ flex: 1 }}>
            <div className="live-player-main">
              <div className="live-player-top">
                <div className="live-player-info">
                  <span className="live-player-channel-name">{groupPlayerMode.playingChannel.name}</span>
                  {groupPlayerMode.playingChannel.type === 'live' && <span className="epg-live-badge">LIVE</span>}
                </div>
                <div className="live-player-actions">
                  <button className="back-btn" onClick={() => { setGroupPlayerMode(null); setGroupEpg([]); }}>&#9632; Stop</button>
                </div>
              </div>
              <div className="live-player-video">
                <VideoPlayer
                  key={groupPlayerMode.playingChannel.id}
                  url={groupPlayerMode.playingChannel.type === 'live' ? api.getLiveUrl(groupPlayerMode.playingChannel.id) : api.getVodUrl(groupPlayerMode.playingChannel.id, 'mp4')}
                  title={groupPlayerMode.playingChannel.name}
                  onClose={() => { setGroupPlayerMode(null); setGroupEpg([]); }}
                  inline={true}
                />
              </div>
              <div className="live-player-epg-bar" onClick={() => groupEpg.length > 0 && setShowGroupEpgOverlay(v => !v)}>
                {groupEpg.length > 0 ? groupEpg.filter(p => {
                  const now = new Date();
                  const start = new Date(p.start);
                  const end = new Date(p.end);
                  return now <= end;
                }).slice(0, 4).map(prog => (
                  <div key={prog.id} className="live-epg-item">
                    <span className="live-epg-time">{new Date(prog.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="live-epg-title">{prog.title}</span>
                  </div>
                )) : <div className="live-epg-item"><span className="live-epg-title" style={{ opacity: 0.5 }}>No EPG data available</span></div>}
              </div>
            </div>
            <div className="live-player-channels">
              {groupPlayerMode.group.channels.filter(ch => ch.type === 'live').map(ch => (
                <div key={ch.id} className={`ch-item ${groupPlayerMode.playingChannel?.id === ch.id ? 'active' : ''}`}
                  onClick={() => { setGroupPlayerMode(prev => ({ ...prev, playingChannel: ch })); addToHistory({ id: ch.id, name: ch.name, type: ch.type, streamId: ch.id, icon: ch.icon }); }}>
                  {ch.icon ? <img className="ch-icon-img" src={ch.icon} alt="" style={{ width: 28, height: 28 }} onError={e => { e.target.style.display = 'none'; }} /> : <span style={{ fontSize: 16 }}>{'\u{1F4FA}'}</span>}
                  <div className="ch-info" style={{ minWidth: 0 }}>
                    <div className="ch-name" style={{ fontSize: 11 }}>{ch.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════ CATCH UP SCREEN (with timeshift playback) ══════ */
function CatchUpScreen({ onBack, api }) {
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [epgData, setEpgData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channelLoading, setChannelLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingItem, setPlayingItem] = useState(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const fetchCats = async () => {
      setLoading(true);
      const cats = await api.getLiveCategories();
      if (!cancelled && cats && Array.isArray(cats) && cats.length > 0) {
        setCategories(cats);
        setSelectedCategory(cats[0].category_id);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCats();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchStreams = async () => {
      setChannelLoading(true);
      const streams = await api.getLiveStreams(selectedCategory);
      if (!cancelled && streams && Array.isArray(streams)) {
        setChannels(streams.filter(s => s.tv_archive === 1 || s.tv_archive === '1'));
      }
      if (!cancelled) setChannelLoading(false);
    };
    fetchStreams();
    return () => { cancelled = true; };
  }, [selectedCategory, api]);

  // Fetch EPG for selected catch-up channel
  useEffect(() => {
    if (!selectedChannel || !api) return;
    api.getEPG(selectedChannel.stream_id).then(data => {
      if (data && data.epg_listings && data.epg_listings.length > 0) {
        setEpgData(data.epg_listings.map((e, i) => ({
          id: e.id || i,
          title: e.title ? b64decode(e.title) : 'No Title',
          description: e.description ? b64decode(e.description) : '',
          start: e.start, end: e.end,
          has_archive: e.has_archive || true,
        })));
      } else {
        setEpgData([]);
      }
    });
  }, [selectedChannel, api]);

  const filtered = channels.filter(ch => !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const isPastProgram = (p) => new Date(p.end) < new Date();
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const playTimeshiftProgram = (prog) => {
    if (!api || !selectedChannel) return;
    // Build timeshift URL
    const startTime = new Date(prog.start);
    const endTime = new Date(prog.end);
    const duration = Math.ceil((endTime - startTime) / 60000); // minutes
    const startStr = startTime.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHmmss
    const url = api.getTimeshiftUrl(selectedChannel.stream_id, startStr, duration);
    setPlayingItem({ url, name: `${prog.title} (Catch Up)` });
  };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('catch_up')}</h1>
        <div className="section-header-right"><span className="channel-count">{filtered.length} {t('catchup_channels')}</span></div>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search"><input placeholder={t('search_catchup')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}>
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="section-channel-list" style={{maxWidth: selectedChannel ? '300px' : undefined}}>
          {(loading || channelLoading) && <div className="loading-indicator">{t('loading_catchup')}</div>}
          {!loading && !channelLoading && filtered.length === 0 && (
            <div className="epg-empty"><div style={{ fontSize: 48 }}>&#9202;</div><p>{t('no_catchup')}</p></div>
          )}
          {!loading && !channelLoading && filtered.map(ch => (
            <div key={ch.stream_id} className={`ch-item ${selectedChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
              onClick={() => setSelectedChannel(ch)}>
              {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : null}
              <div className="ch-icon" style={ch.stream_icon ? { display: 'none' } : {}}>{(ch.name || '?').charAt(0)}</div>
              <div className="ch-info">
                <div className="ch-name">{ch.name}</div>
                <div className="ch-prog">Archive: {ch.tv_archive_duration || '?'} days</div>
              </div>
            </div>
          ))}
        </div>
        {/* EPG Archive Panel */}
        {selectedChannel && (
          <div className="section-epg">
            <div className="epg-top">
              <div><div className="epg-ch-name">{selectedChannel.name}</div><div className="epg-ch-cat">Catch Up - {selectedChannel.tv_archive_duration || '?'} days archive</div></div>
            </div>
            <div className="epg-programs">
              {epgData.filter(p => isPastProgram(p)).map(prog => (
                <div key={prog.id} className="epg-prog" style={{cursor: 'pointer'}} onClick={() => playTimeshiftProgram(prog)}>
                  <div className="epg-prog-time">
                    <div>{formatDate(prog.start)}</div>
                    <div>{formatTime(prog.start)}</div>
                  </div>
                  <div className="epg-prog-details">
                    <div className="epg-prog-title">{prog.title}</div>
                    <div className="epg-prog-desc">{prog.description}</div>
                  </div>
                  <span className="ep-play" style={{marginLeft: 'auto', flexShrink: 0}}>&#9654;</span>
                </div>
              ))}
              {epgData.filter(p => isPastProgram(p)).length === 0 && (
                <div className="epg-empty"><p>No archived programs available</p></div>
              )}
            </div>
          </div>
        )}
      </div>
      {playingItem && <VideoPlayer url={playingItem.url} title={playingItem.name} onClose={() => setPlayingItem(null)} />}
    </div>
  );
}

/* ══════ SEARCH SCREEN ══════ */
function SearchScreen({ onBack, api }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ live: [], vod: [], series: [] });
  const [searching, setSearching] = useState(false);
  const [playingItem, setPlayingItem] = useState(null);
  const searchTimeout = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2 || !api) { setResults({ live: [], vod: [], series: [] }); return; }
    setSearching(true);
    const [live, vod, series] = await Promise.all([api.getLiveStreams(), api.getVodStreams(), api.getSeries()]);
    const lq = q.toLowerCase();
    setResults({
      live: (live || []).filter(c => c.name?.toLowerCase().includes(lq)).slice(0, 20),
      vod: (vod || []).filter(v => v.name?.toLowerCase().includes(lq)).slice(0, 20),
      series: (series || []).filter(s => s.name?.toLowerCase().includes(lq)).slice(0, 20),
    });
    setSearching(false);
  }, [api]);

  const handleInput = (val) => {
    setQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(val), 500);
  };

  const totalResults = results.live.length + results.vod.length + results.series.length;

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('search')}</h1>
      </div>
      <div className="search-screen-body">
        <div className="search-input-bar">
          <input className="search-global-input" placeholder={t('search_all')} value={query} onChange={e => handleInput(e.target.value)} autoFocus />
        </div>
        {searching && <div className="loading-indicator">Searching...</div>}
        {!searching && query.length >= 2 && totalResults === 0 && (
          <div className="epg-empty"><div style={{ fontSize: 48 }}>&#128269;</div><p>{t('no_results')} "{query}"</p></div>
        )}
        {!searching && totalResults > 0 && (
          <div className="search-results">
            {results.live.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">{t('live_tv')} ({results.live.length})</h3>
                <div className="search-items">
                  {results.live.map(ch => (
                    <div key={ch.stream_id} className="search-result-item" onClick={() => {
                      if (api) setPlayingItem({ url: api.getLiveUrl(ch.stream_id), name: ch.name });
                      addToHistory({ id: `live_${ch.stream_id}`, name: ch.name, type: 'live', streamId: ch.stream_id, icon: ch.stream_icon });
                    }}>
                      {ch.stream_icon ? <img className="search-result-icon" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : <div className="search-result-letter">{ch.name?.charAt(0)}</div>}
                      <div className="search-result-info"><div className="search-result-name">{ch.name}</div><div className="search-result-type">{t('live_tv')}</div></div>
                      <span className="ep-play">&#9654;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {results.vod.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">{t('movies')} ({results.vod.length})</h3>
                <div className="search-items">
                  {results.vod.map(item => (
                    <div key={item.stream_id} className="search-result-item" onClick={() => {
                      if (api) setPlayingItem({ url: api.getVodUrl(item.stream_id, item.container_extension || 'mp4'), name: item.name });
                      addToHistory({ id: `vod_${item.stream_id}`, name: item.name, type: 'vod', streamId: item.stream_id, icon: item.stream_icon });
                    }}>
                      {item.stream_icon ? <img className="search-result-icon" src={item.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : <div className="search-result-letter">{item.name?.charAt(0)}</div>}
                      <div className="search-result-info"><div className="search-result-name">{item.name}</div><div className="search-result-type">Movie {item.rating && item.rating !== '0' ? `- \u2605 ${item.rating}` : ''}</div></div>
                      <span className="ep-play">&#9654;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {results.series.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">{t('series')} ({results.series.length})</h3>
                <div className="search-items">
                  {results.series.map(item => (
                    <div key={item.series_id} className="search-result-item">
                      {item.cover ? <img className="search-result-icon" src={item.cover} alt="" onError={e => e.target.style.display='none'} /> : <div className="search-result-letter">{item.name?.charAt(0)}</div>}
                      <div className="search-result-info"><div className="search-result-name">{item.name}</div><div className="search-result-type">Series {item.rating && item.rating !== '0' ? `- \u2605 ${item.rating}` : ''}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {playingItem && <VideoPlayer url={playingItem.url} title={playingItem.name} onClose={() => setPlayingItem(null)} />}
    </div>
  );
}

/* ══════ EPG GRID VIEW (TV Guide) ══════ */
function EPGGridScreen({ onBack, api }) {
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [epgByChannel, setEpgByChannel] = useState({});
  const [selectedDate, setSelectedDate] = useState(0);
  const programsScrollRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const channelsScrollRef = useRef(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const fetchCats = async () => {
      setLoading(true);
      const cats = await api.getLiveCategories();
      if (!cancelled && cats && Array.isArray(cats) && cats.length > 0) {
        setCategories(cats);
        setSelectedCategory(cats[0].category_id);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCats();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const streams = await api.getLiveStreams(selectedCategory);
      if (!cancelled && streams && Array.isArray(streams)) {
        // Deduplicate channels by name (some servers return same channel multiple times)
        const seenNames = new Set();
        const uniqueStreams = streams.filter(s => {
          const key = (s.name || '').toLowerCase().trim();
          if (seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        });
        const limited = uniqueStreams.slice(0, 30);
        setChannels(limited);
        const epgMap = {};
        // Deduplicate and sort EPG entries - aggressive dedup
        const processEpg = (listings) => {
          const mapped = listings.map((e, idx) => ({
            id: e.id || idx,
            title: e.title ? b64decode(e.title) : 'No Title',
            description: e.description ? b64decode(e.description) : '',
            start: e.start, end: e.end,
            startMs: new Date(e.start).getTime(),
            endMs: new Date(e.end).getTime(),
          })).filter(p => !isNaN(p.startMs) && !isNaN(p.endMs) && p.endMs > p.startMs);
          // Sort by start time
          mapped.sort((a, b) => a.startMs - b.startMs);
          // Deduplicate: remove entries with same start time or same title+similar time
          const seen = new Set();
          const deduped = mapped.filter(p => {
            // Key by start time rounded to nearest minute + title
            const startMin = Math.floor(p.startMs / 60000);
            const key = `${startMin}_${p.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          // Remove overlapping: keep non-overlapping programs, prefer longer ones
          const clean = [];
          for (const p of deduped) {
            if (clean.length === 0) { clean.push(p); continue; }
            const prev = clean[clean.length - 1];
            // No overlap - program starts at or after previous ends
            if (p.startMs >= prev.endMs) {
              clean.push(p);
            } else if (p.startMs === prev.startMs) {
              // Same start - keep the longer program
              if (p.endMs > prev.endMs) clean[clean.length - 1] = p;
            } else if (p.startMs > prev.startMs && p.endMs > prev.endMs) {
              // Partial overlap - trim previous to end at this one's start if gap is small
              const overlap = prev.endMs - p.startMs;
              if (overlap < 5 * 60000) { // Less than 5 min overlap, allow
                clean.push(p);
              }
              // else skip (too much overlap)
            }
            // else fully contained in previous - skip
          }
          return clean;
        };
        // Fetch EPG in batches of 5 for performance
        for (let i = 0; i < limited.length; i += 5) {
          const batch = limited.slice(i, i + 5);
          await Promise.all(batch.map(async (ch) => {
            try {
              let data = await api.getFullEPG(ch.stream_id);
              if (data && data.epg_listings && data.epg_listings.length > 0) {
                epgMap[ch.stream_id] = processEpg(data.epg_listings);
              } else {
                data = await api.getEPG(ch.stream_id);
                if (data && data.epg_listings && data.epg_listings.length > 0) {
                  epgMap[ch.stream_id] = processEpg(data.epg_listings);
                }
              }
            } catch (err) { /* skip channel */ }
          }));
          if (!cancelled && i + 5 < limited.length) {
            setEpgByChannel({ ...epgMap });
          }
        }
        if (!cancelled) setEpgByChannel({ ...epgMap });
      }
      if (!cancelled) setLoading(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, [selectedCategory, api]);

  // Timeline setup
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();
  today.setDate(today.getDate() + selectedDate);
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const now = new Date();
  const pixelsPerMinute = 3;
  const nowOffset = selectedDate === 0 ? ((now - dayStart) / 60000) * pixelsPerMinute : 0;
  const totalWidth = 24 * 180;

  const getProgramStyle = (prog) => {
    const start = new Date(prog.start);
    const end = new Date(prog.end);
    const progDayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    // Use the selected day's start for positioning
    const left = Math.max(0, ((start - dayStart) / 60000) * pixelsPerMinute);
    const width = Math.max(20, ((end - start) / 60000) * pixelsPerMinute);
    // Only show programs that overlap with this day
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    if (end <= dayStart || start >= dayEnd) return null;
    const clampedLeft = Math.max(0, left);
    const clampedWidth = Math.min(totalWidth - clampedLeft, width);
    return { left: `${clampedLeft}px`, width: `${clampedWidth}px` };
  };

  const isCurrentProgram = (p) => {
    const n = new Date();
    return new Date(p.start) <= n && new Date(p.end) > n;
  };

  const dateLabels = [
    { offset: -1, label: 'Yesterday' },
    { offset: 0, label: 'Today' },
    { offset: 1, label: 'Tomorrow' },
  ];

  // Sync scroll between timeline, channels, and program rows
  const handleProgramsScroll = () => {
    if (programsScrollRef.current) {
      if (timelineScrollRef.current) timelineScrollRef.current.scrollLeft = programsScrollRef.current.scrollLeft;
      if (channelsScrollRef.current) channelsScrollRef.current.scrollTop = programsScrollRef.current.scrollTop;
    }
  };

  // Scroll to current time on load
  useEffect(() => {
    if (!loading && programsScrollRef.current && selectedDate === 0) {
      const scrollTo = Math.max(0, nowOffset - 200);
      programsScrollRef.current.scrollLeft = scrollTo;
      if (timelineScrollRef.current) timelineScrollRef.current.scrollLeft = scrollTo;
    }
  }, [loading, selectedDate]);

  // Get now/next for a channel
  const getNowNext = (streamId) => {
    const progs = epgByChannel[streamId] || [];
    const n = new Date();
    const nowProg = progs.find(p => new Date(p.start) <= n && new Date(p.end) > n);
    let nextProg = null;
    if (nowProg) {
      const nowEnd = new Date(nowProg.end);
      nextProg = progs.find(p => new Date(p.start) >= nowEnd);
    } else {
      nextProg = progs.find(p => new Date(p.start) > n);
    }
    // Progress percentage for current program
    let progress = 0;
    if (nowProg) {
      const s = new Date(nowProg.start).getTime();
      const e = new Date(nowProg.end).getTime();
      progress = Math.min(100, Math.max(0, ((n.getTime() - s) / (e - s)) * 100));
    }
    return { nowProg, nextProg, progress };
  };

  const fmt = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('tv_guide')}</h1>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}>
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="epg-main-area">
          {/* Date Navigation - sticky top */}
          <div className="epg-grid-header">
            <div className="epg-grid-date-nav">
              {dateLabels.map(d => (
                <button key={d.offset} className={`epg-grid-date-btn ${selectedDate === d.offset ? 'active' : ''}`}
                  onClick={() => setSelectedDate(d.offset)}>{d.label}</button>
              ))}
            </div>
          </div>

          {loading && <div className="loading-indicator">Loading TV Guide...</div>}

          {!loading && (
            <div className="epg-split-layout">
              {/* Fixed channel column */}
              <div className="epg-channels-col" ref={channelsScrollRef}>
                <div className="epg-channels-header">Channel</div>
                {channels.map(ch => {
                  const { nowProg, progress } = selectedDate === 0 ? getNowNext(ch.stream_id) : { nowProg: null, progress: 0 };
                  return (
                    <div key={ch.stream_id} className="epg-channel-cell">
                      {ch.stream_icon && <img className="epg-grid-channel-icon" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} />}
                      <div className="epg-channel-info">
                        <span className="epg-grid-channel-name">{ch.name}</span>
                        {selectedDate === 0 && nowProg && (
                          <div className="epg-channel-now-label">
                            <div className="epg-now-progress-bar">
                              <div className="epg-now-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scrollable programs area */}
              <div className="epg-programs-area">
                {/* Timeline header - synced scroll */}
                <div className="epg-timeline-strip" ref={timelineScrollRef}>
                  <div className="epg-timeline-inner" style={{ width: `${totalWidth}px`, position: 'relative' }}>
                    {hours.map(h => (
                      <div key={h} className="epg-timeline-hour" style={{ left: `${h * 180}px` }}>
                        {String(h).padStart(2, '0')}:00
                      </div>
                    ))}
                    {selectedDate === 0 && <div className="epg-timeline-now-marker" style={{ left: `${nowOffset}px` }} />}
                  </div>
                </div>

                {/* Program rows - scrollable */}
                <div className="epg-programs-scroll" ref={programsScrollRef} onScroll={handleProgramsScroll}>
                  <div className="epg-programs-inner" style={{ width: `${totalWidth}px`, position: 'relative' }}>
                    {/* Now line */}
                    {selectedDate === 0 && <div className="epg-now-line" style={{ left: `${nowOffset}px` }} />}

                    {channels.map(ch => {
                      const progs = (epgByChannel[ch.stream_id] || []);
                      return (
                        <div key={ch.stream_id} className="epg-program-row">
                          {progs.map(prog => {
                            const style = getProgramStyle(prog);
                            if (!style) return null;
                            return (
                              <div key={prog.id} className={`epg-grid-program ${isCurrentProgram(prog) ? 'current' : ''}`}
                                style={style} title={`${prog.title}\n${fmt(prog.start)} - ${fmt(prog.end)}`}>
                                <div className="epg-grid-program-title">{prog.title}</div>
                                <div className="epg-grid-program-time">{fmt(prog.start)} - {fmt(prog.end)}</div>
                              </div>
                            );
                          })}
                          {progs.length === 0 && (
                            <div className="epg-no-data">No EPG data available</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════ MULTI-SCREEN ══════ */
function MultiScreenScreen({ onBack, api }) {
  const [layout, setLayout] = useState(2); // 2 or 4 screens
  const [screens, setScreens] = useState([null, null, null, null]);
  const [activeCell, setActiveCell] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadChannels = async () => {
    if (!api || channels.length > 0) return;
    setLoading(true);
    const streams = await api.getLiveStreams();
    if (streams && Array.isArray(streams)) setChannels(streams);
    setLoading(false);
  };

  const handlePickChannel = (ch) => {
    const newScreens = [...screens];
    newScreens[activeCell] = ch;
    setScreens(newScreens);
    setShowPicker(false);
  };

  const handleClearCell = (idx) => {
    const newScreens = [...screens];
    newScreens[idx] = null;
    setScreens(newScreens);
  };

  const openPicker = (idx) => {
    setActiveCell(idx);
    setShowPicker(true);
    loadChannels();
  };

  const filteredChannels = channels.filter(ch => !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 50);
  const visibleCells = layout;

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; {t('home')}</button>
        <h1 className="section-title">{t('multi_screen')}</h1>
        <div className="section-header-right">
          <button className={`header-filter-btn ${layout === 2 ? 'active' : ''}`} onClick={() => setLayout(2)} title="2 screens">2</button>
          <button className={`header-filter-btn ${layout === 4 ? 'active' : ''}`} onClick={() => setLayout(4)} title="4 screens">4</button>
        </div>
      </div>
      <div style={{flex: 1, position: 'relative', display: 'flex'}}>
        <div className={`multiscreen-container multiscreen-${layout}`} style={{flex: 1}}>
          {Array.from({ length: visibleCells }, (_, idx) => (
            <div key={idx} className={`multiscreen-cell ${activeCell === idx ? 'active' : ''}`} onClick={() => !screens[idx] && openPicker(idx)}>
              {screens[idx] ? (
                <>
                  <div className="multiscreen-cell-label">{screens[idx].name}</div>
                  <button className="multiscreen-cell-close" onClick={(e) => { e.stopPropagation(); handleClearCell(idx); }}>&#10005;</button>
                  {api && <VideoPlayer url={api.getLiveUrl(screens[idx].stream_id)} title={screens[idx].name} inline={true} />}
                </>
              ) : (
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer', flexDirection: 'column', gap: 8}}
                  onClick={() => openPicker(idx)}>
                  <div style={{fontSize: 36, color: 'var(--text-muted)'}}>+</div>
                  <div style={{fontSize: 12, color: 'var(--text-muted)'}}>{t('add_channel')}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Channel Picker Overlay */}
        {showPicker && (
          <div style={{position: 'absolute', inset: 0, background: 'rgba(248,244,248,0.97)', backdropFilter: 'blur(8px)', zIndex: 10, display: 'flex', flexDirection: 'column', padding: 20, animation: 'fadeIn 0.2s'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
              <button className="back-btn" onClick={() => setShowPicker(false)}>&#10005; {t('close')}</button>
              <h2 style={{fontSize: 16, fontWeight: 700, color: 'var(--text)'}}>{ t('select_channel')} {activeCell + 1}</h2>
            </div>
            <input className="search-global-input" placeholder={t('search_channels')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{marginBottom: 16, maxWidth: 400}} />
            {loading && <div className="loading-indicator">Loading channels...</div>}
            <div style={{flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4}}>
              {filteredChannels.map(ch => (
                <div key={ch.stream_id} className="ch-item" onClick={() => handlePickChannel(ch)} style={{cursor: 'pointer'}}>
                  {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : null}
                  <div className="ch-icon" style={ch.stream_icon ? {display:'none'} : {}}>{(ch.name || '?').charAt(0)}</div>
                  <div className="ch-info"><div className="ch-name">{ch.name}</div></div>
                  <span className="ep-play">&#9654;</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Player license helper ── */
function getPlayerLicense() {
  // Default to trial, will be updated from backend
  return { type: 'trial', expiresAt: null, trialDaysLeft: 15 };
}

async function fetchPlayerLicense() {
  try {
    const device = getDeviceIdentity();
    const res = await axios.post('https://management.dashplayer.eu/api/device/lookup', {
      mac_address: device.mac,
      device_key: device.key,
    });
    const d = res.data?.device;
    if (!d) return null;
    const defaultLang = d.default_language || 'en';
    // Check if device is blocked/banned
    if (d.status === 'blocked' || d.is_banned) return { type: 'blocked', expiresAt: null, trialDaysLeft: 0, default_language: defaultLang };
    if (d.status === 'expired') return { type: 'expired', expiresAt: d.license_expires_at, trialDaysLeft: 0, default_language: defaultLang };
    const licType = d.license_type || 'trial';
    if (licType === 'unlimited') return { type: 'unlimited', expiresAt: null, trialDaysLeft: 0, default_language: defaultLang };
    if (licType === 'yearly') {
      const expires = d.license_expires_at ? new Date(d.license_expires_at) : null;
      const daysLeft = expires ? Math.ceil((expires - new Date()) / (1000*60*60*24)) : 365;
      return { type: daysLeft > 0 ? 'yearly' : 'expired', expiresAt: d.license_expires_at, trialDaysLeft: 0, default_language: defaultLang };
    }
    // Trial
    const created = new Date(d.created_at);
    const daysSinceCreated = Math.floor((new Date() - created) / (1000*60*60*24));
    const trialDays = 7;
    return { type: 'trial', expiresAt: null, trialDaysLeft: Math.max(0, trialDays - daysSinceCreated), default_language: defaultLang };
  } catch (e) {
    return null;
  }
}

function getPlayerStatusText(license) {
  if (license.type === 'blocked') return 'Blocked';
  if (license.type === 'expired') return 'Expired';
  if (license.type === 'unlimited') return 'Unlimited';
  if (license.type === 'yearly') return license.expiresAt ? `Expires ${license.expiresAt}` : 'Active';
  if (license.type === 'trial') {
    if (license.trialDaysLeft <= 0) return 'Expired';
    return `${license.trialDaysLeft} days left`;
  }
  return 'Unknown';
}

/* ══════ MAIN APP ══════ */
export default function App() {
  const [credentials, setCredentials] = useState(() => {
    const defaultPl = getDefaultPlaylist();
    if (defaultPl) return { url: defaultPl.server_url, username: defaultPl.username, password: defaultPl.password, output_format: defaultPl.output_format || 'm3u8' };
    return null;
  });
  const [screen, setScreen] = useState('home');
  const [playerLicense, setPlayerLicense] = useState(() => getPlayerLicense());
  const [api, setApi] = useState(null);
  const [contentStats, setContentStats] = useState({ live: 0, vod: 0, series: 0, radio: 0 });
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [pendingPlayItem, setPendingPlayItem] = useState(null);

  useEffect(() => {
    if (credentials && credentials.url && credentials.username && credentials.password) {
      console.log('[DashPlayer] Creating API for:', credentials.url, 'user:', credentials.username);
      const format = credentials.output_format || 'm3u8';
      setApi(createXtreamApi(credentials.url, credentials.username, credentials.password, format));
      setStatsError('');
    } else if (credentials) {
      console.warn('[DashPlayer] Credentials incomplete:', { url: !!credentials.url, username: !!credentials.username, password: !!credentials.password });
      if (!credentials.password) setStatsError('Playlist password missing - please delete and re-add your playlist');
      else if (!credentials.url) setStatsError('Playlist server URL missing');
    }
  }, [credentials]);

  // Fetch license from backend and sync playlists
  useEffect(() => {
    fetchPlayerLicense().then(lic => {
      if (lic) {
        setPlayerLicense(lic);
        // Always apply default_language from admin panel
        if (lic.default_language) {
          setCurrentLanguage(lic.default_language);
        }
      }
    });
    // Fetch + merge playlists from backend on startup
    fetchPlaylistsFromBackend().then(merged => {
      if (merged && merged.length > 0) {
        const defaultPl = merged.find(p => p.is_default) || merged[0];
        if (defaultPl) {
          setCredentials(prev => prev || { url: defaultPl.server_url, username: defaultPl.username, password: defaultPl.password, output_format: defaultPl.output_format || 'm3u8' });
        }
      }
    });
  }, []);

  // Re-apply VPN proxy on startup (Electron only)
  useEffect(() => {
    if (window.dashPlayer?.isElectron && window.dashPlayer?.setProxy) {
      const vpnOn = localStorage.getItem('dash_vpn_enabled') === 'true';
      const server = localStorage.getItem('dash_vpn_server') || '';
      const port = localStorage.getItem('dash_vpn_port') || '';
      const proto = localStorage.getItem('dash_vpn_protocol') || 'socks5';
      const user = localStorage.getItem('dash_vpn_username') || '';
      const pass = localStorage.getItem('dash_vpn_password') || '';
      if (vpnOn && server && port) {
        const proxyProto = proto === 'socks5' ? 'socks5' : proto === 'http' ? 'http' : 'socks5';
        window.dashPlayer.setProxy({ protocol: proxyProto, server, port, username: user, password: pass });
      }
    }
  }, []);

  // Fetch content stats for home screen
  useEffect(() => {
    if (!api) { console.log('[DashPlayer] No API available, skipping stats fetch'); return; }
    const fetchStats = async () => {
      console.log('[DashPlayer] Fetching content stats...');
      setLoadingStats(true);
      setStatsError('');
      // First test authentication
      try {
        const authTest = await api.authenticate();
        console.log('[DashPlayer] Auth test result:', authTest ? 'OK' : 'FAILED', authTest?.user_info ? 'user_info present' : 'no user_info');
        if (!authTest || !authTest.user_info) {
          setStatsError('Authentication failed - subscription may be expired or credentials are incorrect');
          setLoadingStats(false);
          return;
        }
      } catch (authErr) {
        console.error('[DashPlayer] Auth test error:', authErr);
        const status = authErr?.response?.status;
        if (status === 403) {
          setStatsError('Authentication failed - subscription expired or access denied (403)');
        } else {
          setStatsError('Cannot connect to server: ' + (authErr.message || 'unknown error'));
        }
        setLoadingStats(false);
        return;
      }
      const [live, vod, series, liveCats, radioCatsApi] = await Promise.all([
        api.getLiveStreams(),
        api.getVodStreams(),
        api.getSeries(),
        api.getLiveCategories(),
        api.getRadioCategories(),
      ]);
      console.log('[DashPlayer] Stats results:', { live: live?.length || 0, vod: vod?.length || 0, series: series?.length || 0, liveCats: liveCats?.length || 0 });
      // Count radio streams - try dedicated radio API first, then fallback to live category names
      let radioCount = 0;
      if (radioCatsApi && Array.isArray(radioCatsApi) && radioCatsApi.length > 0) {
        // Dedicated radio endpoint - try fetching all radio streams at once first
        const allRadio = await api.getRadioStreams();
        if (allRadio && Array.isArray(allRadio) && allRadio.length > 0) {
          radioCount = allRadio.length;
        } else {
          // Try per-category, then fallback to live streams with radio cat IDs
          for (const cat of radioCatsApi) {
            const streams = await api.getRadioStreams(cat.category_id);
            if (streams && Array.isArray(streams)) { radioCount += streams.length; }
            else {
              const liveStreams = await api.getLiveStreams(cat.category_id);
              if (liveStreams && Array.isArray(liveStreams)) radioCount += liveStreams.length;
            }
          }
        }
      } else {
        // Fallback: check live categories for radio-related names
        const isRadioCat = (name) => {
          if (!name) return false;
          const n = name.toLowerCase();
          const keywords = ['radio', 'radyo', 'fm ', ' fm', 'muziek', 'musik', 'music', 'müzik'];
          return keywords.some(k => n.includes(k)) || /\bfm\b/i.test(name) || /\bam\b/i.test(name);
        };
        if (liveCats && Array.isArray(liveCats) && live && Array.isArray(live)) {
          const radioCatIds = new Set(
            liveCats.filter(c => isRadioCat(c.category_name))
              .map(c => String(c.category_id))
          );
          radioCount = radioCatIds.size > 0
            ? live.filter(s => radioCatIds.has(String(s.category_id))).length
            : 0;
        }
      }
      setContentStats({
        live: live && Array.isArray(live) ? live.length : 0,
        vod: vod && Array.isArray(vod) ? vod.length : 0,
        series: series && Array.isArray(series) ? series.length : 0,
        radio: radioCount,
      });
      setLoadingStats(false);
      if ((!live || !Array.isArray(live) || live.length === 0) && (!vod || !Array.isArray(vod) || vod.length === 0)) {
        setStatsError('Server returned empty data - playlist may have no content assigned');
      }
    };
    fetchStats().catch(e => { console.error('[DashPlayer] fetchStats error:', e); setStatsError('Error loading content: ' + e.message); setLoadingStats(false); });
  }, [api]);

  const isTrialExpired = playerLicense.type === 'trial' && playerLicense.trialDaysLeft <= 0;
  const isBlocked = playerLicense.type === 'blocked';
  const isExpired = playerLicense.type === 'expired';

  const handleActivated = (creds) => {
    // Save as first playlist if none exist
    const existing = getPlaylists();
    if (existing.length === 0 && creds.url && creds.url !== 'http://demo') {
      savePlaylists([{ id: Date.now(), name: 'My Playlist', server_url: creds.url, username: creds.username, password: creds.password, output_format: creds.output_format || 'm3u8', is_default: true }]);
    }
    setCredentials(creds);
    setScreen('home');
  };

  const handleSwitchPlaylist = (creds) => {
    // Force full reload by clearing state first
    setApi(null);
    setContentStats({ live: 0, vod: 0, series: 0, radio: 0 });
    setCredentials(creds);
    setScreen('home');
  };

  if (!credentials) {
    return <ActivationScreen onActivated={handleActivated} />;
  }

  if (isBlocked) {
    return (
      <div className="activation-screen">
        <div className="activation-container">
          <div className="activation-info">
            <div className="activation-info-inner">
              <div className="trial-expired-icon" style={{color:'#ef4444'}}>&#128683;</div>
              <h2 className="trial-expired-title">Device Blocked</h2>
              <p className="trial-expired-desc">This device has been blocked. Please contact support for assistance.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isTrialExpired || isExpired) {
    return <ExpiredScreen licenseType={playerLicense.type === 'trial' ? 'trial' : 'yearly'} />;
  }

  const handleNavigate = (section, playItem) => {
    if (playItem) setPendingPlayItem(playItem);
    else setPendingPlayItem(null);
    setScreen(section);
  };

  switch (screen) {
    case 'live':
      return <LiveTVScreen onBack={() => setScreen('home')} api={api} autoPlayItem={pendingPlayItem} onConsumeAutoPlay={() => setPendingPlayItem(null)} />;
    case 'vod':
      return <MediaScreen type="vod" onBack={() => setScreen('home')} api={api} autoPlayItem={pendingPlayItem} onConsumeAutoPlay={() => setPendingPlayItem(null)} />;
    case 'series':
      return <MediaScreen type="series" onBack={() => setScreen('home')} api={api} />;
    case 'radio':
      return <RadioScreen onBack={() => setScreen('home')} api={api} />;
    case 'settings':
      return <SettingsScreen onBack={() => setScreen('home')} api={api} />;
    case 'favorites':
      return <FavoritesScreen onBack={() => setScreen('home')} api={api} onNavigate={handleNavigate} />;
    case 'catchup':
      return <CatchUpScreen onBack={() => setScreen('home')} api={api} />;
    case 'search':
      return <SearchScreen onBack={() => setScreen('home')} api={api} />;
    case 'epg':
      return <EPGGridScreen onBack={() => setScreen('home')} api={api} />;
    case 'multiscreen':
      return <MultiScreenScreen onBack={() => setScreen('home')} api={api} />;
    case 'speedtest':
      return <SpeedTestScreen onBack={() => setScreen('home')} />;
    case 'playlists':
      return <PlaylistsScreen onBack={() => setScreen('home')} onSwitch={handleSwitchPlaylist} activePlaylist={credentials} />;
    default:
      return <HomeScreen onNavigate={handleNavigate} credentials={credentials} playerLicense={playerLicense} contentStats={contentStats} loadingStats={loadingStats} statsError={statsError} />;
  }
}
