# NewVue - Vue.js 精简版

## 概述

NewVue 是从 Vue.js v3.5.21 中提取核心功能的精简版实现。它保留了 Vue 的核心响应式系统、组件系统和虚拟 DOM，但移除了模板编译器以大幅减少文件大小。

## 文件大小对比

- **原始 vue.global.js**: 555.0 KB
- **新的 newvue.js**: 21.0 KB  
- **减少**: 96.2% (节省 534.0 KB)

## 包含的功能

### ✅ 核心 API
- `createApp()` - 创建应用实例
- `reactive()` - 创建响应式对象
- `ref()` - 创建响应式引用
- `computed()` - 创建计算属性
- `watch()` - 侦听数据变化
- `watchEffect()` - 副作用侦听器
- `h()` - 创建虚拟 DOM 节点
- `defineComponent()` - 定义组件

### ✅ 工具函数
- `isRef()`, `unref()`, `isReactive()`, `toRaw()`, `markRaw()`
- `shallowRef()`, `shallowReactive()`, `readonly()`, `shallowReadonly()`
- `camelize()`, `capitalize()`, `hyphenate()`, `toHandlerKey()`

### ✅ 符号类型
- `Fragment`, `Text` - 用于虚拟 DOM

## 不包含的功能

### ❌ 模板编译器
- 不支持 `template` 字符串
- 必须使用渲染函数 (`render()`) 或 JSX

### ❌ 高级功能
- 服务端渲染 (SSR)
- 内置组件 (Transition, Suspense 等)
- 指令系统 (v-model, v-for 等)
- 模板引用 (ref)

## 使用方法

### 自动回退
如果检测到全功能的 Vue.js 已加载，NewVue 会自动使用它：

```html
<!-- 如果需要模板编译，先加载完整版 Vue -->
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
<script src="./newvue.js"></script>
```

### 独立使用
直接使用精简版（仅支持渲染函数）：

```html
<script src="./newvue.js"></script>
```

## 示例

### 使用渲染函数
参见 `example-render.html` 了解如何使用渲染函数创建组件。

### 使用模板（需要完整版 Vue）
参见 `example.html` 了解如何使用模板字符串（需要先加载 vue.global.js）。

## 快速开始

```javascript
const { createApp, ref, reactive, computed, h } = NewVue;

const App = defineComponent({
  setup() {
    const count = ref(0);
    const doubled = computed(() => count.value * 2);
    
    return () => h('div', {}, [
      h('p', {}, `Count: ${count.value}`),
      h('p', {}, `Doubled: ${doubled.value}`),
      h('button', { 
        onclick: () => count.value++ 
      }, 'Increment')
    ]);
  }
});

createApp(App).mount('#app');
```

## 迁移指南

如果你有使用模板字符串的组件，需要将其转换为渲染函数：

### 之前 (模板)
```javascript
const Component = defineComponent({
  template: `
    <div class="counter">
      <button @click="dec">-</button>
      <span>{{ count }}</span>
      <button @click="inc">+</button>
    </div>
  `,
  setup() {
    const count = ref(0);
    const inc = () => count.value++;
    const dec = () => count.value--;
    return { count, inc, dec };
  }
});
```

### 之后 (渲染函数)
```javascript
const Component = defineComponent({
  setup() {
    const count = ref(0);
    const inc = () => count.value++;
    const dec = () => count.value--;
    
    return () => h('div', { class: 'counter' }, [
      h('button', { onclick: dec }, '-'),
      h('span', {}, count.value),
      h('button', { onclick: inc }, '+')
    ]);
  }
});
```

## 许可证

MIT License - 基于 Vue.js v3.5.21