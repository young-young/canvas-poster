# Poster 海报生成工具类使用说明

`utils/poster.js` 是一个基于 Uniapp 的多端（H5、小程序）Canvas 海报生成工具类。它支持通过配置化的方式，按图层顺序绘制图片、矩形、文本和线条，并最终导出为图片路径或 Base64 格式。

## 一、 基本使用方式

### 1. 准备 Canvas 节点
在你的 Vue 组件中，需要准备一个 `<canvas>` 标签。
**注意：** 小程序端通常需要指定 `canvas-id` 或 `id` 并设置 `type="2d"`。

```html
<template>
  <view>
    <!-- 小程序端推荐使用 type="2d" -->
    <canvas id="posterCanvas" canvas-id="posterCanvas" type="2d" style="width: 300px; height: 500px;"></canvas>
    <image :src="posterImage" mode="widthFix"></image>
  </view>
</template>
```

### 2. 引入并调用 Poster 类
在组件中引入 `Poster` 类，构建配置对象，并生成海报。

```javascript
import Poster from '@/utils/poster.js';

export default {
  data() {
    return {
      posterImage: ''
    }
  },
  methods: {
    async generatePoster() {
      // 1. 定义绘制配置（必须按你想绘制的先后图层顺序排列属性，因为内部是通过 Object.keys 遍历的）
      const posterConfig = {
        // 背景层（矩形）
        bg: {
          type: 'rect',
          w: 300,
          h: 500,
          offset_w: 0,
          offset_h: 0,
          fillStyle: '#ffffff',
          radius: 10 // 圆角
        },
        // 图片层
        mainImage: {
          type: 'img',
          image: 'https://example.com/main.png',
          w: 280,
          h: 280,
          offset_w: 10,
          offset_h: 10,
          radius: 8
        },
        // 文本层
        titleText: {
          type: 'text',
          fillText: '这是一个商品标题',
          fontSize: 16,
          color: '#333333',
          textBaseline: 'top',
          textAlign: 'left',
          offset_w: 10,
          offset_h: 310
        },
        // 线条层
        divider: {
          type: 'line',
          lineWidth: 1,
          color: '#eeeeee',
          offset_w: 10,
          offset_h: 350,
          w: 280,
          h: 350 // 注意线条的 w 和 h 实际代表结束点的 X 和 Y 坐标
        }
      };

      try {
        // 2. 初始化海报实例
        // 参数1: canvas 的 id
        // 参数2: 海报配置对象
        const poster = await Poster.create('posterCanvas', posterConfig);

        // 3. 开始绘制并生成图片 URL
        const imgUrl = await poster.createURL();
        
        // 4. 将生成的图片赋值给 img 标签展示
        this.posterImage = imgUrl;
        
      } catch (error) {
        console.error('海报生成失败', error);
      }
    }
  }
}
```

## 二、 配置项详解 (Config)

配置对象 `config` 的每一个键（如 `bg`, `mainImage`）代表一个绘制元素（图层）。支持以下四种 `type`：

### 1. 矩形 (`type: 'rect'`)
用于绘制背景色或占位块。
*   `w`: 矩形宽度
*   `h`: 矩形高度
*   `offset_w`: 绘制起点的 X 坐标
*   `offset_h`: 绘制起点的 Y 坐标
*   `fillStyle`: 填充颜色，例如 `'#ffffff'`
*   `radius`: 圆角大小 (可选)
*   `measureText`: 关联的文本内容 (可选，如果传入，起点的 X 坐标会自动加上该文本的宽度)

### 2. 图片 (`type: 'img'`)
用于绘制网络图片或本地图片。
*   `image`: 图片地址 (URL)
*   `w`: 图片绘制宽度
*   `h`: 图片绘制高度
*   `offset_w`: 绘制起点的 X 坐标
*   `offset_h`: 绘制起点的 Y 坐标
*   `radius`: 圆角大小 (可选，实现圆角图片)
*   `measureText`: 关联的文本内容 (可选，自动偏移 X 坐标)

