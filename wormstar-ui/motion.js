/* Wormstar Sentinel: progressive enhancement only. No credentials or API calls. */
(() => {
  'use strict';
  const GSAP = window.gsap;
  const Trigger = window.ScrollTrigger;
  const LenisCtor = window.Lenis;
  if (!GSAP || !Trigger || !LenisCtor) return;

  GSAP.registerPlugin(Trigger);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const candidates = '.feature, .stat-card, .ops-panel, .panel, .context-card';
  const noSmooth = '#wsTermOutput, .chat-history, .chat-compose, textarea, pre, .drawer, .sidebar, .context, [data-native-scroll]';
  let smooth = null;
  let ticker = null;
  let activePage = null;
  let timeline = null;
  let triggers = [];
  let scheduled = false;

  function stopSmoothScroll() {
    if (ticker) GSAP.ticker.remove(ticker);
    ticker = null;
    if (smooth) smooth.destroy();
    smooth = null;
  }

  function syncSmoothScroll() {
    stopSmoothScroll();
    // Preserve native touch scrolling on iPhone/iPad and users' reduced-motion preference.
    if (reduced.matches || !finePointer.matches) return;
    try {
      smooth = new LenisCtor({
        autoRaf: false,
        anchors: true,
        syncTouch: false,
        allowNestedScroll: true,
        prevent: node => Boolean(node?.closest?.(noSmooth))
      });
      smooth.on('scroll', Trigger.update);
      ticker = time => smooth.raf(time * 1000);
      GSAP.ticker.add(ticker);
      GSAP.ticker.lagSmoothing(0);
    } catch (error) {
      stopSmoothScroll();
      console.warn('Smooth scrolling disabled:', error);
    }
  }

  function resetAnimations() {
    if (timeline) timeline.kill();
    timeline = null;
    for (const trigger of triggers) trigger.kill();
    triggers = [];
    const previous = activePage;
    if (previous) {
      GSAP.killTweensOf(previous.querySelectorAll(candidates));
      GSAP.set(previous.querySelectorAll(candidates), {
        clearProps: 'opacity,visibility,transform'
      });
      const heading = previous.querySelector('.page-heading');
      if (heading) GSAP.set(heading, {clearProps:'opacity,visibility,transform'});
    }
  }

  function animateActivePage() {
    const page = document.querySelector('.page.active');
    if (!page || page === activePage) return;
    resetAnimations();
    activePage = page;
    if (smooth) smooth.scrollTo(0, { immediate: true });
    else window.scrollTo({top:0,behavior:'instant'});
    if (reduced.matches) {
      Trigger.refresh();
      return;
    }

    const heading = page.querySelector('.page-heading');
    const heroCopy = page.querySelector('.hero-copy');
    const entry = [heading, heroCopy].filter(Boolean);
    if (entry.length) {
      timeline = GSAP.fromTo(entry,
        {opacity:0,y:12},
        {opacity:1,y:0,duration:0.36,stagger:0.07,ease:'power2.out',
          clearProps:'opacity,transform',overwrite:true}
      );
    }

    // Subtle on-enter motion only; cards never start hidden when JS cannot load.
    const cards = Array.from(page.querySelectorAll(candidates)).slice(0,40);
    cards.forEach(card => {
      const trigger = Trigger.create({
        trigger:card,
        start:'top 96%',
        once:true,
        onEnter() {
          GSAP.fromTo(card,{opacity:0,y:10},
            {opacity:1,y:0,duration:0.34,ease:'power2.out',
              clearProps:'opacity,transform',overwrite:true});
        }
      });
      triggers.push(trigger);
    });
    Trigger.refresh();
  }

  function scheduleActivePage() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      animateActivePage();
    });
  }

  // Existing Wormstar navigation toggles .page.active. Observe that contract
  // instead of replacing navigation, authentication, or router code.
  const main = document.querySelector('.main');
  if (!main) return;
  const observer = new MutationObserver(records => {
    if (records.some(r => r.target?.classList?.contains('page'))) scheduleActivePage();
  });
  observer.observe(main,{subtree:true,attributes:true,attributeFilter:['class']});

  // Spotlight-card interaction: CSS-only fallback, no React runtime added.
  if (finePointer.matches && !reduced.matches) {
    main.addEventListener('pointermove', event => {
      const card = event.target.closest?.('.feature, .stat-card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', (event.clientX - rect.left) + 'px');
      card.style.setProperty('--spot-y', (event.clientY - rect.top) + 'px');
    }, {passive:true});
  }

  function onPreferenceChange() {
    resetAnimations();
    activePage = null;
    syncSmoothScroll();
    scheduleActivePage();
  }
  reduced.addEventListener?.('change',onPreferenceChange);
  finePointer.addEventListener?.('change',onPreferenceChange);
  syncSmoothScroll();
  document.documentElement.dataset.motionReady = 'true';
  scheduleActivePage();

  window.addEventListener('pagehide', () => {
    observer.disconnect();
    resetAnimations();
    stopSmoothScroll();
    reduced.removeEventListener?.('change',onPreferenceChange);
    finePointer.removeEventListener?.('change',onPreferenceChange);
  }, {once:true});
})();
