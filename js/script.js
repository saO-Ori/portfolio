"use strict";

/* =========================================================
  共通ユーティリティ
========================================================= */
const AppUtil = (() => {
  function isNarrow() {
    return window.matchMedia("(max-width: 1024px)").matches;
  }

  function debounce(fn, wait = 150) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function smoothScrollToY(target, ms = 260, cb) {
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const startY = window.scrollY || 0;
    const dist = target - startY;
    const t0 = performance.now();

    function step(now) {
      const p = Math.min(1, (now - t0) / ms);
      const y = startY + dist * easeOut(p);
      window.scrollTo(0, y);
      if (p < 1) requestAnimationFrame(step);
      else {
        window.scrollTo(0, Math.round(target));
        if (cb) cb();
      }
    }
    requestAnimationFrame(step);
  }

  return {
    isNarrow,
    debounce,
    smoothScrollToY,
  };
})();

/* =========================================================
  FV背景SVG：ランダム散布（FV復元用）
========================================================= */
const AppBackground = (() => {
  function scatterBackgroundShapes() {
    const root = document.querySelector(".background-shapes");
    const templates = Array.from(document.querySelectorAll(".js-shapeTemplate"));
    if (!root || templates.length === 0) return;

    // 既存クローン削除
    root.querySelectorAll('[data-clone="1"]').forEach((el) => el.remove());

    const COUNT_MD = 4;
    const COUNT_SM = 8;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const ringMin = Math.min(window.innerWidth, window.innerHeight) * 0.3;
    const ringMax = Math.min(window.innerWidth, window.innerHeight) * 0.48;

    const rand = (min, max) => Math.random() * (max - min) + min;

    const spawn = (tmpl, count) => {
      for (let i = 0; i < count; i++) {
        const node = tmpl.cloneNode(true);
        node.hidden = false;
        node.dataset.clone = "1";
        node.classList.remove("js-shapeTemplate");

        const ang = rand(0, Math.PI * 2);
        const r = rand(ringMin, ringMax);
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        const rot = rand(-35, 35);

        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;

        root.appendChild(node);
      }
    };

    const md = templates.find((t) => t.classList.contains("--svg-shape_md"));
    const sm = templates.find((t) => t.classList.contains("--svg-shape_sm"));
    if (md) spawn(md, COUNT_MD);
    if (sm) spawn(sm, COUNT_SM);
  }

  function setupRescatterOnResize() {
    window.addEventListener(
      "resize",
      AppUtil.debounce(() => scatterBackgroundShapes(), 150)
    );
  }

  return {
    scatterBackgroundShapes,
    setupRescatterOnResize,
  };
})();

