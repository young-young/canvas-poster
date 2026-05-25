export default class Poster {
  constructor(el, canvasRes, config) {
    this.config = config;
    this.canvas = canvasRes.node;
    this.ctx = this.canvas.getContext('2d');

    // 设置 Canvas 实际尺寸（考虑 DPR）
    this.canvas.width = canvasRes.width;
    this.canvas.height = canvasRes.height;
    
		// #ifdef H5
      // 获取设备 DPR
      this.dpr = this.getCanvasDpr();
      this.ctx.scale(1 / this.dpr, 1 / this.dpr);
		// #endif
  }
  static async create(el, config) {
    const canvasRes = await this.getCanvasNode(el);
    return new Poster(el, canvasRes, config);
  }
  
  static async getCanvasNode(el) {
    return new Promise((resolve, reject) => {
      try {
        uni.createSelectorQuery().select(`#${el}`).fields(
          {
            node: true,
            size: true
          },
          (res) => {
            res.node = res.node || document.getElementById(el).getElementsByTagName('canvas')[0]
            resolve(res)
          }).exec()
      } catch (e) {
        reject(e)
      }
    })
  }
  async createURL() {
    // 1. 并发预加载所有图片，大幅提升海报生成速度
    const imgTasks = Object.values(this.config)
      .filter(item => item.type === 'img')
      .map(async (item) => {
        item._preloadedImage = await this.getCanvasImage(item.image);
      });
    if (imgTasks.length > 0) {
      await Promise.all(imgTasks);
    }

    // 2. 按顺序进行绘制以保证图层层级正确
    for(const k in this.config) {
      const item = this.config[k];
      const type = item.type;
      switch (type) {
        case 'rect':
          this.clearRect(item);
          break;
        case 'img':
          await this.drawImage(item);
          break;
        case 'text':
          this.drawText(item);
          break;
        case 'line':
          this.drawLine(item);
          break;
      }
    }
    return this.exportImage()
  }
  // 获取比例
  getCanvasDpr() {
    const systemInfo = uni.getWindowInfo();
    return systemInfo.pixelRatio;
  }
  // 获取图片
  async getCanvasImage(url) {
    let image = null;
		// #ifdef MP
    image = this.canvas.createImage(url);
    image.src = url;
		// #endif
		// #ifdef H5
		image = new Image();
    image.crossOrigin = 'Anonymous';
    if(url.indexOf('https://') > -1 || url.indexOf('http://') > -1) {
      image.src = await this.getImageBase64(url);
    } else {
      image.src = url;
    }
		// #endif
		return new Promise(function(resolve, reject) {
			image.onload = function() {
				console.log('图片加载完成')
				resolve(image)
			}
			image.onerror = function(err) {
				console.log('图片加载失败', err)
				reject(err)
			}
		})
  }
  getImageBase64(url) {
    if(this.config.DefaultCrossDomainEnabledFun && Object.prototype.toString.call(this.config.DefaultCrossDomainEnabledFun) === '[object Function]') {
      return this.config.DefaultCrossDomainEnabledFun(url)
    }
    return new Promise((resolve, reject) => {
      const image = new Image();
      // 设置允许跨域
      image.crossOrigin = 'anonymous';
      // 避免缓存导致的跨域问题
      image.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + new Date().getTime();
      
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, image.width, image.height);
          // 默认导出为png格式，也可根据需要动态判断
          const base64 = canvas.toDataURL('image/png');
          resolve(base64);
        } catch (e) {
          reject(new Error('Canvas 转换 Base64 失败: ' + e.message));
        }
      };
      
      image.onerror = (err) => {
        reject(new Error('图片加载失败，可能是跨域限制'));
      };
    });
  }
  // 填充背景
  clearRect(data, clear) {
    const measureText = this.getMeasureTextWidth(data.measureText)
    if (clear) {
      // 实现圆角清除效果
      this.ctx.save();
      this.createRoundedRectPath(this.ctx, data.offset_w + measureText, data.offset_h, data.w, data.h, data.radius);
      this.ctx.clip();
      this.ctx.clearRect(data.offset_w + measureText, data.offset_h, data.w, data.h);
      this.ctx.restore();
    } else {
      this.createRoundedRectPath(this.ctx, data.offset_w + measureText, data.offset_h, data.w, data.h, data.radius);
      this.ctx.fillStyle = data.fillStyle;
      this.ctx.fill();
    }
  }
  // 创建圆角矩形路径
  createRoundedRectPath(ctx, x, y, width, height, radius = 0) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }
  
  // 绘制图片
  async drawImage(data) {
    const measureText = this.getMeasureTextWidth(data.measureText);
    const image = data._preloadedImage || await this.getCanvasImage(data.image);
    this.ctx.save();
    this.createRoundedRectPath(this.ctx, data.offset_w + measureText, data.offset_h, data.w, data.h, data.radius);
    this.ctx.clip();
    this.ctx.drawImage(image, data.offset_w + measureText, data.offset_h, data.w, data.h);
    // 恢复画布状态
    this.ctx.restore();
  }

  // 绘制文字
  drawText(data) {
    data.show = data.show === false ? data.show : true;
    if(data.show) {
      const measureText = this.getMeasureTextWidth(data.measureText);
      this.ctx.textBaseline = data.textBaseline;
      this.ctx.textAlign = data.textAlign;
      this.ctx.font = data.fontSize + 'px arial';
      this.ctx.fillStyle = data.color;
      this.ctx.fillText(data.fillText, data.offset_w + measureText, data.offset_h);
    }
  }

  // 绘制线
  drawLine(data) {
    const measureText = this.getMeasureTextWidth(data.measureText);
    this.ctx.beginPath();
    this.ctx.strokeStyle = data.color;
    this.ctx.lineWidth = data.lineWidth;
    this.ctx.moveTo(data.offset_w, data.offset_h);
    this.ctx.lineTo(data.w + measureText, data.h);
    this.ctx.stroke();
  }
  // 获取文字宽度
  getMeasureTextWidth(text) {
    return text && this.ctx.measureText(text).width || 0;
  }
  // 导出图片
  exportImage(data) {
    return new Promise((resolve, reject) => {
      // #ifdef MP
      uni.canvasToTempFilePath({
        canvas: this.canvas,
        fileType: 'png',
        destWidth: this.canvas.width,
        destHeight: this.canvas.height,
        success: function(res) {
          // iOS 检查路径有效性
          const platform = uni.getSystemInfoSync().platform;
          if (platform === 'ios') {
            uni.getImageInfo({
              src: res.tempFilePath,
              success: (info) => {
                resolve(info.path)
              },
              fail: () => reject(new Error('iOS 路径无效'))
            });
          } else {
            resolve(res.tempFilePath);
          }
        },
        fail: function(res) {
          reject(res);
        }
      }, this.canvas)
      // #endif
      // #ifdef H5
        const dataURL = this.canvas.toDataURL('image/png');
        resolve(dataURL);
      // #endif
    })
  }
}