### 3. 文本 (`type: 'text'`)
用于绘制文字。
*   `fillText`: 需要绘制的文字内容
*   `fontSize`: 字体大小 (数字)
*   `color`: 字体颜色
*   `textBaseline`: 文本基线，推荐 `'top'`、`'middle'`、`'bottom'`
*   `textAlign`: 对齐方式，推荐 `'left'`、`'center'`、`'right'`
*   `offset_w`: 绘制起点的 X 坐标
*   `offset_h`: 绘制起点的 Y 坐标
*   `show`: 是否显示该文本，默认 `true`
*   `measureText`: 关联的文本内容 (可选，自动偏移 X 坐标)

### 4. 线条 (`type: 'line'`)
用于绘制直线（如分割线）。
*   `lineWidth`: 线条宽度 (粗细)
*   `color`: 线条颜色
*   `offset_w`: 线条起点 X 坐标
*   `offset_h`: 线条起点 Y 坐标
*   `w`: 线条终点 X 坐标 (注意这里不是宽度)
*   `h`: 线条终点 Y 坐标 (注意这里不是高度)
*   `measureText`: 关联的文本内容 (可选，自动偏移 X 坐标)


## 三、 核心工作流程
1. **获取 Canvas 节点**: `Poster.create()` 会调用 `uni.createSelectorQuery()` 获取 DOM 中的 Canvas 节点和 2D 上下文。
2. **预加载图片**: `createURL()` 方法会首先并发预加载 `config` 中所有 `type: 'img'` 的网络图片，这一步极大提升了最终绘制的速度。
3. **顺序绘制**: 按照 `config` 对象属性遍历的顺序，依次调用 `clearRect`、`drawImage`、`drawText`、`drawLine` 将元素画到画布上。
4. **导出图片**: 绘制完成后，调用 `exportImage()`。在小程序端使用 `uni.canvasToTempFilePath` 导出临时路径，在 H5 端使用 `canvas.toDataURL` 导出 Base64 数据。

## 四、 常见问题与注意事项

### 1. H5 端的跨域问题（极其重要）
在 H5 环境下，Canvas 绘制网络图片受到严格的同源策略限制。
*   **现象**：如果在 H5 端绘制了跨域图片，调用 `canvas.toDataURL()` 时会报错 `Tainted canvases may not be exported`（被污染的画布无法导出）。
*   **解决方案**：本工具类在 H5 环境下已实现了通过 `Image` 对象并设置 `crossOrigin = 'Anonymous'` 的方式将图片转为 Base64 后再绘制。
*   **前提条件**：**目标图片所在的服务器（或 OSS/CDN）必须配置了允许跨域的响应头 (`Access-Control-Allow-Origin: *`)**。如果没有该配置，纯前端无法解决跨域问题，必须让后端提供代理接口将图片转成 Base64 再传给前端。

### 2. 图层绘制顺序
由于 JavaScript 对象属性遍历顺序的特性，**请确保你的 `config` 配置对象属性的声明顺序就是你期望的图层层叠顺序**。
通常应该是：背景 (`rect`) -> 底图 (`img`) -> 上层图片/装饰 (`img`) -> 文字 (`text`)。后声明的元素会覆盖在先声明的元素之上。

### 3. Canvas 尺寸与 DPR (设备像素比)
在 H5 端，为了防止生成的图片模糊，工具类内部已经处理了 DPR 缩放：
```javascript
// #ifdef H5
this.dpr = this.getCanvasDpr();
this.ctx.scale(1 / this.dpr, 1 / this.dpr);
// #endif
```
确保在定义 Canvas 标签时，CSS 的 width/height 与标签本身的 width/height 属性匹配。

### 4. 小程序真机调试路径问题
在小程序端，`uni.canvasToTempFilePath` 返回的是临时文件路径。
*   iOS 系统：由于部分 iOS 版本的限制，代码中已做了兼容处理，通过 `uni.getImageInfo` 验证并获取绝对路径。
*   建议生成海报后，直接将临时路径赋值给 `<image>` 标签展示，或者调用 `uni.saveImageToPhotosAlbum` 保存到相册。

### 5. 圆角图片的实现
工具类内部封装了 `createRoundedRectPath` 方法。如果你需要绘制圆角矩形或圆角图片，只需在 `rect` 或 `img` 的配置中传入 `radius` 参数即可，底层会通过 `ctx.clip()` 自动实现裁剪。
