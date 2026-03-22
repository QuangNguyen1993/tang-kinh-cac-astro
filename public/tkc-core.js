(function () {
  const CACHE_KEYS = {
    truyen: "tkc_truyen_cache_v2",
    me: "tkc_me_cache_v1",
  };

  const CACHE_TTL = {
    truyen: 1000 * 60 * 10,
    me: 1000 * 60 * 5,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function stableSerialize(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  function setViewState(state, map) {
    const { loading, error, empty, content } = map;

    if (loading) loading.classList.toggle("hidden", state !== "loading");
    if (error) error.classList.toggle("hidden", state !== "error");
    if (empty) empty.classList.toggle("hidden", state !== "empty");
    if (content) content.classList.toggle("hidden", state !== "content");
  }

  function readCache(key, ttl) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;

      const age = Date.now() - Number(parsed.cached_at || 0);
      if (!Number.isFinite(age) || age > ttl) return null;

      return parsed.data ?? null;
    } catch {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          data,
          cached_at: Date.now(),
        })
      );
    } catch {}
  }

  function removeCache(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  function readTruyenCache() {
    return readCache(CACHE_KEYS.truyen, CACHE_TTL.truyen);
  }

  function writeTruyenCache(items) {
    writeCache(CACHE_KEYS.truyen, items);
  }

  function readMeCache() {
    return readCache(CACHE_KEYS.me, CACHE_TTL.me);
  }

  function writeMeCache(user) {
    writeCache(CACHE_KEYS.me, user);
  }

  function clearMeCache() {
    removeCache(CACHE_KEYS.me);
  }

  function sortByUpdatedAtDesc(arr) {
    return [...arr].sort((a, b) => {
      const timeA = new Date(a?.updated_at || a?.created_at || 0).getTime();
      const timeB = new Date(b?.updated_at || b?.created_at || 0).getTime();
      return timeB - timeA;
    });
  }

  function filterTruyenItems(items, options) {
    const opts = options || {};
    const section = opts.section || "";
    const theLoai = opts.theLoai || "";

    let listItems = sortByUpdatedAtDesc(items);

    if (section === "hom-nay") {
      listItems = sortByUpdatedAtDesc(items);
    } else if (section === "hot") {
      listItems = sortByUpdatedAtDesc(
        items.filter((item) => Number(item?.is_hot) === 1)
      );
    } else if (theLoai) {
      listItems = sortByUpdatedAtDesc(
        items.filter((item) => (item?.the_loai || "").trim() === theLoai)
      );
    }

    return listItems;
  }

  function buildHomeSections(items, genreSections) {
    const homNayNgheGi = sortByUpdatedAtDesc(items).slice(0, 12);

    const congPhapNoiBat = sortByUpdatedAtDesc(
      items.filter((item) => Number(item?.is_hot) === 1)
    ).slice(0, 12);

    const genreData = genreSections
      .map((section) => {
        const sectionItems = sortByUpdatedAtDesc(
          items.filter((item) => (item?.the_loai || "").trim() === section.key)
        ).slice(0, 8);

        return {
          ...section,
          items: sectionItems,
        };
      })
      .filter((section) => section.items.length > 0);

    return { homNayNgheGi, congPhapNoiBat, genreData };
  }

  function renderStoryCard(item, className, thumbClass, eager) {
    const isEager = Boolean(eager);
    const loadingAttr = isEager
      ? 'loading="eager" fetchpriority="high"'
      : 'loading="lazy"';

    return `
      <a href="/truyen/${encodeURIComponent(item.ma_truyen)}" class="${className}">
        <img
          class="${thumbClass}"
          src="${escapeHtml(item.anh_bia || "/fallback.webp")}"
          alt="${escapeHtml(item.ten_truyen || "Truyện")}"
          ${loadingAttr}
          onerror="this.onerror=null;this.src='/fallback.webp';"
        />
      </a>
    `;
  }

  function renderGridSection(config) {
    const titleClass = config.subtle ? "section-title subtle" : "section-title";
    const eagerCount = Number(config.eagerCount || 0);

    return `
      <section class="section">
        <div class="section-header">
          <h2 class="${titleClass}">
            <span class="section-icon">${config.icon}</span>
            <span>${escapeHtml(config.title)}</span>
          </h2>
          <a href="${config.href}" class="see-all">Xem tất cả &gt;</a>
        </div>

        <div class="grid-two">
          ${config.items
            .map((item, index) =>
              renderStoryCard(item, "story-card", "story-thumb", index < eagerCount)
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderStripSection(sectionData) {
    return `
      <section class="section">
        <div class="section-header">
          <h2 class="section-title subtle">
            <span class="section-icon">${sectionData.icon}</span>
            <span>${escapeHtml(sectionData.title)}</span>
          </h2>
          <a
            href="/tat-ca?the_loai=${encodeURIComponent(sectionData.key)}"
            class="see-all minimal"
          >
            Xem tất cả &gt;
          </a>
        </div>

        <div class="story-strip">
          ${sectionData.items
            .map((item) => renderStoryCard(item, "strip-card", "strip-thumb", false))
            .join("")}
        </div>
      </section>
    `;
  }

  function renderTatCaList(items) {
    return items
      .map(
        (item) => `
          <a class="item" href="/truyen/${encodeURIComponent(item.ma_truyen)}">
            <img
              class="thumb"
              src="${escapeHtml(item.anh_bia || "/fallback.webp")}"
              alt="${escapeHtml(item.ten_truyen || "Truyện")}"
              loading="lazy"
              onerror="this.onerror=null;this.src='/fallback.webp';"
            />
            <div class="meta">
              <p class="name">${escapeHtml(item.ten_truyen || "")}</p>
            </div>
            <div class="arrow">&rsaquo;</div>
          </a>
        `
      )
      .join("");
  }

  function renderEpisodeList(items) {
    return items
      .map(
        (tap) => `
          <div class="episode-item" data-episode-item data-ma-tap="${escapeHtml(tap.ma_tap)}">
            <div class="episode-left">
              <p class="episode-name">${escapeHtml(tap.ten_tap)}</p>
              <div class="episode-sub">
                <span class="badge" data-progress-badge="${escapeHtml(tap.ma_tap)}">
                  Chưa nghe
                </span>
                <span
                  class="badge active"
                  data-active-badge="${escapeHtml(tap.ma_tap)}"
                  style="display:none;"
                >
                  Đang nghe
                </span>
              </div>
            </div>

            <button
              class="episode-btn"
              type="button"
              data-ma-tap="${escapeHtml(tap.ma_tap)}"
              data-ten-tap="${escapeHtml(tap.ten_tap)}"
            >
              Phát
            </button>
          </div>
        `
      )
      .join("");
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function isValidDate(value) {
    if (!value) return false;
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
  }

  function fadeTextSwap(elements, callback) {
    const els = (elements || []).filter(Boolean);
    els.forEach((el) => (el.style.opacity = "0.7"));

    requestAnimationFrame(() => {
      callback();
      requestAnimationFrame(() => {
        els.forEach((el) => (el.style.opacity = "1"));
      });
    });
  }

  function createProgressStore(config) {
    let userId = config.userId || "guest";
    let truyenId = config.truyenId || "";

    function setUserId(nextUserId) {
      userId = nextUserId || "guest";
    }

    function getProgressKey(maTap) {
      return `tangkinhcac_progress_${userId}_${truyenId}_${maTap}`;
    }

    function getLastTrackKey() {
      return `tangkinhcac_last_track_${userId}_${truyenId}`;
    }

    function readProgress(maTap) {
      try {
        const raw = localStorage.getItem(getProgressKey(maTap));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
      } catch {
        return null;
      }
    }

    function clearProgress(maTap) {
      try {
        localStorage.removeItem(getProgressKey(maTap));
      } catch {}
    }

    function writeProgress(maTap, tenTap, currentTime, duration) {
      try {
        const safeCurrent = Number(currentTime || 0);
        const safeDuration = Number(duration || 0);

        if (
          Number.isFinite(safeDuration) &&
          safeDuration > 0 &&
          safeCurrent >= safeDuration - 10
        ) {
          clearProgress(maTap);
          localStorage.setItem(
            getLastTrackKey(),
            JSON.stringify({
              ma_tap: maTap,
              ten_tap: tenTap,
              updated_at: Date.now(),
              finished: true,
            })
          );
          return;
        }

        localStorage.setItem(
          getProgressKey(maTap),
          JSON.stringify({
            ma_tap: maTap,
            ten_tap: tenTap,
            current_time: safeCurrent,
            duration: safeDuration,
            updated_at: Date.now(),
          })
        );

        localStorage.setItem(
          getLastTrackKey(),
          JSON.stringify({
            ma_tap: maTap,
            ten_tap: tenTap,
            updated_at: Date.now(),
            finished: false,
          })
        );
      } catch {}
    }

    function readLastTrack() {
      try {
        const raw = localStorage.getItem(getLastTrackKey());
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }

    return {
      setUserId,
      getProgressKey,
      getLastTrackKey,
      readProgress,
      clearProgress,
      writeProgress,
      readLastTrack,
    };
  }

  window.TKC = {
    CACHE_KEYS,
    CACHE_TTL,
    escapeHtml,
    stableSerialize,
    setViewState,
    readCache,
    writeCache,
    removeCache,
    readTruyenCache,
    writeTruyenCache,
    readMeCache,
    writeMeCache,
    clearMeCache,
    sortByUpdatedAtDesc,
    filterTruyenItems,
    buildHomeSections,
    renderStoryCard,
    renderGridSection,
    renderStripSection,
    renderTatCaList,
    renderEpisodeList,
    formatTime,
    isValidDate,
    fadeTextSwap,
    createProgressStore,
  };
})();