/* =========================================================
  FV：スクロールダウン（クリック）
========================================================= */
const AppIntroScrollButton = (() => {
  function setupIntroScrollButton() {
    const scrollBtn = document.querySelector(".js-scrollDown");
    if (!scrollBtn) return;

    const fv = document.getElementById("fv");
    const about = document.getElementById("about");
    if (!fv) return;

    scrollBtn.addEventListener("click", (e) => {
      e.preventDefault();

      if (AppUtil.isNarrow()) {
        if (about) {
          about.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        AppUtil.smoothScrollToY(fv.offsetHeight, 300);
        return;
      }

      AppUtil.smoothScrollToY(fv.offsetHeight, 320);
    });
  }

  return {
    setupIntroScrollButton,
  };
})();

/* =========================================================
  PC専用：FV⇄ABOUT ワンショット（双方向）
========================================================= */
const AppIntroJump = (() => {
  function setupIntroJump() {
    if (AppUtil.isNarrow()) return;

    const fv = document.getElementById("fv");
    const root = document.getElementById("hscrollRoot");
    if (!fv || !root) return;

    const aboutTop = () => fv.offsetHeight;
    let locking = false;

    function goAbout() {
      if (locking) return;
      locking = true;
      AppUtil.smoothScrollToY(aboutTop(), 240, () => (locking = false));
    }

    function goFV() {
      if (locking) return;
      locking = true;
      AppUtil.smoothScrollToY(0, 240, () => (locking = false));
    }

    function handleWheel(e) {
      if (AppUtil.isNarrow()) return;
      if (locking) return;

      const y = window.scrollY || 0;

      // FVで少し下に回したらABOUTへ（ワンショット）
      const smallDown =
        e.deltaY > 0 && Math.abs(e.deltaY) < 220 && y < aboutTop() * 0.5;

      if (smallDown) {
        e.preventDefault();
        goAbout();
        return;
      }

      // ABOUT先頭付近で少し上に回したらFVへ戻す（ワンショット）
      const nearAboutHead = y >= aboutTop() - 40 && y <= aboutTop() + 40;
      const smallUp = e.deltaY < 0 && Math.abs(e.deltaY) < 220 && nearAboutHead;

      if (smallUp) {
        e.preventDefault();
        goFV();
      }
    }

    function handleKey(e) {
      if (locking) return;
      const y = window.scrollY || 0;

      const goDown =
        e.code === "PageDown" || e.code === "ArrowDown" || e.code === "Space";
      const goUp =
        e.code === "PageUp" ||
        e.code === "ArrowUp" ||
        (e.code === "Space" && e.shiftKey);

      if (goDown && y < aboutTop() * 0.5) {
        e.preventDefault();
        goAbout();
      } else if (goUp && y <= aboutTop() + 40 && y >= aboutTop() - 40) {
        e.preventDefault();
        goFV();
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKey, { passive: false });
  }

  return {
    setupIntroJump,
  };
})();

/* =========================================================
  横スクロール：ページャー完全制御（PC限定）
========================================================= */
const AppHorizontalPager = (() => {
  function setupHorizontalPager() {
    if (AppUtil.isNarrow()) return;

    // ---- DOM取得
    const root = document.querySelector(".js-hscrollRoot");
    const track = document.querySelector(".js-hscrollContent");
    if (!root || !track) return;

    const panels = Array.from(track.children);
    if (panels.length === 0) return;

    // UI（存在しない場合もあるので安全に）
    const nextBtn = document.querySelector(".js-nextPanel");
    const topBtn = document.querySelector(".js-returnTop");

    // ---- サイズ系
    const panelWidth = () => window.innerWidth;
    const totalWidth = () => panelWidth() * panels.length;

    let currentX = 0;
    let targetX = 0;
    let rafId = 0;

    const prefersReduce = window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    const lerp = (a, b, t) => a + (b - a) * t;

    function render() {
      if (prefersReduce) {
        track.style.transform = `translate3d(${-targetX}px,0,0)`;
        return;
      }
      currentX = lerp(currentX, targetX, 0.1);
      if (Math.abs(currentX - targetX) < 0.5) currentX = targetX;

      track.style.transform = `translate3d(${-currentX}px,0,0)`;

      if (currentX !== targetX) rafId = requestAnimationFrame(render);
    }

    function setTargetX(x) {
      const maxX = Math.max(0, totalWidth() - window.innerWidth);
      targetX = Math.max(0, Math.min(x, maxX));

      if (!prefersReduce) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(render);
      } else {
        render();
      }
    }

    let scrollLength = 0;

    function updateRootHeight() {
      scrollLength = Math.max(0, totalWidth() - window.innerWidth);
      root.style.height = `${scrollLength + window.innerHeight}px`;
    }

    // ---- ページャー制御（1操作=±1枚）
    let idx = 0;
    let lock = false;

    let pendingShowNextOnWorksSnap = false;
    let suppressIndicators = false;

    const lockMs = 640;
    const wheelThreshold = 140;
    let acc = 0;

    const clampIndex = (i) => Math.max(0, Math.min(i, panels.length - 1));

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function guessIndexFromProgress(progressed) {
      const pw = panelWidth();
      return clampIndex(Math.round(progressed / pw));
    }

    /* =======================================
      インジケーター制御
    ======================================= */
    function updateIndicators(progressed) {
      const pw = panelWidth();

      const contactIndex = panels.length - 1;
      const contactStart = pw * contactIndex;

      const inAfterFv = (window.scrollY || 0) >= root.offsetTop - 2;

      if (nextBtn) {
        const WORKS_VISIBLE_RATIO = 0.99;

        const worksIndex = panels.length - 2;
        const worksStart = pw * worksIndex;

        const showAt = worksStart + pw * (1 - WORKS_VISIBLE_RATIO);

        let shouldShowNext = inAfterFv && progressed < contactStart;

        const isBetweenWorksAndContact =
          progressed > worksStart && progressed < contactStart;

        if (shouldShowNext && isBetweenWorksAndContact) {
          shouldShowNext = progressed <= showAt;
        }

        nextBtn.classList.toggle("is-hidden", !shouldShowNext);
      }

      if (topBtn) {
        topBtn.classList.toggle("is-visible", inAfterFv);
      }
    }

    function gotoIndex(next) {
      idx = clampIndex(next);

      const top0 = root.offsetTop;
      const targetTop = Math.round(top0 + panelWidth() * idx);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo(0, targetTop);

        if (suppressIndicators || pendingShowNextOnWorksSnap) {
          suppressIndicators = false;
          pendingShowNextOnWorksSnap = false;
          updateIndicators(panelWidth() * idx);
        }
        return;
      }

      lock = true;

      const start = window.scrollY || 0;
      const dist = targetTop - start;
      const t0 = performance.now();
      const dur = 560;

      function step(now) {
        const p = Math.min(1, (now - t0) / dur);
        const y = start + dist * easeInOutCubic(p);
        window.scrollTo(0, y);

        if (p < 1) requestAnimationFrame(step);
        else {
          window.scrollTo(0, targetTop);

          if (suppressIndicators || pendingShowNextOnWorksSnap) {
            suppressIndicators = false;
            pendingShowNextOnWorksSnap = false;
            updateIndicators(panelWidth() * idx);
          }

          setTimeout(() => {
            lock = false;
          }, 0);
        }
      }

      requestAnimationFrame(step);
    }

    function gotoFV() {
      if (lock) return;
      lock = true;
      idx = 0;

      pendingShowNextOnWorksSnap = false;
      suppressIndicators = false;
      if (nextBtn) nextBtn.classList.add("is-hidden");

      AppUtil.smoothScrollToY(0, 260, () => {
        setTimeout(() => {
          lock = false;
        }, 0);
      });
    }

    function onScroll() {
      const rect = root.getBoundingClientRect();
      const progressed = Math.max(0, Math.min(scrollLength, -rect.top));
      setTargetX(progressed);

      if (!suppressIndicators) {
        updateIndicators(progressed);
      }

      if (!lock) {
        idx = guessIndexFromProgress(progressed);
      }
    }

    function handleWheel(e) {
      const r = root.getBoundingClientRect();
      const inZone =
        r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.5;
      if (!inZone) return;

      if (lock) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      acc += e.deltaY;

      if (acc <= -wheelThreshold && idx === 0) {
        acc = 0;
        gotoFV();
        return;
      }

      if (Math.abs(acc) >= wheelThreshold) {
        const dir = Math.sign(acc);
        acc = 0;

        const fromIdx = idx;
        const toIdx = idx + (dir > 0 ? 1 : -1);

        const contactIndex = panels.length - 1;
        const worksIndex = panels.length - 2;
        if (fromIdx === contactIndex && toIdx === worksIndex && dir < 0) {
          pendingShowNextOnWorksSnap = true;
          suppressIndicators = true;
          if (nextBtn) nextBtn.classList.add("is-hidden");
        } else {
          pendingShowNextOnWorksSnap = false;
          suppressIndicators = false;
        }

        gotoIndex(toIdx);
        lock = true;
        setTimeout(() => (lock = false), lockMs);
      }
    }

    function handleKey(e) {
      if (lock) return;

      const active = document.activeElement;
      if (active && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;

      const k = e.code;
      const next = k === "PageDown" || k === "ArrowDown" || k === "Space";
      const prev =
        k === "PageUp" || k === "ArrowUp" || (k === "Space" && e.shiftKey);

      if (prev && idx === 0) {
        e.preventDefault();
        gotoFV();
        return;
      }

      if (next || prev) {
        e.preventDefault();

        pendingShowNextOnWorksSnap = false;
        suppressIndicators = false;

        gotoIndex(idx + (next ? 1 : -1));
        lock = true;
        setTimeout(() => (lock = false), lockMs);
      }
    }

    function handleNextClick(e) {
      e.preventDefault();
      if (lock) return;

      pendingShowNextOnWorksSnap = false;
      suppressIndicators = false;

      gotoIndex(idx + 1);
      lock = true;
      setTimeout(() => (lock = false), lockMs);
    }

    function handleReturnClick(e) {
      e.preventDefault();

      if (!AppUtil.isNarrow()) {
        gotoFV();
        return;
      }

      AppUtil.smoothScrollToY(0, 320);
    }

    function onResize() {
      updateRootHeight();
      gotoIndex(idx);
    }

    // ---- 初期状態
    // FVではNEXTは隠す（CSSがis-hidden対応している前提）
    if (nextBtn) nextBtn.classList.add("is-hidden");
    if (topBtn) topBtn.classList.remove("is-visible");

    updateRootHeight();
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    window.addEventListener("keydown", handleKey, { passive: false });

    if (nextBtn) nextBtn.addEventListener("click", handleNextClick);
    if (topBtn) topBtn.addEventListener("click", handleReturnClick);
  }

  return {
    setupHorizontalPager,
  };
})();

/* =========================================================
  PROJECTS：Carousel（中央active + cloneループ）
========================================================= */
const AppProjectsCarousel = (() => {
  function setupProjectsCarousel() {
    const root = document.querySelector(".js-carousel");
    if (!root) return;

    const viewport = root.querySelector(".js-carouselViewport");
    const track = root.querySelector(".js-carouselTrack");
    const btnPrev = root.querySelector(".js-carouselPrev");
    const btnNext = root.querySelector(".js-carouselNext");
    if (!viewport || !track || !btnPrev || !btnNext) return;

    const originals = Array.from(track.querySelectorAll(".js-carouselItem"));
    if (originals.length < 2) return;

    let domIndex = 1;
    let lock = false;

    const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DUR = 260;

    // =========================================================
    // clone生成（先頭1 + 末尾1）
    // =========================================================
    function rebuildClones() {
      // 既存のcloneを削除
      track.querySelectorAll('[data-clone="1"]').forEach((el) => el.remove());

      // 末尾のclone（head側）
      const headClone = originals[originals.length - 1].cloneNode(true);
      headClone.dataset.clone = "1";

      // 先頭のclone（tail側）
      const tailClone = originals[0].cloneNode(true);
      tailClone.dataset.clone = "1";

      track.insertBefore(headClone, track.firstChild);
      track.appendChild(tailClone);
    }

    // DOM上の全アイテム（clone込み）
    function getAllItems() {
      return Array.from(track.querySelectorAll(".js-carouselItem"));
    }

    // =========================================================
    // 中央寄せ（要素中心基準）
    // =========================================================
    function centerToItem(el, withAnim = true) {
      if (!el) return;

      // viewport内側中心（padding込みでも clientWidth はOK）
      const vpCenter = viewport.clientWidth / 2;
      const itemCenter = el.offsetLeft + el.offsetWidth / 2;
      const x = itemCenter - vpCenter;

      track.style.transition = withAnim && !prefersReduce ? `transform ${DUR}ms ease` : "none";
      track.style.transform = `translate3d(${-x}px,0,0)`;
    }

    // active付与（cloneにも付く＝見た目の統一）
    function updateActive() {
      const all = getAllItems();
      all.forEach((el, i) => el.classList.toggle("is-active", i === domIndex));
    }

    // =========================================================
    // 移動（±1）
    // =========================================================
    function moveBy(delta) {
      if (lock) return;
      lock = true;

      root.classList.add("is-loopFixing");

      const all = getAllItems();
      const max = all.length - 1;

      domIndex += delta;

      domIndex = Math.max(0, Math.min(domIndex, max));
      updateActive();
      centerToItem(all[domIndex], true);

      const after = () => {
        const all2 = getAllItems();
        const max2 = all2.length - 1;

        if (domIndex === 0) {
          domIndex = originals.length;
          updateActive();
          centerToItem(all2[domIndex], false);
        } else if (domIndex === max2) {
          domIndex = 1;
          updateActive();
          centerToItem(all2[domIndex], false);
        }

        root.classList.remove("is-loopFixing");

        lock = false;
      };

      if (prefersReduce) {
        after();
        return;
      }

      let done = false;

      const onEnd = (e) => {
        if (done) return;
        if (e.propertyName !== "transform") return;
        done = true;
        track.removeEventListener("transitionend", onEnd);
        after();
      };

      track.addEventListener("transitionend", onEnd);

      window.setTimeout(() => {
        if (done) return;
        done = true;
        track.removeEventListener("transitionend", onEnd);
        after();
      }, DUR + 40);
    }

    // =========================================================
    // ドラッグ（リンク上は開始しない）
    // =========================================================
    const isInteractiveTarget = (el) => !!el.closest("a, button, input, textarea, select, label");

    let dragging = false;
    let startX = 0;
    let startTx = 0;

    function getTranslateX() {
      const tr = getComputedStyle(track).transform;
      if (!tr || tr === "none") return 0;
      const m = new DOMMatrixReadOnly(tr);
      return m.m41;
    }

    function onDown(clientX) {
      dragging = true;
      startX = clientX;
      startTx = getTranslateX();
      track.style.transition = "none";
    }

    function onMove(clientX) {
      if (!dragging) return;
      const dx = clientX - startX;
      track.style.transform = `translate3d(${startTx + dx}px,0,0)`;
    }

    function onUp(clientX) {
      if (!dragging) return;
      dragging = false;

      const dx = clientX - startX;

      const all = getAllItems();
      const card = all[domIndex];
      const cardW = card ? card.getBoundingClientRect().width : 320;
      const threshold = Math.min(90, cardW * 0.25);

      if (dx <= -threshold) moveBy(1);
      else if (dx >= threshold) moveBy(-1);
      else {
        updateActive();
        centerToItem(all[domIndex], true);
        lock = false;
      }
    }

    viewport.addEventListener("pointerdown", (e) => {
      if (isInteractiveTarget(e.target)) return;
      e.preventDefault();
      viewport.setPointerCapture(e.pointerId);
      onDown(e.clientX);
    });
    viewport.addEventListener("pointermove", (e) => onMove(e.clientX));
    viewport.addEventListener("pointerup", (e) => onUp(e.clientX));
    viewport.addEventListener("pointercancel", (e) => onUp(e.clientX));


    // =========================================================
    // ボタン / キー
    // =========================================================
    btnPrev.addEventListener("click", () => moveBy(-1));
    btnNext.addEventListener("click", () => moveBy(1));

    viewport.addEventListener("keydown", (e) => {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        moveBy(-1);
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        moveBy(1);
      }
    });


    // =========================================================
    // リサイズ：見た目の再センター
    // =========================================================
    window.addEventListener(
      "resize",
      AppUtil.debounce(() => {
        const all = getAllItems();
        updateActive();
        centerToItem(all[domIndex], false);
      }, 120),
      { passive: true }
    );

    // =========================================================
    // 初期化
    // =========================================================
    rebuildClones();

    domIndex = Math.floor(originals.length / 2) + 1;

    const all0 = getAllItems();
    updateActive();
    centerToItem(all0[domIndex], false);

    lock = false;
  }

  return { setupProjectsCarousel };
})();


