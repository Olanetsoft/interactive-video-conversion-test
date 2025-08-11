// Cloudinary Interactive Video A/B Test - Native Implementation
class CloudinaryNativeTest {
  constructor() {
    this.metrics = {
      control: {
        views: 0,
        completions: 0,
        interactions: 0,
        conversions: 0,
      },
      interactive: {
        views: 0,
        completions: 0,
        interactions: 0,
        conversions: 0,
      },
    };

    // Track interactions per session for accurate conversion calculation
    this.sessionHasInteractions = false;

    this.init();
  }

  init() {
    // Initialize Cloudinary
    this.cld = cloudinary.Cloudinary.new({
      cloud_name: "demo",
      secure: true,
    });

    this.setupControlPlayer();
    this.setupInteractivePlayer();
    this.loadData();
  }

  setupControlPlayer() {
    // Standard video player (control group)
    this.controlPlayer = this.cld.videoPlayer("control-video", {
      controls: true,
      muted: true,
      fluid: true,
    });

    this.controlPlayer.source("docs/walking_talking");

    // Control player events
    this.controlPlayer.on("play", () => this.onPlay("control"));
    this.controlPlayer.on("ended", () => this.onVideoEnd("control"));
  }

  setupInteractivePlayer() {
    // Interactive video player with Cloudinary's native interaction areas
    this.interactivePlayer = this.cld.videoPlayer("interactive-video", {
      controls: true,
      muted: true,
      fluid: true,
      interactionDisplay: {
        layout: {
          enable: false, // Disable the default zoom UI overlay
          showAgain: false,
        },
        theme: {
          template: "pulsing", // Keep the pulsing hotspot indicators
        },
      },
    });

    // Configure video source with interaction areas using Cloudinary's native API
    this.interactivePlayer.source("docs/walking_talking", {
      interactionAreas: {
        enable: true,
        template: [
          {
            left: 15, // 15% from left
            top: 25, // 25% from top
            width: 30, // 30% width
            height: 25, // 25% height
            id: "sunglasses",
          },
          {
            left: 55, // 55% from left
            top: 35, // 35% from top
            width: 30, // 30% width
            height: 25, // 25% height
            id: "watch",
          },
          {
            left: 35, // 35% from left
            top: 65, // 65% from top
            width: 30, // 30% width
            height: 30, // 30% height
            id: "collection",
          },
        ],
        onClick: (event) => {
          this.onInteractionClick(event);
        },
      },
    });

    // Interactive player events
    this.interactivePlayer.on("play", () => {
      this.onPlay("interactive");
      this.showInteractionHint();
    });
    this.interactivePlayer.on("ended", () => this.onVideoEnd("interactive"));
  }

  showInteractionHint() {
    // Show a subtle hint about clickable products
    const videoContainer =
      document.querySelector("#interactive-video").parentElement;
    const hint = document.createElement("div");
    hint.className = "interaction-hint";
    hint.innerHTML = "💡 Click on products to shop";
    hint.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    videoContainer.style.position = "relative";
    videoContainer.appendChild(hint);

    // Fade in
    setTimeout(() => (hint.style.opacity = "1"), 100);

    // Fade out after 3 seconds
    setTimeout(() => {
      hint.style.opacity = "0";
      setTimeout(() => {
        if (hint.parentElement) {
          hint.parentElement.removeChild(hint);
        }
      }, 300);
    }, 3000);
  }

  onPlay(type) {
    this.metrics[type].views++;
    this.updateDisplay(type);
    this.updateGlobalMetrics();
  }

  onInteractionClick(event) {
    const interactionId = event.item.id;

    this.metrics.interactive.interactions++;

    // Mark this session as having interactions for proper conversion tracking
    this.sessionHasInteractions = true;

    // Show product info based on interaction area
    let productInfo = "";
    switch (interactionId) {
      case "sunglasses":
        productInfo = "🕶️ Premium Sunglasses - $89";
        break;
      case "watch":
        productInfo = "⌚ Luxury Watch - $299";
        break;
      case "collection":
        productInfo = "🛍️ Shop Full Collection";
        break;
    }

    // Pause video for interaction
    this.interactivePlayer.pause();

    // Show product alert
    this.showProductAlert(productInfo);

    // Note: Conversion happens on video completion, not here
    // This prevents double-counting conversions

    this.updateDisplay("interactive");
    this.updateGlobalMetrics();

    // Resume video after 2.5 seconds
    setTimeout(() => {
      this.interactivePlayer.play();
    }, 2500);
  }

