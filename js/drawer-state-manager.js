/**
 * Centralized Drawer State Manager
 *
 * Manages the layer drawer state and provides a unified event system
 * for components to listen to drawer state changes.
 */
export class DrawerStateManager {
  constructor() {
    this._drawer = document.querySelector('.drawer-placement-start');
    this._isOpen = false;

    // Listen for drawer events
    // CRITICAL: Only respond to events from the main drawer itself Ignore events from child sl-details elements that bubble up
    this._drawer.addEventListener('sl-show', (event) => {
      if (event.target === this._drawer) {
        this.open();
      }
    });

    this._drawer.addEventListener('sl-after-show', (event) => {
      if (event.target === this._drawer) {
        this.open();
      }
    });

    this._drawer.addEventListener('sl-hide', (event) => {
      if (event.target === this._drawer) {
        this.close();
      }
    });

    this._drawer.addEventListener('sl-after-hide', (event) => {
      if (event.target === this._drawer) {
        this.close();
      }
    });

    // Listen for window resize, but don't apply on touch devices
    if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      window.addEventListener('resize', this.close);
    }

    // Use multiple methods to determine initial state
    const shoelaceOpen = this._drawer.open;
    const hasOpenAttribute = this._drawer.hasAttribute('open');// Check for the 'open' attribute
    const hasOpenClass = this._drawer.classList.contains('sl-drawer--open');// Check for Shoelace's open class
    const computedStyle = getComputedStyle(this._drawer);// Check computed style visibility
    const isVisible = computedStyle.display !== 'none' &&
      computedStyle.visibility !== 'hidden' &&
      computedStyle.opacity !== '0';

    if (window.innerWidth <= 768) {
      // On mobile, only consider open if Shoelace explicitly says it's open
      // On mobile, drawer should be closed by default unless explicitly opened
      this._isOpen = shoelaceOpen && (hasOpenAttribute || hasOpenClass) && isVisible;
    } else {
      // On desktop, consider open if any indicator suggests it's open
      // On desktop, drawer should be open by default unless explicitly closed
      this._isOpen = shoelaceOpen || hasOpenAttribute || hasOpenClass || isVisible;
    }
    (this._isOpen) ? this.open() : this.close();
  }

  /**
   * Get current drawer state
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Toggle the drawer
   */
  toggle() {
    this.isOpen() ? this.close() : this.open();
  }

  /**
   * Open the drawer
   */
  open() {
    this._isOpen = true;
    this._drawer.show();
    $('#layer-search-input').focus();
  }

  /**
   * Close the drawer
   */
  close() {
    this._isOpen = false;
    this._drawer.hide();
  }

  /**
   * Clean up
   */
  destroy() {
  }
}
