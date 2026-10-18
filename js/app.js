(function () {
  const STORAGE_KEYS = {
    MENU: 'dantri_menu_v4',
    POSTS: 'dantri_posts_v4'
  };

  const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80';

  const state = {
    menu: [],
    posts: [],
    activeCategoryId: 'home',
    activeSubCategoryId: null,
    activePostId: null,
    currentView: 'category'
  };

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadData() {
    try {
      localStorage.removeItem('dantri_menu');
      localStorage.removeItem('dantri_posts');
      localStorage.removeItem('dantri_menu_v2');
      localStorage.removeItem('dantri_posts_v2');
      localStorage.removeItem('dantri_menu_v3');
      localStorage.removeItem('dantri_posts_v3');
    } catch (_) {}

    let storedMenu = null;
    try {
      const rawMenu = localStorage.getItem(STORAGE_KEYS.MENU);
      if (rawMenu) {
        const parsed = JSON.parse(rawMenu);
        if (parsed && Array.isArray(parsed.menu) && parsed.menu.length > 0) {
          storedMenu = parsed.menu;
        }
      }
    } catch (_) {}

    if (!storedMenu && window.INITIAL_MENU_DATA && Array.isArray(window.INITIAL_MENU_DATA.menu)) {
      storedMenu = window.INITIAL_MENU_DATA.menu;
      try {
        localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify({ menu: storedMenu }));
      } catch (_) {}
    }
    state.menu = storedMenu || [];

    let storedPosts = null;
    try {
      const rawPosts = localStorage.getItem(STORAGE_KEYS.POSTS);
      if (rawPosts && !rawPosts.includes('cdnphoto.dantri.com.vn') && !rawPosts.includes('\uBCF5')) {
        const parsed = JSON.parse(rawPosts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          storedPosts = parsed;
        }
      }
    } catch (_) {}

    if (!storedPosts && Array.isArray(window.INITIAL_POSTS_DATA)) {
      storedPosts = window.INITIAL_POSTS_DATA;
      try {
        localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(storedPosts));
      } catch (_) {}
    }
    state.posts = storedPosts || [];
  }

  function renderNavbar() {
    const navList = document.getElementById('main-nav-list');
    if (!navList) return;

    navList.innerHTML = state.menu
      .map((item) => {
        const isActive = state.activeCategoryId === item.id && state.currentView === 'category';
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;

        if (item.type === 'home') {
          return `
            <li class="nav-item ${isActive ? 'active' : ''}">
              <a class="nav-link" href="#category=${escapeHtml(item.id)}" aria-label="Home" title="Home">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z"></path>
                  <path d="M9 21V14h6v7"></path>
                </svg>
              </a>
            </li>
          `;
        }

        const submenuHtml = hasChildren
          ? `<ol class="nav-submenu">
              ${item.children
                .map(
                  (child) => `
                  <li>
                    <a href="#category=${escapeHtml(item.id)}&sub=${escapeHtml(child.id)}"
                       class="${state.activeSubCategoryId === child.id ? 'active' : ''}">
                      ${escapeHtml(child.title)}
                    </a>
                  </li>
                `
                )
                .join('')}
            </ol>`
          : '';

        return `
          <li class="nav-item ${isActive ? 'active' : ''}">
            <a class="nav-link" href="#category=${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>
            ${submenuHtml}
          </li>
        `;
      })
      .join('');

    const footerCatList = document.getElementById('footer-categories-list');
    if (footerCatList) {
      footerCatList.innerHTML = state.menu
        .filter((m) => m.type === 'category')
        .map(
          (cat) => `
          <li><a href="#category=${escapeHtml(cat.id)}">${escapeHtml(cat.title)}</a></li>
        `
        )
        .join('');
    }
  }

  function getFilteredPosts() {
    let list = [...state.posts];

    if (state.activeCategoryId && state.activeCategoryId !== 'home') {
      const currentCatObj = state.menu.find((m) => m.id === state.activeCategoryId);
      const currentCatTitle = currentCatObj ? currentCatObj.title.toLowerCase() : '';

      list = list.filter((p) => {
        const matchCatId = p.categoryId === state.activeCategoryId;
        const matchCatTitle =
          (typeof p.category === 'string' && p.category.toLowerCase() === currentCatTitle) ||
          (Array.isArray(p.category) && p.category.some((c) => c.toLowerCase() === currentCatTitle));
        return matchCatId || matchCatTitle;
      });

      if (state.activeSubCategoryId && currentCatObj?.children) {
        const subObj = currentCatObj.children.find((c) => c.id === state.activeSubCategoryId);
        if (subObj) {
          const subMatches = list.filter(
            (p) =>
              p.subCategoryId === subObj.id ||
              (p.url && p.url.includes(`/${subObj.id}`)) ||
              (Array.isArray(p.category) &&
                p.category.some((c) => c.toLowerCase() === subObj.title.toLowerCase()))
          );
          if (subMatches.length > 0) {
            list = subMatches;
          }
        }
      }
    }

    const uniqueMap = new Map();
    for (const p of list) {
      if (!uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    }
    const uniqueList = [...uniqueMap.values()];

    uniqueList.sort((a, b) => {
      const tA = new Date(String(a.publishedAt || '').replace(' ', 'T')).getTime() || 0;
      const tB = new Date(String(b.publishedAt || '').replace(' ', 'T')).getTime() || 0;
      return tB - tA;
    });

    return uniqueList;
  }

  function getDisplayCategory(post) {
    if (Array.isArray(post.category)) return post.category[0] || 'Tin tức';
    return post.category || 'Tin tức';
  }

  function getDisplayAuthor(post) {
    if (post.author && typeof post.author === 'object') {
      return post.author.name || 'Phóng viên Dân trí';
    }
    return post.author || 'Phóng viên Dân trí';
  }

  function getPostImage(post) {
    if (post && post.image && !post.image.includes('cdnphoto.dantri.com.vn')) {
      return post.image;
    }
    if (post && post.thumbnail && !post.thumbnail.includes('cdnphoto.dantri.com.vn')) {
      return post.thumbnail;
    }
    return DEFAULT_IMAGE;
  }

  function renderCategoryView() {
    const mainEl = document.getElementById('app-main-content');
    if (!mainEl) return;

    const currentCat = state.menu.find((m) => m.id === state.activeCategoryId) || {
      id: 'home',
      title: 'Home',
      children: []
    };

    const posts = getFilteredPosts();
    const headerTitle = currentCat.id === 'home' ? 'Trang chủ' : currentCat.title;

    const subCategoriesHtml =
      Array.isArray(currentCat.children) && currentCat.children.length > 0
        ? `<ul class="category-subnav">
            <li>
              <a href="#category=${escapeHtml(currentCat.id)}" class="${!state.activeSubCategoryId ? 'active' : ''}">
                Tất cả
              </a>
            </li>
            ${currentCat.children
              .map(
                (child) => `
                <li>
                  <a href="#category=${escapeHtml(currentCat.id)}&sub=${escapeHtml(child.id)}"
                     class="${state.activeSubCategoryId === child.id ? 'active' : ''}">
                    ${escapeHtml(child.title)}
                  </a>
                </li>
              `
              )
              .join('')}
          </ul>`
        : '';

    if (posts.length === 0) {
      mainEl.innerHTML = `
        <section class="category-header-section">
          <div class="category-header-top">
            <h1 class="category-main-title">${escapeHtml(headerTitle)}</h1>
          </div>
          ${subCategoriesHtml}
        </section>
        <div style="padding: 48px 0; text-align: center; color: var(--text-muted);">
          <p>Không có bài viết nào trong chuyên mục này.</p>
        </div>
      `;
      return;
    }

    const featuredPost = posts[0];
    const sidePosts = posts.slice(1, 3);
    const remainingPosts = posts.slice(3);

    mainEl.innerHTML = `
      <section class="category-header-section">
        <div class="category-header-top">
          <h1 class="category-main-title">${escapeHtml(headerTitle)}</h1>
        </div>
        ${subCategoriesHtml}
      </section>

      <section class="top-featured-section">
        <div class="top-featured-grid">
          <article class="featured-post-card" data-post-id="${escapeHtml(featuredPost.id)}">
            <div class="featured-post-thumb">
              <img src="${escapeHtml(getPostImage(featuredPost))}" alt="${escapeHtml(featuredPost.title)}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
            </div>
            <h2 class="featured-post-title">${escapeHtml(featuredPost.title)}</h2>
            <p class="featured-post-excerpt">${escapeHtml(featuredPost.excerpt)}</p>
          </article>

          <div class="grid-SavedDivider"></div>

          <div class="side-posts-column">
            ${sidePosts
              .map(
                (post) => `
                <article class="side-post-card" data-post-id="${escapeHtml(post.id)}">
                  <div class="side-post-thumb">
                    <img src="${escapeHtml(getPostImage(post))}" alt="${escapeHtml(post.title)}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
                  </div>
                  <h3 class="side-post-title">${escapeHtml(post.title)}</h3>
                </article>
              `
              )
              .join('')}
          </div>
        </div>
      </section>

      <section class="article-list-section">
        <div class="article-list">
          ${remainingPosts
            .map(
              (post) => `
              <article class="article-list-item" data-post-id="${escapeHtml(post.id)}">
                <div class="article-list-thumb">
                  <img src="${escapeHtml(getPostImage(post))}" alt="${escapeHtml(post.title)}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
                </div>
                <div class="article-list-body">
                  <h3 class="article-list-title">${escapeHtml(post.title)}</h3>
                  <p class="article-list-excerpt">${escapeHtml(post.excerpt)}</p>
                </div>
              </article>
            `
            )
            .join('')}
        </div>
      </section>
    `;

    mainEl.querySelectorAll('[data-post-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const postId = card.getAttribute('data-post-id');
        if (postId) {
          window.location.hash = `#post=${encodeURIComponent(postId)}`;
        }
      });
    });
  }

  function renderArticleDetailView(postId) {
    const mainEl = document.getElementById('app-main-content');
    if (!mainEl) return;

    const post = state.posts.find((p) => p.id === postId || p.slug === postId);
    if (!post) {
      mainEl.innerHTML = `
        <div class="article-detail-wrapper" style="text-align: center;">
          <h2>Không tìm thấy bài viết</h2>
          <button class="back-btn" id="detail-back-btn" style="margin-top: 16px;">Quay lại danh sách</button>
        </div>
      `;
      document.getElementById('detail-back-btn')?.addEventListener('click', () => {
        window.location.hash = state.activeCategoryId ? `#category=${encodeURIComponent(state.activeCategoryId)}` : '#category=home';
      });
      return;
    }

    const authorName = getDisplayAuthor(post);
    const categoryName = getDisplayCategory(post);
    const imageUrl = getPostImage(post);
    const paragraphs = String(post.content || post.excerpt || '')
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    mainEl.innerHTML = `
      <article class="article-detail-wrapper">
        <div class="detail-top-bar">
          <button class="back-btn" id="detail-back-btn" type="button">
            ← Quay lại danh sách
          </button>
          <div style="font-size: 13px; font-weight: 600; color: var(--brand-green);">
            Chuyên mục: ${escapeHtml(categoryName)}
          </div>
        </div>

        <h1 class="detail-title">${escapeHtml(post.title)}</h1>

        <div class="detail-meta-bar">
          <div><strong>Tác giả:</strong> ${escapeHtml(authorName)}</div>
          <div><strong>Thời gian đăng:</strong> ${escapeHtml(post.publishedAt)}</div>
          <div><strong>Chuyên mục:</strong> ${escapeHtml(categoryName)}</div>
        </div>

        ${
          imageUrl
            ? `<figure class="detail-main-figure">
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(post.title)}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
              </figure>`
            : ''
        }

        <div class="detail-content">
          ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      </article>
    `;

    document.getElementById('detail-back-btn')?.addEventListener('click', () => {
      if (state.activeCategoryId) {
        window.location.hash = `#category=${encodeURIComponent(state.activeCategoryId)}`;
      } else {
        window.location.hash = '#category=home';
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleRouteChange() {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);

    if (params.has('post')) {
      state.currentView = 'detail';
      state.activePostId = params.get('post');
      renderNavbar();
      renderArticleDetailView(state.activePostId);
      return;
    }

    state.currentView = 'category';
    state.activePostId = null;
    if (params.has('category')) {
      state.activeCategoryId = params.get('category') || 'home';
      state.activeSubCategoryId = params.get('sub') || null;
    }

    renderNavbar();
    renderCategoryView();
  }

  function setupEventListeners() {
    window.addEventListener('hashchange', handleRouteChange);

    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navList = document.getElementById('main-nav-list');
    if (mobileBtn && navList) {
      mobileBtn.addEventListener('click', () => {
        navList.classList.toggle('mobile-open');
      });
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEYS.POSTS) {
        try {
          state.posts = JSON.parse(e.newValue || '[]');
          if (state.currentView === 'category') renderCategoryView();
        } catch (_) {}
      }
    });
  }

  function initApp() {
    loadData();
    setupEventListeners();
    handleRouteChange();
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