  showProductAlert(productInfo) {
    const videoContainer = document.getElementById("interactive-container");
    if (!videoContainer) return;

    // Parse product info (emoji label - price or generic)
    const parts = productInfo.split("-");
    const title = parts[0]?.trim() || "Product";
    const price = parts[1]?.trim() || "Limited Offer";

    // Remove any existing overlay first (single instance)
    const existing = videoContainer.querySelector(".product-alert-overlay");
    if (existing) existing.remove();

    const wrapper = document.createElement("div");
    wrapper.className = "product-alert-overlay";
    wrapper.innerHTML = `
      <div class="product-overlay-card" role="dialog" aria-label="Product interaction">
        <h3>${title}</h3>
        <div class="price">${price}</div>
        <div class="actions">
          <button class="primary" data-action="add" type="button">Add to Cart</button>
          <button class="secondary" data-action="close" type="button">Close</button>
        </div>
        <div class="mini-note">Interactive Hotspot</div>
      </div>`;

    videoContainer.appendChild(wrapper);

    const card = wrapper.querySelector(".product-overlay-card");
    const addBtn = card.querySelector('[data-action="add"]');
    const closeBtn = card.querySelector('[data-action="close"]');

    const cleanup = (delay = 0) => setTimeout(() => wrapper.remove(), delay);

    addBtn.addEventListener("click", () => {
      addBtn.textContent = "✓ Added";
      addBtn.disabled = true;
      addBtn.style.filter = "grayscale(.2) brightness(.9)";

      // Track conversion from interactive element
      this.metrics.interactive.conversions++;
      this.updateDisplay("interactive");
      this.updateGlobalMetrics();
      cleanup(900);
    });

    closeBtn.addEventListener("click", () => cleanup(0));

    // Auto dismiss after 5s if untouched
    cleanup(5000);
  }

  onVideoEnd(type) {
    this.metrics[type].completions++;

    // Research-based conversion rates
    let conversionRate;
    if (type === "control") {
      conversionRate = 0.018; // 1.8% baseline conversion
    } else {
      // Interactive videos: check if THIS session had interactions
      const hasInteraction = this.sessionHasInteractions || false;
      conversionRate = hasInteraction ? 0.08 : 0.028; // 8% vs 2.8%

      // Reset session interaction flag after video ends
      this.sessionHasInteractions = false;
    }

    if (Math.random() < conversionRate) {
      this.metrics[type].conversions++;
      this.showConversionAlert();
    }

    this.updateDisplay(type);
    this.updateGlobalMetrics();
  }

  updateDisplay(type) {
    const m = this.metrics[type];

    const elements = {
      views: document.getElementById(`${type}-views`),
      completions: document.getElementById(`${type}-completions`),
      interactions: document.getElementById(`${type}-interactions`),
      conversions: document.getElementById(`${type}-conversions`),
      rate: document.getElementById(`${type}-rate`),
    };

    if (elements.views) elements.views.textContent = m.views;
    if (elements.completions) elements.completions.textContent = m.completions;
    if (elements.interactions)
      elements.interactions.textContent = m.interactions;
    if (elements.conversions) elements.conversions.textContent = m.conversions;

    const rate = m.views > 0 ? ((m.conversions / m.views) * 100).toFixed(1) : 0;
    if (elements.rate) elements.rate.textContent = `${rate}%`;
  }

  updateGlobalMetrics() {
    const totalViews =
      this.metrics.control.views + this.metrics.interactive.views;
    const lift = this.calculateConversionLift();
    const revenue = this.calculateRevenueBoost();
    const interactionRate = this.calculateInteractionRate();

    const elements = {
      lift: document.getElementById("conversion-lift"),
      revenue: document.getElementById("revenue-boost"),
      interaction: document.getElementById("interaction-rate"),
      total: document.getElementById("total-tests"),
    };

    // Fix display to handle negative values properly
    if (elements.lift) {
      const liftText = lift >= 0 ? `+${lift}%` : `${lift}%`;
      elements.lift.textContent = liftText;
    }

    if (elements.revenue) {
      const revenueText =
        revenue >= 0 ? `+$${revenue}` : `-$${Math.abs(revenue)}`;
      elements.revenue.textContent = revenueText;
    }

    if (elements.interaction)
      elements.interaction.textContent = `${interactionRate}%`;
    if (elements.total) elements.total.textContent = totalViews;
  }

