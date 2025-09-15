(function () {
  "use strict";

  if (!window.Vue) {
    console.error("vue.global.js not loaded. Please include it before newvue.js");
    return;
  }

  // Thin adapter that re-exports Vue's global build under window.NewVue
  const NV = {};

  NV.createApp = window.Vue.createApp;
  NV.reactive = window.Vue.reactive;
  NV.ref = window.Vue.ref;
  NV.computed = window.Vue.computed;
  NV.watch = window.Vue.watch;
  NV.watchEffect = window.Vue.watchEffect;
  NV.effect = window.Vue.effect || window.Vue.watchEffect;
  NV.h = window.Vue.h;
  NV.Fragment = window.Vue.Fragment;
  NV.Text = window.Vue.Text;
  NV.defineComponent = window.Vue.defineComponent;

  // expose
  window.NewVue = NV;
})();
