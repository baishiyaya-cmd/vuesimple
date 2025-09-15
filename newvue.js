/**
* NewVue - Self-contained Vue implementation
* Based on Vue.js v3.5.21
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
(function() {
  "use strict";

  // Check if Vue is already loaded, if so use it
  if (window.Vue) {
    const NV = {
      createApp: window.Vue.createApp,
      reactive: window.Vue.reactive,
      ref: window.Vue.ref,
      computed: window.Vue.computed,
      watch: window.Vue.watch,
      watchEffect: window.Vue.watchEffect,
      effect: window.Vue.effect || window.Vue.watchEffect,
      h: window.Vue.h,
      Fragment: window.Vue.Fragment,
      Text: window.Vue.Text,
      defineComponent: window.Vue.defineComponent
    };
    window.NewVue = NV;
    return;
  }

  // Self-contained minimal Vue implementation
  // Utility functions
  const EMPTY_OBJ = Object.freeze({});
  const NOOP = () => {};
  const extend = Object.assign;
  const hasOwnProperty = Object.prototype.hasOwnProperty;
  const hasOwn = (val, key) => hasOwnProperty.call(val, key);
  const isArray = Array.isArray;
  const isFunction = (val) => typeof val === "function";
  const isString = (val) => typeof val === "string";
  const isObject = (val) => val !== null && typeof val === "object";
  const hasChanged = (value, oldValue) => !Object.is(value, oldValue);

  function warn(msg, ...args) {
    console.warn(`[NewVue warn] ${msg}`, ...args);
  }

  // Reactivity system
  let activeEffect;
  let shouldTrack = true;
  
  class ReactiveEffect {
    constructor(fn, scheduler = null) {
      this.fn = fn;
      this.scheduler = scheduler;
      this.active = true;
      this.deps = [];
    }

    run() {
      if (!this.active) {
        return this.fn();
      }
      try {
        activeEffect = this;
        shouldTrack = true;
        return this.fn();
      } finally {
        activeEffect = undefined;
      }
    }

    stop() {
      if (this.active) {
        cleanupEffect(this);
        this.active = false;
      }
    }
  }

  function cleanupEffect(effect) {
    const { deps } = effect;
    if (deps.length) {
      for (let i = 0; i < deps.length; i++) {
        deps[i].delete(effect);
      }
      deps.length = 0;
    }
  }

  function effect(fn, options = {}) {
    const _effect = new ReactiveEffect(fn, options.scheduler);
    if (!options.lazy) {
      _effect.run();
    }
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
  }

  const targetMap = new WeakMap();
  
  function track(target, type, key) {
    if (!shouldTrack || activeEffect === undefined) {
      return;
    }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = new Set()));
    }
    if (!dep.has(activeEffect)) {
      dep.add(activeEffect);
      activeEffect.deps.push(dep);
    }
  }

  function trigger(target, type, key, newValue, oldValue) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
      return;
    }
    
    let deps = [];
    if (key !== void 0) {
      deps.push(depsMap.get(key));
    }
    
    if (type === "clear") {
      deps = [...depsMap.values()];
    } else if (key === "length" && isArray(target)) {
      depsMap.forEach((dep, key) => {
        if (key === "length" || key >= newValue) {
          deps.push(dep);
        }
      });
    }
    
    const effects = [];
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep);
      }
    }
    
    for (const effect of effects) {
      if (effect !== activeEffect) {
        if (effect.scheduler) {
          effect.scheduler();
        } else {
          effect.run();
        }
      }
    }
  }

  // Reactive handlers
  const mutableHandlers = {
    get(target, key, receiver) {
      if (key === "__v_isReactive") {
        return true;
      } else if (key === "__v_raw") {
        return target;
      }
      
      const res = Reflect.get(target, key, receiver);
      track(target, "get", key);
      
      if (isObject(res)) {
        return reactive(res);
      }
      
      return res;
    },

    set(target, key, value, receiver) {
      const oldValue = target[key];
      const hadKey = hasOwn(target, key);
      const result = Reflect.set(target, key, value, receiver);
      
      if (target === toRaw(receiver)) {
        if (!hadKey) {
          trigger(target, "add", key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, "set", key, value, oldValue);
        }
      }
      
      return result;
    },
    
    deleteProperty(target, key) {
      const hadKey = hasOwn(target, key);
      const oldValue = target[key];
      const result = Reflect.deleteProperty(target, key);
      if (result && hadKey) {
        trigger(target, "delete", key, void 0, oldValue);
      }
      return result;
    }
  };

  const reactiveMap = new WeakMap();

  function createReactiveObject(target, baseHandlers, proxyMap) {
    if (!isObject(target)) {
      return target;
    }
    
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
      return existingProxy;
    }

    const proxy = new Proxy(target, baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
  }

  function reactive(target) {
    return createReactiveObject(target, mutableHandlers, reactiveMap);
  }

  function isReactive(value) {
    return !!(value && value.__v_isReactive);
  }

  function toRaw(observed) {
    const raw = observed && observed["__v_raw"];
    return raw ? toRaw(raw) : observed;
  }

  function markRaw(value) {
    if (Object.isExtensible(value)) {
      Object.defineProperty(value, "__v_skip", { value: true });
    }
    return value;
  }

  const toReactive = (value) => isObject(value) ? reactive(value) : value;

  // Ref implementation
  function isRef(r) {
    return !!(r && r.__v_isRef === true);
  }

  class RefImpl {
    constructor(value, __v_isShallow) {
      this.__v_isRef = true;
      this.__v_isShallow = __v_isShallow;
      this._rawValue = __v_isShallow ? value : toRaw(value);
      this._value = __v_isShallow ? value : toReactive(value);
    }
    
    get value() {
      track(this, "get", "value");
      return this._value;
    }
    
    set value(newVal) {
      const useDirectValue = this.__v_isShallow || !isObject(newVal);
      newVal = useDirectValue ? newVal : toRaw(newVal);
      if (hasChanged(newVal, this._rawValue)) {
        this._rawValue = newVal;
        this._value = useDirectValue ? newVal : toReactive(newVal);
        trigger(this, "set", "value", newVal);
      }
    }
  }

  function ref(value) {
    return createRef(value, false);
  }

  function shallowRef(value) {
    return createRef(value, true);
  }

  function createRef(rawValue, shallow) {
    if (isRef(rawValue)) {
      return rawValue;
    }
    return new RefImpl(rawValue, shallow);
  }

  function unref(ref) {
    return isRef(ref) ? ref.value : ref;
  }

  // Computed implementation
  class ComputedRefImpl {
    constructor(getter, _setter) {
      this.fn = getter;
      this.setter = _setter;
      this._value = void 0;
      this.__v_isRef = true;
      this.effect = new ReactiveEffect(getter, () => {
        trigger(this, "set", "value");
      });
    }
    
    get value() {
      track(this, "get", "value");
      this._value = this.effect.run();
      return this._value;
    }
    
    set value(newValue) {
      if (this.setter) {
        this.setter(newValue);
      }
    }
  }

  function computed(getterOrOptions) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
      getter = getterOrOptions;
    } else {
      getter = getterOrOptions.get;
      setter = getterOrOptions.set;
    }
    return new ComputedRefImpl(getter, setter);
  }

  // Watch implementation
  function watchEffect(fn, options = {}) {
    return doWatch(fn, null, options);
  }

  function watch(source, cb, options = {}) {
    return doWatch(source, cb, options);
  }

  function doWatch(source, cb, options = {}) {
    let getter;
    let forceTrigger = false;

    if (isRef(source)) {
      getter = () => source.value;
      forceTrigger = true;
    } else if (isReactive(source)) {
      getter = () => source;
      forceTrigger = true;
    } else if (isFunction(source)) {
      if (cb) {
        getter = source;
      } else {
        getter = () => source();
      }
    } else {
      getter = NOOP;
    }

    let oldValue = cb ? (isArray(source) ? [] : {}) : void 0;

    const job = () => {
      if (cb) {
        const newValue = effectRunner.run();
        if (forceTrigger || hasChanged(newValue, oldValue)) {
          cb(newValue, oldValue);
          oldValue = newValue;
        }
      } else {
        effectRunner.run();
      }
    };

    const effectRunner = new ReactiveEffect(getter, job);
    
    if (cb) {
      if (options.immediate) {
        job();
      } else {
        oldValue = effectRunner.run();
      }
    } else {
      effectRunner.run();
    }

    return () => {
      effectRunner.stop();
    };
  }

  // VNode system
  const Fragment = Symbol('Fragment');
  const Text = Symbol('Text');
  const Comment = Symbol('Comment');

  function createVNode(type, props = null, children = null) {
    const vnode = {
      __v_isVNode: true,
      type,
      props,
      children,
      key: props && props.key,
      ref: props && props.ref,
      el: null,
      shapeFlag: getShapeFlag(type)
    };
    
    if (children) {
      normalizeChildren(vnode, children);
    }
    
    return vnode;
  }

  function getShapeFlag(type) {
    return isString(type) ? 1 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
  }

  function normalizeChildren(vnode, children) {
    let type = 0;
    if (children == null) {
      children = null;
    } else if (isArray(children)) {
      type = 16;
    } else if (typeof children === "object") {
      type = 32;
    } else if (isFunction(children)) {
      children = { default: children };
      type = 32;
    } else {
      children = String(children);
      type = 8;
    }
    vnode.children = children;
    vnode.shapeFlag |= type;
  }

  function isVNode(value) {
    return value ? value.__v_isVNode === true : false;
  }

  function h(type, propsOrChildren, children) {
    const l = arguments.length;
    if (l === 2) {
      if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
        if (isVNode(propsOrChildren)) {
          return createVNode(type, null, [propsOrChildren]);
        }
        return createVNode(type, propsOrChildren);
      } else {
        return createVNode(type, null, propsOrChildren);
      }
    } else {
      if (l > 3) {
        children = Array.prototype.slice.call(arguments, 2);
      } else if (l === 3 && isVNode(children)) {
        children = [children];
      }
      return createVNode(type, propsOrChildren, children);
    }
  }

  // Component system
  function defineComponent(options, extraOptions) {
    return isFunction(options) ? 
      extend({ name: options.name }, extraOptions, { setup: options }) :
      options;
  }

  let currentInstance = null;
  
  function getCurrentInstance() {
    return currentInstance;
  }

  function setCurrentInstance(instance) {
    currentInstance = instance;
  }

  // Basic template compilation warning
  function compileTemplate(template) {
    warn('Template compilation is not available in this minimal build.');
    warn('Please use render functions instead of template strings.');
    warn('Template content:', template.substring(0, 100) + (template.length > 100 ? '...' : ''));
    
    return function render() {
      return h('div', {
        style: {
          padding: '20px',
          border: '2px dashed #ff6b6b',
          background: '#ffe0e0',
          borderRadius: '8px',
          fontFamily: 'Arial, sans-serif'
        }
      }, [
        h('h3', { style: { color: '#d63031', marginTop: 0 } }, 'Template Compilation Not Available'),
        h('p', {}, 'This minimal NewVue build does not include template compilation.'),
        h('p', {}, 'Please use render functions instead of template strings.'),
        h('details', {}, [
          h('summary', { style: { cursor: 'pointer', marginBottom: '10px' } }, 'Show template content'),
          h('pre', { 
            style: { 
              background: '#f8f9fa', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px'
            } 
          }, template)
        ])
      ]);
    };
  }

  // App system
  function createAppContext() {
    return {
      app: null,
      config: {
        globalProperties: {},
        errorHandler: void 0,
        warnHandler: void 0
      },
      mixins: [],
      components: {},
      directives: {}
    };
  }

  let uid = 0;
  function createApp(rootComponent, rootProps = null) {
    const context = createAppContext();
    const installedPlugins = new Set();
    let isMounted = false;

    const app = {
      _uid: uid++,
      _component: rootComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      version: '3.5.21-newvue-minimal',

      get config() {
        return context.config;
      },

      use(plugin, ...options) {
        if (installedPlugins.has(plugin)) {
          warn(`Plugin has already been applied to target app.`);
        } else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin);
          plugin.install(app, ...options);
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin);
          plugin(app, ...options);
        }
        return app;
      },

      component(name, component) {
        if (!component) {
          return context.components[name];
        }
        context.components[name] = component;
        return app;
      },

      directive(name, directive) {
        if (!directive) {
          return context.directives[name];
        }
        context.directives[name] = directive;
        return app;
      },

      mount(rootContainer) {
        if (!isMounted) {
          if (typeof rootContainer === 'string') {
            rootContainer = document.querySelector(rootContainer);
          }
          
          if (!rootContainer) {
            warn('Failed to mount app: mount target not found.');
            return;
          }

          // Create a basic component instance
          const instance = createComponentInstance(rootComponent);
          
          if (rootComponent.setup) {
            setCurrentInstance(instance);
            try {
              const setupResult = rootComponent.setup(rootProps || {});
              if (isFunction(setupResult)) {
                instance.render = setupResult;
              } else if (isObject(setupResult)) {
                instance.setupState = reactive(setupResult);
              }
            } finally {
              setCurrentInstance(null);
            }
          }

          // Handle template compilation
          if (rootComponent.template && !instance.render) {
            instance.render = compileTemplate(rootComponent.template);
          }

          // Basic rendering
          if (instance.render) {
            const renderFn = () => {
              setCurrentInstance(instance);
              try {
                const vnode = instance.render.call(instance.setupState || {});
                renderVNode(vnode, rootContainer);
              } finally {
                setCurrentInstance(null);
              }
            };
            
            // Set up reactive rendering
            effect(renderFn);
          }

          isMounted = true;
          app._container = rootContainer;
          
          return instance;
        }
      },

      unmount() {
        if (isMounted) {
          if (app._container) {
            app._container.innerHTML = '';
          }
          isMounted = false;
        }
      }
    };

    context.app = app;
    return app;
  }

  function createComponentInstance(type) {
    return {
      uid: uid++,
      type,
      render: null,
      setupState: null,
      props: {},
      emit: NOOP
    };
  }

  // Very basic VNode rendering (simplified)
  function renderVNode(vnode, container) {
    if (!vnode) {
      return;
    }
    
    // Clear container first on initial render
    if (!container.hasChildNodes()) {
      container.innerHTML = '';
    }
    
    if (isArray(vnode)) {
      vnode.forEach(child => renderVNode(child, container));
      return;
    }
    
    if (!isVNode(vnode)) {
      const textNode = document.createTextNode(String(vnode));
      container.appendChild(textNode);
      return;
    }
    
    if (vnode.type === Text) {
      const textNode = document.createTextNode(vnode.children || '');
      container.appendChild(textNode);
      return;
    }
    
    if (vnode.type === Comment) {
      const commentNode = document.createComment(vnode.children || '');
      container.appendChild(commentNode);
      return;
    }
    
    if (vnode.type === Fragment) {
      if (vnode.children) {
        if (isArray(vnode.children)) {
          vnode.children.forEach(child => renderVNode(child, container));
        } else {
          renderVNode(vnode.children, container);
        }
      }
      return;
    }
    
    // Element or component
    if (isString(vnode.type)) {
      const el = document.createElement(vnode.type);
      
      // Set props
      if (vnode.props) {
        for (const key in vnode.props) {
          const value = vnode.props[key];
          if (key === 'style' && isObject(value)) {
            for (const styleKey in value) {
              el.style[styleKey] = value[styleKey];
            }
          } else if (key.startsWith('on') && isFunction(value)) {
            const eventName = key.slice(2).toLowerCase();
            el.addEventListener(eventName, value);
          } else if (value != null) {
            el.setAttribute(key, String(value));
          }
        }
      }
      
      // Render children
      if (vnode.children) {
        if (isString(vnode.children)) {
          el.textContent = vnode.children;
        } else if (isArray(vnode.children)) {
          vnode.children.forEach(child => renderVNode(child, el));
        } else {
          renderVNode(vnode.children, el);
        }
      }
      
      container.appendChild(el);
      vnode.el = el;
    }
  }


  // Watch implementation
  function watchEffect(fn, options = {}) {
    return doWatch(fn, null, options);
  }

  function watch(source, cb, options = {}) {
    return doWatch(source, cb, options);
  }

  function doWatch(source, cb, options = {}) {
    let getter;
    let forceTrigger = false;

    if (isRef(source)) {
      getter = () => source.value;
      forceTrigger = true;
    } else if (isReactive(source)) {
      getter = () => source;
      forceTrigger = true;
    } else if (isFunction(source)) {
      if (cb) {
        getter = source;
      } else {
        getter = () => source();
      }
    } else {
      getter = NOOP;
    }

    let oldValue = cb ? (isArray(source) ? [] : {}) : void 0;

    const job = () => {
      if (cb) {
        const newValue = effectRunner.run();
        if (forceTrigger || hasChanged(newValue, oldValue)) {
          cb(newValue, oldValue);
          oldValue = newValue;
        }
      } else {
        effectRunner.run();
      }
    };

    const effectRunner = new ReactiveEffect(getter, job);
    
    if (cb) {
      if (options.immediate) {
        job();
      } else {
        oldValue = effectRunner.run();
      }
    } else {
      effectRunner.run();
    }

    return () => {
      effectRunner.stop();
    };
  }

  // Utility functions
  function readonly(target) {
    return target; // Simplified
  }

  function shallowReactive(target) {
    return reactive(target); // Simplified
  }

  function shallowReadonly(target) {
    return target; // Simplified
  }

  // String utilities
  const cacheStringFunction = (fn) => {
    const cache = Object.create(null);
    return ((str) => {
      const hit = cache[str];
      return hit || (cache[str] = fn(str));
    });
  };
  
  const camelizeRE = /-\w/g;
  const camelize = cacheStringFunction(
    (str) => {
      return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
    }
  );
  
  const hyphenateRE = /\B([A-Z])/g;
  const hyphenate = cacheStringFunction(
    (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
  );
  
  const capitalize = cacheStringFunction((str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  
  const toHandlerKey = cacheStringFunction(
    (str) => {
      const s = str ? `on${capitalize(str)}` : ``;
      return s;
    }
  );

  // Create the NewVue object
  const NewVue = {
    // Core API
    createApp,
    reactive,
    ref,
    computed,
    watch,
    watchEffect,
    effect: watchEffect,
    h,
    Fragment,
    Text,
    defineComponent,
    
    // Utilities
    isRef,
    unref,
    isReactive,
    toRaw,
    markRaw,
    shallowRef,
    shallowReactive,
    readonly,
    shallowReadonly,
    
    // String utilities
    camelize,
    capitalize,
    hyphenate,
    toHandlerKey,
    
    // Version
    version: '3.5.21-newvue-minimal'
  };

  // Expose NewVue globally
  window.NewVue = NewVue;
  
  // Also expose as Vue if not already present
  if (!window.Vue) {
    window.Vue = NewVue;
  }

})();
