// 将 SVG 转换为 ICO 的脚本
// 需要安装: npm install sharp --save-dev

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertSvgToIco() {
  try {
    const svgPath = path.join(__dirname, 'public', 'icon.svg');
    const icoPath = path.join(__dirname, 'build', 'icon.ico');
    
    // 确保 build 目录存在
    const buildDir = path.join(__dirname, 'build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }
    
    // 读取 SVG 并转换为 PNG，然后转换为 ICO
    // ICO 文件需要多个尺寸，我们创建 256x256 的版本
    await sharp(svgPath)
      .resize(256, 256)
      .png()
      .toFile(icoPath.replace('.ico', '.png'));
    
    console.log('PNG 图标已创建:', icoPath.replace('.ico', '.png'));
    console.log('注意: Windows 需要 .ico 格式，electron-builder 会自动处理 PNG');
    
    // 如果 sharp 支持 ICO，直接转换
    // 否则 electron-builder 会使用 PNG 自动生成 ICO
  } catch (error) {
    console.error('转换失败:', error.message);
    console.log('提示: electron-builder 可以直接使用 PNG 或 SVG，会自动转换为 ICO');
  }
}

convertSvgToIco();