/* =========================================================
  ABOUT可視でフッター表示
========================================================= */
const AppFooterReveal = (() => {
  function setupFooterRevealOnAbout() {
    const about = document.querySelector('[data-section="about"]');
    if (!about) return;

    const show = () => document.body.classList.add("is-footer-visible");
    const hide = () => document.body.classList.remove("is-footer-visible");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) show();
          else if (entry.boundingClientRect.top > 0) hide();
        });
      },
      { root: null, threshold: [0, 0.5, 1] }
    );

    io.observe(about);
  }

  return {
    setupFooterRevealOnAbout,
  };
})();

/* =========================================================
  初期化
========================================================= */
window.addEventListener("DOMContentLoaded", () => {
  // FV背景
  AppBackground.scatterBackgroundShapes();
  AppBackground.setupRescatterOnResize();

  // 横ページャー（PC）
  AppHorizontalPager.setupHorizontalPager();

  // フッター制御
  AppFooterReveal.setupFooterRevealOnAbout();

  // FV⇄ABOUT ワンショット（PC）
  AppIntroJump.setupIntroJump();

  // SCROLLクリック（SP/PC共通）
  AppIntroScrollButton.setupIntroScrollButton();

  // PROJECTS：カルーセル
  AppProjectsCarousel.setupProjectsCarousel();
});
