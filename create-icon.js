// 简单的图标转换脚本
const fs = require('fs');
const path = require('path');

// 读取 SVG 文件
const svgPath = path.join(__dirname, 'public', 'icon.svg');
const buildDir = path.join(__dirname, 'build');

// 确保 build 目录存在
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// 复制 SVG 到 build 目录作为备用
const buildSvgPath = path.join(buildDir, 'icon.svg');
fs.copyFileSync(svgPath, buildSvgPath);

console.log('图标文件已复制到 build 目录');
console.log('electron-builder 将自动处理 SVG 转换为 Windows 图标格式');