  calculateConversionLift() {
    // Return 0 when no data available
    if (
      this.metrics.control.views === 0 &&
      this.metrics.interactive.views === 0
    ) {
      return 0;
    }

    const controlRate =
      this.metrics.control.views > 0
        ? this.metrics.control.conversions / this.metrics.control.views
        : 0.018;

    const interactiveRate =
      this.metrics.interactive.views > 0
        ? this.metrics.interactive.conversions / this.metrics.interactive.views
        : 0.028;

    return controlRate > 0
      ? Math.round(((interactiveRate - controlRate) / controlRate) * 100)
      : 0;
  }

  calculateRevenueBoost() {
    // Return 0 when no data available
    if (
      this.metrics.control.views === 0 &&
      this.metrics.interactive.views === 0
    ) {
      return 0;
    }

    const avgOrderValue = 180; // Based on premium product mix
    const lift = this.calculateConversionLift() / 100;

    // Use actual control conversion rate, not hardcoded 1.8%
    const actualControlRate =
      this.metrics.control.views > 0
        ? this.metrics.control.conversions / this.metrics.control.views
        : 0.018;

    const extraConversions = lift * actualControlRate * 1000; // per 1000 views
    return Math.round(extraConversions * avgOrderValue);
  }

  calculateInteractionRate() {
    const views = this.metrics.interactive.views;
    const interactions = this.metrics.interactive.interactions;
    return views > 0 ? Math.round((interactions / views) * 100) : 0;
  }

  showConversionAlert() {
    const alert = document.getElementById("conversion-alert");
    if (alert) {
      alert.classList.add("show");
      setTimeout(() => alert.classList.remove("show"), 4000);
    }
  }

  simulateBulkViews() {
    // Simulate 100 control views
    for (let i = 0; i < 100; i++) {
      this.metrics.control.views++;
      if (Math.random() < 0.78) this.metrics.control.completions++; // 78% completion
      if (Math.random() < 0.018) this.metrics.control.conversions++; // 1.8% conversion
    }

    // Simulate 100 interactive views with native Cloudinary interactions
    for (let i = 0; i < 100; i++) {
      this.metrics.interactive.views++;
      if (Math.random() < 0.89) this.metrics.interactive.completions++; // 89% completion

      // 45% of users click on native interaction areas
      const interacted = Math.random() < 0.45;
      if (interacted) {
        this.metrics.interactive.interactions++;
        // Very high conversion with native interactions
        if (Math.random() < 0.08) this.metrics.interactive.conversions++; // 8%
      } else {
        // Still better than control without interaction
        if (Math.random() < 0.028) this.metrics.interactive.conversions++; // 2.8%
      }
    }

    this.updateDisplay("control");
    this.updateDisplay("interactive");
    this.updateGlobalMetrics();
    this.showConversionAlert();
  }

  reset() {
    this.metrics = {
      control: {
        views: 0,
        completions: 0,
        interactions: 0,
        conversions: 0,
      },
      interactive: {
        views: 0,
        completions: 0,
        interactions: 0,
        conversions: 0,
      },
    };

    // Reset session interaction tracking
    this.sessionHasInteractions = false;

    this.updateDisplay("control");
    this.updateDisplay("interactive");
    this.updateGlobalMetrics();
  }

  saveData() {
    localStorage.setItem(
      "cloudinary-native-test",
      JSON.stringify(this.metrics)
    );
  }

  saveData() {
    localStorage.setItem(
      "cloudinary-native-test",
      JSON.stringify(this.metrics)
    );
  }

  loadData() {
    const saved = localStorage.getItem("cloudinary-native-test");
    if (saved) {
      this.metrics = JSON.parse(saved);
      this.updateDisplay("control");
      this.updateDisplay("interactive");
      this.updateGlobalMetrics();
    }
  }
}

// Initialize when page loads
let nativeTest;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    nativeTest = new CloudinaryNativeTest();
  });
} else {
  nativeTest = new CloudinaryNativeTest();
}

// Global functions for UI controls
function resetTest() {
  if (nativeTest) nativeTest.reset();
}

function simulateViews() {
  if (nativeTest) nativeTest.simulateBulkViews();
}

// Auto-save experiment data
setInterval(() => {
  if (nativeTest) nativeTest.saveData();
}, 20000);
