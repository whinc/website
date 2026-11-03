(function () {
  document.documentElement.classList.add("js-reveal");

  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var stageTitleNodes = Array.prototype.slice.call(
    document.querySelectorAll(
      ".stage-foot [data-stage-title], .mobile-stage-foot [data-stage-title]",
    ),
  );
  var stageNoteNodes = Array.prototype.slice.call(
    document.querySelectorAll(
      ".stage-foot [data-stage-note], .mobile-stage-foot [data-stage-note]",
    ),
  );
  var stages = Array.prototype.slice.call(
    document.querySelectorAll("[data-stage]"),
  );

  function preload(src) {
    if (!src) return;
    var img = new Image();
    img.src = src;
  }

  function setStage(stage, shot, alt) {
    var images = stage.querySelectorAll(".shot");
    if (!images.length) return;
    var current = stage.querySelector(".shot.is-active");
    var next = images[0] === current ? images[1] : images[0];
    if (!next) return;
    var loader = new Image();
    loader.onload = function () {
      next.src = shot;
      next.alt = alt || "";
      next.classList.add("is-active");
      if (current) current.classList.remove("is-active");
    };
    loader.src = shot;
  }

  function applyStage(shot, title, note, alt) {
    stageTitleNodes.forEach(function (node) {
      node.textContent = title;
    });
    stageNoteNodes.forEach(function (node) {
      node.textContent = note;
    });
    stages.forEach(function (stage) {
      setStage(stage, shot, alt);
    });
  }

  function syncChips(title) {
    var match = null;
    chips.forEach(function (item) {
      if (item.getAttribute("data-title") === title) match = item;
    });
    if (!match) return;
    chips.forEach(function (item) {
      item.setAttribute("aria-pressed", item === match ? "true" : "false");
    });
  }

  function readStageData(source) {
    return {
      shot:
        source.getAttribute("data-shot") ||
        source.getAttribute("data-stage-shot"),
      title:
        source.getAttribute("data-title") ||
        source.getAttribute("data-stage-title") ||
        "",
      note:
        source.getAttribute("data-note") ||
        source.getAttribute("data-stage-note") ||
        "",
      alt:
        source.getAttribute("data-alt") ||
        source.getAttribute("data-stage-alt") ||
        "",
    };
  }

  function activate(source) {
    var data = readStageData(source);
    applyStage(data.shot, data.title, data.note, data.alt);
    syncChips(data.title);
  }

  function preloadOnIntent(node) {
    node.addEventListener(
      "pointerenter",
      function () {
        preload(node.getAttribute("data-shot"));
      },
      { passive: true },
    );
    node.addEventListener("focus", function () {
      preload(node.getAttribute("data-shot"));
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      activate(chip);
    });
    preloadOnIntent(chip);
  });

  var toolLinks = Array.prototype.slice.call(
    document.querySelectorAll(".tool-link"),
  );
  toolLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      activate(link);
    });
    preloadOnIntent(link);
  });

  // Desktop stage follows the section in view.
  var stageSections = Array.prototype.slice.call(
    document.querySelectorAll("[data-stage-shot]"),
  );
  if (
    "IntersectionObserver" in window &&
    window.matchMedia("(min-width: 821px)").matches
  ) {
    var stageObserver = new IntersectionObserver(
      function (entries) {
        if (window.innerWidth < 821) return;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          activate(entry.target);
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stageSections.forEach(function (section) {
      stageObserver.observe(section);
    });
  }

  var copyButton = document.getElementById("copy-name");
  var copyStatus = document.getElementById("copy-status");
  var copyTimer;

  function copyDone(ok) {
    copyStatus.textContent = ok
      ? "已复制，去微信搜一搜"
      : "请手动搜索「小而美工具」";
    copyButton.textContent = ok ? "已复制" : "请手动搜索「小而美工具」";
    clearTimeout(copyTimer);
    copyTimer = setTimeout(function () {
      copyButton.textContent = "复制名称，去微信搜";
    }, 2400);
  }

  function copyFallback(done) {
    var field = document.createElement("textarea");
    field.value = "小而美工具";
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(field);
    done(ok);
  }

  function copyName(done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText("小而美工具")
        .then(function () {
          done(true);
        })
        .catch(function () {
          copyFallback(done);
        });
    } else {
      copyFallback(done);
    }
  }

  if (copyButton && copyStatus) {
    copyButton.addEventListener("click", function () {
      copyName(copyDone);
    });
  }

  var heroCopy = document.getElementById("copy-hero");
  var heroStatus = document.getElementById("copy-hero-status");
  var heroTimer;

  function heroDone(ok) {
    heroStatus.textContent = ok
      ? "已复制，去微信搜一搜"
      : "复制失败，请手动搜索「小而美工具」";
    heroCopy.textContent = ok ? "已复制" : "复制失败";
    clearTimeout(heroTimer);
    heroTimer = setTimeout(function () {
      heroCopy.textContent = "复制名称";
    }, 2400);
  }

  if (heroCopy && heroStatus) {
    heroCopy.addEventListener("click", function () {
      copyName(heroDone);
    });
  }

  var modal = document.querySelector("[data-mini-modal]");
  if (modal) {
    var modalCard = modal.querySelector(".mini-modal-card");
    var modalStatus = modal.querySelector(".mini-modal-status");
    var copyMini = modal.querySelector("[data-copy-mini]");
    var lastTrigger = null;

    var resetMiniStatus = function () {
      modalStatus.textContent = "";
      copyMini.textContent = "复制名称";
      copyMini.classList.remove("is-error");
    };

    var openMini = function (trigger) {
      lastTrigger = trigger || null;
      if (lastTrigger) lastTrigger.setAttribute("aria-expanded", "true");
      resetMiniStatus();
      modal.hidden = false;
      document.documentElement.style.overflow = "hidden";
      modalCard.focus();
    };

    var closeMini = function () {
      if (modal.hidden) return;
      modal.hidden = true;
      document.documentElement.style.overflow = "";
      resetMiniStatus();
      if (lastTrigger) {
        lastTrigger.setAttribute("aria-expanded", "false");
        lastTrigger.focus();
      }
      lastTrigger = null;
    };

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-open-mini]"),
      function (trigger) {
        trigger.addEventListener("click", function () {
          openMini(trigger);
        });
      },
    );

    Array.prototype.forEach.call(
      modal.querySelectorAll("[data-close-mini]"),
      function (button) {
        button.addEventListener("click", closeMini);
      },
    );

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMini();
    });

    // Keep Tab inside the dialog while it is open.
    modal.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      var focusables = modalCard.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var active = document.activeElement;
      if (event.shiftKey && (active === first || active === modalCard)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });

    copyMini.addEventListener("click", function () {
      copyName(function (ok) {
        if (ok) {
          modalStatus.textContent = "已复制，去微信搜一搜";
          copyMini.textContent = "已复制";
          copyMini.classList.remove("is-error");
        } else {
          modalStatus.textContent = "复制失败，请手动搜索「小而美工具」";
          copyMini.textContent = "复制失败";
          copyMini.classList.add("is-error");
        }
      });
    });
  }

  Array.prototype.forEach.call(
    document.querySelectorAll("[data-reveal-group]"),
    function (group) {
      var items = group.querySelectorAll("[data-reveal]");
      Array.prototype.forEach.call(items, function (item, index) {
        item.style.setProperty("--d", index * 70 + "ms");
      });
    },
  );

  var revealNodes = Array.prototype.slice.call(
    document.querySelectorAll("[data-reveal]"),
  );
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    revealNodes.forEach(function (node) {
      observer.observe(node);
    });
  } else {
    revealNodes.forEach(function (node) {
      node.classList.add("is-in");
    });
  }

  var host = location.hostname;
  var isProd = host === "whinc.top" || host === "www.whinc.top";
  if (isProd) {
    [
      "317c777c61690bdf21de7e7ea4cb6837",
      "6b7d00abe3480727ae8dde55075470d5",
    ].forEach(function (id) {
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://hm.baidu.com/hm.js?" + id;
      document.head.appendChild(script);
    });
  }
})();
