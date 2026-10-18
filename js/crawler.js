(function (global) {
  const STORAGE_KEYS = {
    MENU: 'dantri_menu_v4',
    POSTS: 'dantri_posts_v4',
    CRAWLED: 'dantri_crawled_v4'
  };

  const CATEGORY_MAP = {
    'the-gioi': 'Thế giới',
    'thoi-su': 'Thời sự',
    'phap-luat': 'Pháp luật',
    'suc-khoe': 'Sức khỏe',
    'doi-song': 'Đời sống',
    'du-lich': 'Du lịch',
    'kinh-doanh': 'Kinh doanh',
    'bat-dong-san': 'Bất động sản',
    'the-thao': 'Thể thao',
    'giai-tri': 'Giải trí',
    'giao-duc': 'Giáo dục',
    'o-to-xe-may': 'Xe ++',
    'xe': 'Xe ++',
    'noi-vu': 'Nội vụ',
    'tam-long-nhan-ai': 'Nhân ái',
    'nhan-ai': 'Nhân ái',
    'tin-moi-nhat': 'Mới nhất'
  };

  const SAMPLE_ARTICLE = {
    id: 'dtri-20260928122246655',
    title: 'Hà Nội tính cơ chế bồi thường đất đặc biệt cho 7 dự án đường sắt',
    slug: 'ha-noi-tinh-co-che-boi-thuong-dat-dac-biet-cho-7-du-an-duong-sat',
    excerpt: 'Hà Nội đang xem xét cơ chế bồi thường, hỗ trợ và tái định cư đặc biệt để triển khai 7 dự án đường sắt quan trọng trên địa bàn thành phố.',
    content: 'Hà Nội đang nghiên cứu và đề xuất cơ chế bồi thường, hỗ trợ và tái định cư đặc biệt nhằm tháo gỡ khó khăn trong công tác giải phóng mặt bằng cho 7 dự án đường sắt trọng điểm. Đây là nhóm dự án hạ tầng giao thông có vai trò quan trọng trong việc phát triển mạng lưới vận tải công cộng và giảm ùn tắc đô thị. Thành phố nhấn mạnh việc cần cơ chế linh hoạt để đẩy nhanh tiến độ triển khai, đảm bảo quyền lợi cho người dân bị ảnh hưởng và đồng thời đáp ứng yêu cầu phát triển hạ tầng chiến lược.',
    author: 'Văn Hưng',
    category: 'Bất động sản',
    publishedAt: '2026-09-28 12:22',
    source: 'dantri.com.vn',
    url: 'https://dantri.com.vn/bat-dong-san/ha-noi-tinh-co-che-boi-thuong-dat-dac-biet-cho-7-du-an-duong-sat-20260928122246655.htm',
    image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80',
    categoryId: 'bat-dong-san'
  };

  function decodeEntities(str = '') {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value.replace(/\s+/g, ' ').trim();
  }

  function parseUrlMetadata(rawUrl = '') {
    try {
      const parsed = new URL(rawUrl.trim());
      const source = parsed.hostname.replace(/^www\./i, '');
      const pathParts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
      const categorySlug = pathParts.length > 1 ? pathParts[0] : '';
      const filename = (pathParts[pathParts.length - 1] || '').replace(/\.(htm|html)$/i, '');

      const match = filename.match(/^(.*)-(\d{10,20})$/);
      const prefix = source.includes('dantri') ? 'dtri' : source.split('.')[0];
      if (match) {
        return {
          id: `${prefix}-${match[2]}`,
          slug: match[1],
          rawId: match[2],
          categorySlug,
          source,
          cleanUrl: parsed.href
        };
      }

      return {
        id: `${prefix}-${Date.now()}`,
        slug: filename || 'bai-viet',
        rawId: '',
        categorySlug,
        source,
        cleanUrl: parsed.href
      };
    } catch (err) {
      throw new Error('URL không hợp lệ.');
    }
  }

  function formatDateTime(dateInput = '', rawId = '') {
    if (rawId && rawId.length >= 12) {
      const y = rawId.slice(0, 4);
      const m = rawId.slice(4, 6);
      const d = rawId.slice(6, 8);
      const hh = rawId.slice(8, 10);
      const mm = rawId.slice(10, 12);
      if (Number(y) >= 2020 && Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
        return `${y}-${m}-${d} ${hh}:${mm}`;
      }
    }
    if (dateInput) {
      const directMatch = String(dateInput).match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
      if (directMatch) return `${directMatch[1]} ${directMatch[2]}`;
      const d = new Date(dateInput);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  function extractArticleFromHtml(htmlString, targetUrl) {
    const meta = parseUrlMetadata(targetUrl);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    let ldArticle = null;
    let ldBreadcrumbCategory = '';
    const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    ldScripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent.trim());
        if (data['@type'] === 'NewsArticle' || data['@type'] === 'Article') {
          ldArticle = data;
        } else if (data['@type'] === 'BreadcrumbList' && Array.isArray(data.itemListElement)) {
          const flat = data.itemListElement.flat();
          if (flat.length >= 2 && flat[1].name) {
            ldBreadcrumbCategory = flat[1].name;
          }
        }
      } catch (_) {}
    });

    let title = ldArticle?.headline
      || doc.querySelector('h1.title-page, h1[data-slot="title"], article h1, h1')?.textContent
      || doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
      || doc.title
      || '';
    title = decodeEntities(title).replace(/\s*\|\s*Báo Dân trí.*$/i, '').trim();

    let excerpt = doc.querySelector('[data-slot="sapo"], h2.singular-sapo, .article-sapo')?.textContent
      || ldArticle?.description
      || doc.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute('content')
      || '';
    excerpt = decodeEntities(excerpt).replace(/^\(Dân trí\)\s*[-–—]?\s*/i, '').trim();

    const contentContainer = doc.querySelector('[data-slot="content"], .singular-content, .article-content, article');
    const paragraphs = [];
    if (contentContainer) {
      contentContainer.querySelectorAll('p').forEach((p) => {
        const text = decodeEntities(p.textContent);
        if (text && text.length > 15 && !text.startsWith('Tin tức mới nhất')) {
          paragraphs.push(text);
        }
      });
    }
    const content = paragraphs.length > 0 ? paragraphs.join('\n\n') : excerpt;

    let author = '';
    if (ldArticle?.author) {
      if (Array.isArray(ldArticle.author)) {
        author = ldArticle.author.map((a) => a.name || '').filter(Boolean).join(', ');
      } else if (typeof ldArticle.author === 'object') {
        author = ldArticle.author.name || '';
      } else if (typeof ldArticle.author === 'string') {
        author = ldArticle.author;
      }
    }
    if (!author) {
      const authorEl = doc.querySelector('[data-content-name="article-author"], .author-name, .author');
      if (authorEl) author = decodeEntities(authorEl.textContent);
    }
    author = author || 'Phóng viên Dân trí';

    let rawCategory = ldArticle?.articleSection
      || ldBreadcrumbCategory
      || doc.querySelector('.breadcrumbs a:nth-child(2)')?.textContent
      || CATEGORY_MAP[meta.categorySlug]
      || 'Tin tức';
    rawCategory = decodeEntities(rawCategory);
    const category = rawCategory.split(',')[0].trim() || 'Tin tức';

    const timeAttr = doc.querySelector('time[datetime]')?.getAttribute('datetime')
      || ldArticle?.datePublished
      || '';
    const publishedAt = formatDateTime(timeAttr, meta.rawId);

    let image = ldArticle?.primaryImageOfPage?.url
      || ldArticle?.thumbnailUrl
      || (Array.isArray(ldArticle?.image) ? ldArticle.image[0] : '')
      || doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
      || '';

    const normalized = {
      id: meta.id,
      title,
      slug: meta.slug,
      excerpt,
      content,
      author,
      category,
      publishedAt,
      source: meta.source,
      url: meta.cleanUrl
    };

    const extended = {
      ...normalized,
      image: (image && !image.includes('cdnphoto.dantri.com.vn')) ? image : SAMPLE_ARTICLE.image,
      categoryId: meta.categorySlug === 'tam-long-nhan-ai' ? 'nhan-ai' : (meta.categorySlug || 'latest')
    };

    return { normalized, extended };
  }

  async function fetchHtmlWithCorsFallback(targetUrl) {
    const encoded = encodeURIComponent(targetUrl);
    const endpoints = [
      `https://api.allorigins.win/raw?url=${encoded}`,
      `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
      `https://corsproxy.io/?url=${encoded}`
    ];

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes('<') && text.length > 300) {
            return text;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  async function crawlArticleByUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Vui lòng nhập URL bài viết hợp lệ.');
    }
    const cleanUrl = url.trim();
    const meta = parseUrlMetadata(cleanUrl);

    if (meta.id === SAMPLE_ARTICLE.id) {
      const { image, categoryId, ...sampleNorm } = SAMPLE_ARTICLE;
      return sampleNorm;
    }

    const html = await fetchHtmlWithCorsFallback(meta.cleanUrl);
    if (html) {
      const parsed = extractArticleFromHtml(html, meta.cleanUrl);
      if (parsed.normalized.title) {
        return parsed.normalized;
      }
    }

    const storedPosts = getStoredPosts();
    const found = storedPosts.find((p) => p.id === meta.id || p.url === meta.cleanUrl || p.slug === meta.slug);
    if (found) {
      return {
        id: found.id,
        title: found.title,
        slug: found.slug,
        excerpt: found.excerpt,
        content: found.content,
        author: typeof found.author === 'object' ? found.author.name : (found.author || ''),
        category: Array.isArray(found.category) ? found.category[0] : (found.category || ''),
        publishedAt: found.publishedAt,
        source: found.source || 'dantri.com.vn',
        url: found.url
      };
    }

    const humanTitle = meta.slug
      .split('-')
      .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
    const fallbackCategory = CATEGORY_MAP[meta.categorySlug] || 'Tin tức';

    return {
      id: meta.id,
      title: humanTitle,
      slug: meta.slug,
      excerpt: `Tóm tắt nội dung bài viết ${humanTitle} thuộc chuyên mục ${fallbackCategory}.`,
      content: `Nội dung chi tiết bài viết ${humanTitle} được thu thập từ nguồn ${meta.cleanUrl} thuộc chuyên mục ${fallbackCategory} trên báo ${meta.source}.`,
      author: 'Phóng viên Dân trí',
      category: fallbackCategory,
      publishedAt: formatDateTime('', meta.rawId),
      source: meta.source,
      url: meta.cleanUrl
    };
  }

  function getStoredPosts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.POSTS);
      if (raw && !raw.includes('cdnphoto.dantri.com.vn')) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    if (Array.isArray(global.INITIAL_POSTS_DATA)) {
      try {
        localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(global.INITIAL_POSTS_DATA));
      } catch (_) {}
      return global.INITIAL_POSTS_DATA;
    }
    return [SAMPLE_ARTICLE];
  }

  function saveArticleToStorage(normalizedArticle, extra = {}) {
    const posts = getStoredPosts();
    const meta = parseUrlMetadata(normalizedArticle.url || SAMPLE_ARTICLE.url);

    let chosenImage = extra.image || normalizedArticle.image || SAMPLE_ARTICLE.image;
    if (!chosenImage || chosenImage.includes('cdnphoto.dantri.com.vn')) {
      chosenImage = SAMPLE_ARTICLE.image;
    }

    const postToSave = {
      ...normalizedArticle,
      image: chosenImage,
      categoryId: extra.categoryId || (meta.categorySlug === 'tam-long-nhan-ai' ? 'nhan-ai' : (meta.categorySlug || 'latest'))
    };

    const existingIdx = posts.findIndex((p) => p.id === postToSave.id);
    if (existingIdx >= 0) {
      posts[existingIdx] = postToSave;
    } else {
      posts.unshift(postToSave);
    }
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));

    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(STORAGE_KEYS.CRAWLED) || '[]');
    } catch (_) {}
    const histIdx = history.findIndex((h) => h.id === postToSave.id);
    if (histIdx >= 0) {
      history[histIdx] = normalizedArticle;
    } else {
      history.unshift(normalizedArticle);
    }
    localStorage.setItem(STORAGE_KEYS.CRAWLED, JSON.stringify(history));

    return postToSave;
  }

  function getCrawledHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CRAWLED) || '[]');
    } catch (_) {
      return [];
    }
  }

  function initCrawlerPage() {
    const form = document.getElementById('crawler-form');
    if (!form) return;

    const urlInput = document.getElementById('crawler-url-input');
    const jsonOutput = document.getElementById('crawled-json-output');
    const previewEl = document.getElementById('crawled-preview-container');
    const historyList = document.getElementById('crawled-history-list');
    const submitBtn = document.getElementById('crawler-submit-btn');

    function renderHistory() {
      const history = getCrawledHistory();
      if (!historyList) return;
      if (history.length === 0) {
        historyList.innerHTML = '<p style="color: var(--text-muted); font-size: 13.5px;">Chưa có bài viết nào được crawl trong phiên này.</p>';
        return;
      }
      historyList.innerHTML = history.map((item) => `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px;">
          <div>
            <div style="font-size: 12px; color: var(--brand-green); font-weight: 700;">[${item.category}] • ${item.publishedAt}</div>
            <div style="font-size: 15px; font-weight: 700;">${item.title}</div>
            <div style="font-size: 12.5px; color: var(--text-muted);">Tác giả: ${item.author} • ID: <code>${item.id}</code></div>
          </div>
          <a href="./index.html#post=${encodeURIComponent(item.id)}" class="btn-sm primary">Xem trên Web ↗</a>
        </div>
      `).join('');
    }

    async function handleCrawl(targetUrl) {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang thu thập...';
      }
      try {
        const normalized = await crawlArticleByUrl(targetUrl);
        saveArticleToStorage(normalized);

        if (jsonOutput) {
          jsonOutput.textContent = JSON.stringify(normalized, null, 2);
        }

        if (previewEl) {
          previewEl.innerHTML = `
            <div style="margin-bottom: 12px;">
              <span style="font-size: 12px; font-weight: 700; color: var(--brand-green); background: var(--brand-green-light); padding: 2px 8px; border-radius: 4px;">
                ${normalized.category}
              </span>
              <h3 style="font-size: 18px; font-weight: 700; margin: 8px 0 4px;">${normalized.title}</h3>
              <div style="font-size: 12.5px; color: var(--text-muted);">Tác giả: <strong>${normalized.author}</strong> • Ngày đăng: <strong>${normalized.publishedAt}</strong></div>
              <p style="font-size: 14px; color: var(--text-secondary); margin: 8px 0;">${normalized.excerpt}</p>
            </div>
            <table class="field-table">
              <tr><th>post.id</th><td><code>${normalized.id}</code></td></tr>
              <tr><th>post.title</th><td>${normalized.title}</td></tr>
              <tr><th>post.slug</th><td><code>${normalized.slug}</code></td></tr>
              <tr><th>post.excerpt</th><td>${normalized.excerpt}</td></tr>
              <tr><th>post.author</th><td>${normalized.author}</td></tr>
              <tr><th>post.category</th><td>${normalized.category}</td></tr>
              <tr><th>post.publishedAt</th><td>${normalized.publishedAt}</td></tr>
              <tr><th>post.source</th><td>${normalized.source}</td></tr>
              <tr><th>post.url</th><td><a href="${normalized.url}" target="_blank" style="word-break: break-all; color: var(--brand-green);">${normalized.url}</a></td></tr>
            </table>
          `;
        }

        renderHistory();
      } catch (err) {
        alert(err.message || 'Lỗi khi crawl bài viết');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crawl & Lưu LocalStorage';
        }
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleCrawl(urlInput.value);
    });

    const footerCatList = document.getElementById('footer-categories-list');
    if (footerCatList && global.INITIAL_MENU_DATA && Array.isArray(global.INITIAL_MENU_DATA.menu)) {
      footerCatList.innerHTML = global.INITIAL_MENU_DATA.menu
        .filter((m) => m.type === 'category')
        .map((cat) => `<li><a href="./index.html#category=${encodeURIComponent(cat.id)}">${cat.title}</a></li>`)
        .join('');
    }

    const defaultSample = {
      id: SAMPLE_ARTICLE.id,
      title: SAMPLE_ARTICLE.title,
      slug: SAMPLE_ARTICLE.slug,
      excerpt: SAMPLE_ARTICLE.excerpt,
      content: SAMPLE_ARTICLE.content,
      author: SAMPLE_ARTICLE.author,
      category: SAMPLE_ARTICLE.category,
      publishedAt: SAMPLE_ARTICLE.publishedAt,
      source: SAMPLE_ARTICLE.source,
      url: SAMPLE_ARTICLE.url
    };
    saveArticleToStorage(defaultSample);
    if (jsonOutput) jsonOutput.textContent = JSON.stringify(defaultSample, null, 2);
    if (previewEl) {
      previewEl.innerHTML = `
        <div style="margin-bottom: 12px;">
          <span style="font-size: 12px; font-weight: 700; color: var(--brand-green); background: var(--brand-green-light); padding: 2px 8px; border-radius: 4px;">
            ${defaultSample.category}
          </span>
          <h3 style="font-size: 18px; font-weight: 700; margin: 8px 0 4px;">${defaultSample.title}</h3>
          <div style="font-size: 12.5px; color: var(--text-muted);">Tác giả: <strong>${defaultSample.author}</strong> • Ngày đăng: <strong>${defaultSample.publishedAt}</strong></div>
          <p style="font-size: 14px; color: var(--text-secondary); margin: 8px 0;">${defaultSample.excerpt}</p>
        </div>
        <table class="field-table">
          <tr><th>post.id</th><td><code>${defaultSample.id}</code></td></tr>
          <tr><th>post.title</th><td>${defaultSample.title}</td></tr>
          <tr><th>post.slug</th><td><code>${defaultSample.slug}</code></td></tr>
          <tr><th>post.excerpt</th><td>${defaultSample.excerpt}</td></tr>
          <tr><th>post.author</th><td>${defaultSample.author}</td></tr>
          <tr><th>post.category</th><td>${defaultSample.category}</td></tr>
          <tr><th>post.publishedAt</th><td>${defaultSample.publishedAt}</td></tr>
          <tr><th>post.source</th><td>${defaultSample.source}</td></tr>
          <tr><th>post.url</th><td><a href="${defaultSample.url}" target="_blank" style="word-break: break-all; color: var(--brand-green);">${defaultSample.url}</a></td></tr>
        </table>
      `;
    }
    renderHistory();
  }

  document.addEventListener('DOMContentLoaded', initCrawlerPage);

  global.crawlArticleByUrl = crawlArticleByUrl;
  global.DantriCrawler = {
    STORAGE_KEYS,
    SAMPLE_ARTICLE,
    crawlArticleByUrl,
    saveArticleToStorage,
    getStoredPosts,
    getCrawledHistory
  };
})(window);
